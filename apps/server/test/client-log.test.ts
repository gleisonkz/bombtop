import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import { clientEvent, logRoute } from "../src/client-log";
import { NetLog, netReport } from "../src/net-log";

describe("clientEvent", () => {
  it("keeps what a page reports about itself: boots, crashes, errors", () => {
    expect(clientEvent({ kind: "boot", path: "/sala/AB12", ua: "iPhone", v: "abc1234", w: 390, h: 844, dm: 4, junk: 1 })).toEqual({
      kind: "boot", path: "/sala/AB12", ua: "iPhone", v: "abc1234", w: 390, h: 844, dm: 4,
    });
    expect(clientEvent({ kind: "crash", path: "/sala/AB12", crumb: "match", age: 4200 })).toEqual({ kind: "crash", path: "/sala/AB12", crumb: "match", age: 4200 });
    expect(clientEvent({ kind: "error", msg: "boom", stack: "at x" })).toEqual({ kind: "error", msg: "boom", stack: "at x" });
  });

  it("keeps errors the page caught and logged, and how long it froze", () => {
    expect(clientEvent({ kind: "console", level: "error", msg: "sprite sheet 404", stack: "at y" })).toEqual({
      kind: "console", level: "error", msg: "sprite sheet 404", stack: "at y",
    });
    expect(clientEvent({ kind: "freeze", path: "/sala/AB12", crumb: "lobby", ms: 5200 })).toEqual({ kind: "freeze", path: "/sala/AB12", crumb: "lobby", ms: 5200 });
    expect(clientEvent({ kind: "unfreeze", crumb: "lobby", ms: 9100 })).toEqual({ kind: "unfreeze", crumb: "lobby", ms: 9100 });
    expect(clientEvent({ kind: "freeze", ms: -5, level: "x".repeat(50) })).toEqual({ kind: "freeze", level: "x".repeat(10) });
  });

  it("drops anything else, and cuts long text", () => {
    expect(clientEvent({ kind: "hack" })).toBeNull();
    expect(clientEvent("boot")).toBeNull();
    expect(clientEvent({ kind: "error", msg: "x".repeat(5000), w: -1, h: "a" })).toEqual({ kind: "error", msg: "x".repeat(300) });
    expect(clientEvent({ kind: "error", stack: "y".repeat(5000) })!.stack).toHaveLength(1000);
  });
});

describe("client log file", () => {
  it("goes to its own file per day", () => {
    const dir = mkdtempSync(join(tmpdir(), "clientlog-"));
    new NetLog(dir, () => new Date("2026-10-22T18:00:00Z"), "client").write({ ip: "1.2.3.4" }, { kind: "boot" });
    expect(readdirSync(dir)).toEqual(["client-2026-10-22.jsonl"]);
  });
});

describe("netReport memory", () => {
  it("keeps the page's memory use and the device's memory", () => {
    expect(netReport({ mem: 210, dm: 4 })).toEqual({ mem: 210, dm: 4 });
  });
});

describe("POST /log", () => {
  /** A request carrying `body`, from `ip`. */
  const req = (body: string, ip = "1.2.3.4") => {
    const r = Readable.from([Buffer.from(body)]) as Readable & { headers: Record<string, string>; socket: { remoteAddress: string } };
    r.headers = {};
    r.socket = { remoteAddress: ip };
    return r;
  };
  const res = () => {
    const out = { status: 0, headers: {} as Record<string, string>, ended: false };
    return Object.assign(out, {
      writeHead(status: number, headers: Record<string, string>) {
        out.status = status;
        Object.assign(out.headers, headers);
        return this;
      },
      end() {
        out.ended = true;
      },
    });
  };

  it("writes each event the page sends, with the address it came from", async () => {
    const lines: unknown[] = [];
    const handle = logRoute({ write: (who, e) => void lines.push({ ...who, ...e }) });
    const r = res();
    await handle(req(JSON.stringify({ kind: "crash", crumb: "match" }), "9.9.9.9"), r);
    expect(lines).toEqual([{ ip: "9.9.9.9", kind: "crash", crumb: "match" }]);
    expect(r.status).toBe(204);
    expect(r.headers["Access-Control-Allow-Origin"]).toBe("*");
  });

  it("forwarded addresses win (behind Caddy), junk is dropped, and one address sends only so many a minute", async () => {
    const lines: unknown[] = [];
    let now = 0;
    const handle = logRoute({ write: (who, e) => void lines.push({ ...who, ...e }) }, () => now);
    const fwd = req(JSON.stringify({ kind: "boot" }));
    fwd.headers["x-forwarded-for"] = "5.5.5.5, 10.0.0.1";
    await handle(fwd, res());
    await handle(req("not json"), res());
    expect(lines).toEqual([{ ip: "5.5.5.5", kind: "boot" }]);
    for (let i = 0; i < 40; i++) await handle(req(JSON.stringify({ kind: "error", msg: `${i}` })), res());
    expect(lines.length).toBe(1 + 20);
    now = 61_000;
    await handle(req(JSON.stringify({ kind: "error" })), res());
    expect(lines.length).toBe(22);
  });
});
