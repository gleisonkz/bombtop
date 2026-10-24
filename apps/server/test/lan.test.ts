import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { LanDirectory, lanRoute } from "../src/lan";

const room = { name: "Sala do Gil", players: 1, max: 5, playing: false };

describe("LanDirectory", () => {
  it("lists a host's room to phones on the same network only", () => {
    const dir = new LanDirectory();
    const { id } = dir.open("1.1.1.1", room)!;
    expect(dir.list("1.1.1.1")).toEqual([{ id, ...room }]);
    expect(dir.list("2.2.2.2")).toEqual([]);
  });

  it("relays a friend's offer to the host and the host's answer back", () => {
    const dir = new LanDirectory();
    const { id, key } = dir.open("1.1.1.1", room)!;
    const ticket = dir.knock(id, "o-offer")!;
    expect(dir.reply(ticket)).toBeNull(); // not answered yet
    expect(dir.beat(id, key, room)).toEqual([{ ticket, offer: "o-offer" }]);
    expect(dir.beat(id, key, room)).toEqual([]); // handed over once
    expect(dir.answer(id, key, ticket, "a-answer")).toBe(true);
    expect(dir.reply(ticket)).toBe("a-answer");
  });

  it("takes the host's word only with its key", () => {
    const dir = new LanDirectory();
    const { id } = dir.open("1.1.1.1", room)!;
    const ticket = dir.knock(id, "o")!;
    expect(dir.beat(id, "wrong", room)).toBeNull();
    expect(dir.answer(id, "wrong", ticket, "a")).toBe(false);
    expect(dir.close(id, "wrong")).toBe(false);
    expect(dir.list("1.1.1.1")).toHaveLength(1);
  });

  it("keeps the room's news from the host's beats, and drops it when the host closes it", () => {
    const dir = new LanDirectory();
    const { id, key } = dir.open("1.1.1.1", room)!;
    dir.beat(id, key, { ...room, players: 3, playing: true });
    expect(dir.list("1.1.1.1")[0]).toMatchObject({ players: 3, playing: true });
    expect(dir.close(id, key)).toBe(true);
    expect(dir.list("1.1.1.1")).toEqual([]);
    expect(dir.knock(id, "o")).toBeNull();
  });

  it("forgets a room whose host stopped beating, and an unanswered knock", () => {
    let now = 0;
    const dir = new LanDirectory(() => now);
    const { id, key } = dir.open("1.1.1.1", room)!;
    const ticket = dir.knock(id, "o")!;
    now = 10_000;
    dir.beat(id, key, room);
    now = 40_000;
    expect(dir.reply(ticket)).toBeUndefined(); // gone
    expect(dir.list("1.1.1.1")).toEqual([]);
    expect(dir.beat(id, key, room)).toBeNull();
  });

  it("cleans what it is given and holds only so much", () => {
    const dir = new LanDirectory();
    const { id } = dir.open("1.1.1.1", { name: "x".repeat(100), players: 99, max: -1, playing: "yes" })!;
    expect(dir.list("1.1.1.1")[0]).toEqual({ id, name: "x".repeat(24), players: 0, max: 5, playing: false });
    expect(dir.knock(id, "o".repeat(20_000))).toBeNull(); // no offer is that long
    for (let i = 0; i < 20; i++) dir.knock(id, "o");
    expect(dir.knock(id, "o")).toBeNull();
    for (let i = 0; i < 10; i++) dir.open("1.1.1.1", room);
    expect(dir.list("1.1.1.1").length).toBeLessThanOrEqual(8);
  });
});

describe("POST /lan/<op>", () => {
  const req = (op: string, body: unknown, ip = "1.1.1.1") => {
    const r = Readable.from([Buffer.from(JSON.stringify(body))]) as Readable & {
      headers: Record<string, string>;
      socket: { remoteAddress: string };
      params: { op: string };
    };
    r.headers = { "x-forwarded-for": `${ip}, 10.0.0.1` };
    r.socket = { remoteAddress: "127.0.0.1" };
    r.params = { op };
    return r;
  };
  const res = () => {
    const out = { status: 0, headers: {} as Record<string, string>, body: "" };
    return Object.assign(out, {
      writeHead(status: number, headers: Record<string, string>) {
        out.status = status;
        Object.assign(out.headers, headers);
        return this;
      },
      end(body = "") {
        out.body = body;
      },
    });
  };
  const call = async (handle: ReturnType<typeof lanRoute>, op: string, body: unknown, ip?: string) => {
    const r = res();
    await handle(req(op, body, ip), r);
    return { status: r.status, cors: r.headers["Access-Control-Allow-Origin"], json: r.body ? JSON.parse(r.body) : null };
  };

  it("opens a room, lists it on the host's network, and pairs a friend through it", async () => {
    const handle = lanRoute(new LanDirectory());
    const opened = await call(handle, "open", room);
    expect(opened.status).toBe(200);
    expect(opened.cors).toBe("*");
    const { id, key } = opened.json;
    expect((await call(handle, "rooms", {})).json).toEqual([{ id, ...room }]);
    expect((await call(handle, "rooms", {}, "9.9.9.9")).json).toEqual([]);
    const { ticket } = (await call(handle, "knock", { id, offer: "o1" }, "9.9.9.9")).json; // a link works from anywhere
    expect((await call(handle, "beat", { id, key, ...room })).json).toEqual([{ ticket, offer: "o1" }]);
    expect((await call(handle, "answer", { id, key, ticket, answer: "a1" })).status).toBe(200);
    expect((await call(handle, "reply", { ticket })).json).toEqual({ answer: "a1" });
  });

  it("says when a room or ticket is gone, and refuses junk", async () => {
    const handle = lanRoute(new LanDirectory());
    expect((await call(handle, "knock", { id: "NOPE", offer: "o" })).status).toBe(404);
    expect((await call(handle, "reply", { ticket: "nope" })).status).toBe(404);
    expect((await call(handle, "beat", { id: "NOPE", key: "k" })).status).toBe(404);
    expect((await call(handle, "what", {})).status).toBe(404);
    const r = res();
    const bad = Readable.from([Buffer.from("not json")]) as any;
    bad.headers = {};
    bad.socket = { remoteAddress: "1.1.1.1" };
    bad.params = { op: "open" };
    await handle(bad, r);
    expect(r.status).toBe(400);
  });
});
