import { describe, expect, it } from "vitest";
import { AliveMark, ClientLog, logUrl } from "../src/net/client-log";

const memory = () => {
  const m = new Map<string, string>();
  return { get: (k: string) => m.get(k) ?? null, set: (k: string, v: string) => void m.set(k, v) };
};

describe("logUrl", () => {
  it("posts to the game server's /log over http(s)", () => {
    expect(logUrl("wss://187-127-63-110.sslip.io")).toBe("https://187-127-63-110.sslip.io/log");
    expect(logUrl("http://localhost:2567")).toBe("http://localhost:2567/log");
    expect(logUrl("ws://192.168.0.5:2567/")).toBe("http://192.168.0.5:2567/log");
  });
});

describe("AliveMark (telling a crash from a page closed)", () => {
  it("a page that was never closed and is open again crashed: says where it was and what it was doing", () => {
    const store = memory();
    let now = 1000;
    const first = new AliveMark(store, () => now);
    expect(first.start("/sala/AB12")).toBeNull();
    first.crumb("match", "/sala/CD34");
    now = 5000;
    expect(new AliveMark(store, () => now).start("/sala/AB12")).toEqual({ path: "/sala/CD34", crumb: "match", age: 4000 });
  });

  it("a page closed or sent to the background did not crash; one brought back is watched again", () => {
    const store = memory();
    const a = new AliveMark(store, () => 0);
    a.start("/");
    a.away();
    expect(new AliveMark(store, () => 0).start("/")).toBeNull();
    const b = new AliveMark(store, () => 0);
    b.start("/");
    b.away();
    b.back();
    expect(new AliveMark(store, () => 0).start("/")).toEqual({ path: "/", crumb: "boot", age: 0 });
  });
});

describe("ClientLog", () => {
  it("sends each event once with what the page is, and the same error only once", () => {
    const sent: unknown[] = [];
    const log = new ClientLog((e) => void sent.push(e), { ua: "iPhone", v: "abc1234" });
    log.error("boom", "at x");
    log.error("boom", "at x");
    log.send({ kind: "crash", crumb: "match" });
    expect(sent).toEqual([
      { kind: "error", msg: "boom", stack: "at x", ua: "iPhone", v: "abc1234" },
      { kind: "crash", crumb: "match", ua: "iPhone", v: "abc1234" },
    ]);
  });

  it("stops sending errors after a few (a loop that throws every frame)", () => {
    const sent: unknown[] = [];
    const log = new ClientLog((e) => void sent.push(e), {});
    for (let i = 0; i < 50; i++) log.error(`e${i}`);
    expect(sent).toHaveLength(10);
  });
});
