import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanBeacon, lanKnock, lanPost, lanRooms, type LanPost } from "../src/net/lan";

type Call = [op: string, body: Record<string, unknown>];

/** A fake server: answers each op with what `routes` returns, keeping every call. */
function server(routes: Record<string, (body: Record<string, unknown>) => { status: number; json?: unknown }>) {
  const calls: Call[] = [];
  const post: LanPost = async (op, body) => {
    calls.push([op, body as Record<string, unknown>]);
    const route = routes[op];
    if (!route) return { status: 404, json: null };
    const r = route(body as Record<string, unknown>);
    return { status: r.status, json: r.json ?? null };
  };
  return { post, calls };
}

describe("lanPost", () => {
  it("posts plain-text JSON to the game server's http side", async () => {
    const fetcher = vi.fn(async () => new Response('{"ok":1}', { status: 200 }));
    const post = lanPost("wss://game.example/", fetcher as unknown as typeof fetch);
    expect(await post("rooms", {})).toEqual({ status: 200, json: { ok: 1 } });
    expect(fetcher).toHaveBeenCalledWith("https://game.example/lan/rooms", { method: "POST", body: "{}" });
  });

  it("is status 0 when the server can't be reached (no internet)", async () => {
    const post = lanPost("ws://x", (async () => {
      throw new TypeError("offline");
    }) as unknown as typeof fetch);
    expect(await post("rooms", {})).toEqual({ status: 0, json: null });
  });
});

describe("lanRooms", () => {
  it("lists the rooms on this network, or none when the server can't be reached", async () => {
    const rooms = [{ id: "K7QM", name: "Gil", players: 1, max: 5, playing: false }];
    expect(await lanRooms(server({ rooms: () => ({ status: 200, json: rooms }) }).post)).toEqual(rooms);
    expect(await lanRooms(server({}).post)).toEqual([]);
  });
});

describe("LanBeacon", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("opens the room, beats with its news and answers each friend who knocks", async () => {
    let knocks = [{ ticket: "t1", offer: "o1" }];
    const fake = server({
      open: () => ({ status: 200, json: { id: "K7QM", key: "k" } }),
      beat: () => {
        const k = knocks;
        knocks = [];
        return { status: 200, json: k };
      },
      answer: () => ({ status: 200, json: {} }),
      close: () => ({ status: 200, json: {} }),
    });
    const info = { name: "Gil", players: 2, max: 5, playing: false };
    const beacon = new LanBeacon(fake.post, () => info, async (offer) => `answer-to-${offer}`);
    await beacon.start();
    expect(beacon.id).toBe("K7QM");
    expect(fake.calls[0]).toEqual(["open", info]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fake.calls).toContainEqual(["beat", { id: "K7QM", key: "k", ...info }]);
    expect(fake.calls).toContainEqual(["answer", { id: "K7QM", key: "k", ticket: "t1", answer: "answer-to-o1" }]);
    await beacon.stop();
    expect(fake.calls.at(-1)).toEqual(["close", { id: "K7QM", key: "k" }]);
    const n = fake.calls.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(fake.calls.length).toBe(n); // no more beats
  });

  it("stays without an id when there is no internet, and tells whoever waits for it", async () => {
    const beacon = new LanBeacon(server({}).post, () => ({ name: "", players: 1, max: 5, playing: false }), async () => "");
    const seen: (string | null)[] = [];
    beacon.onChange((id) => seen.push(id));
    await beacon.start();
    expect(beacon.id).toBeNull();
    expect(seen).toEqual([null]);
    await beacon.stop();
  });

  it("opens the room again when the server forgot it (restarted)", async () => {
    let n = 0;
    const fake = server({
      open: () => ({ status: 200, json: { id: `R${++n}`, key: "k" } }),
      beat: () => ({ status: 404 }),
    });
    const beacon = new LanBeacon(fake.post, () => ({ name: "", players: 1, max: 5, playing: false }), async () => "");
    await beacon.start();
    await vi.advanceTimersByTimeAsync(1000);
    expect(beacon.id).toBe("R2");
    await beacon.stop();
  });
});

describe("lanKnock", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("knocks with the offer and waits for the host's answer", async () => {
    let polls = 0;
    const fake = server({
      knock: () => ({ status: 200, json: { ticket: "t1" } }),
      reply: () => ({ status: 200, json: { answer: ++polls < 3 ? null : "a1" } }),
    });
    const answer = lanKnock(fake.post, "K7QM", "o1");
    await vi.advanceTimersByTimeAsync(2000);
    expect(await answer).toBe("a1");
    expect(fake.calls[0]).toEqual(["knock", { id: "K7QM", offer: "o1" }]);
  });

  it("fails in words a player understands", async () => {
    await expect(lanKnock(server({ knock: () => ({ status: 404 }) }).post, "NOPE", "o")).rejects.toThrow("Sala não encontrada");
    await expect(lanKnock(async () => ({ status: 0, json: null }), "K7QM", "o").catch((e) => e.message)).resolves.toMatch(/servidor|internet/i);
    const silent = lanKnock(server({ knock: () => ({ status: 200, json: { ticket: "t" } }), reply: () => ({ status: 200, json: { answer: null } }) }).post, "K7QM", "o");
    const caught = silent.catch((e: Error) => e.message);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await caught).toMatch(/não respondeu/);
  });
});
