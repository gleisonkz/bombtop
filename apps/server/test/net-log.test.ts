import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NetLog, netReport, TickCost } from "../src/net-log";

describe("netReport", () => {
  it("keeps the measurements, as bounded numbers", () => {
    expect(netReport({ ping: 12.4, delay: 61, fps: 58, late: 3, gap: 140, slow: 340, missed: 9, work: 85, tick: 12, jumpMe: 12, jumpOthers: 140, ua: "Android 14; Chrome", extra: "x" })).toEqual({
      ping: 12.4, delay: 61, fps: 58, late: 3, gap: 140, slow: 340, missed: 9, work: 85, jumpMe: 12, jumpOthers: 140, ua: "Android 14; Chrome",
    });
  });

  it("drops anything that is not a sane measurement", () => {
    expect(netReport({ ping: "a", delay: -5, fps: 1e9, late: NaN, gap: 50 })).toEqual({ gap: 50 });
    expect(netReport(null)).toBeNull();
    expect(netReport({})).toBeNull();
  });

  it("cuts a long user agent", () => {
    expect(netReport({ fps: 60, ua: "x".repeat(500) })!.ua).toHaveLength(120);
  });
});

describe("NetLog", () => {
  it("appends one JSON line per report to a file per day", () => {
    const dir = mkdtempSync(join(tmpdir(), "netlog-"));
    const log = new NetLog(dir, () => new Date("2026-10-19T18:00:00Z"));
    log.write({ room: "r1", player: "Ana" }, { ping: 7, fps: 60 });
    log.write({ room: "r1", player: "Ana" }, { ping: 9, fps: 59 });
    expect(readdirSync(dir)).toEqual(["net-2026-10-19.jsonl"]);
    const lines = readFileSync(join(dir, "net-2026-10-19.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    expect(lines).toEqual([
      { t: "2026-10-19T18:00:00.000Z", room: "r1", player: "Ana", ping: 7, fps: 60 },
      { t: "2026-10-19T18:00:00.000Z", room: "r1", player: "Ana", ping: 9, fps: 59 },
    ]);
  });

  it("lets a player report at most once every two seconds", () => {
    let now = 0;
    const log = new NetLog(mkdtempSync(join(tmpdir(), "netlog-")), () => new Date(now));
    expect(log.allow("a")).toBe(true);
    expect(log.allow("a")).toBe(false);
    now = 2500;
    expect(log.allow("a")).toBe(true);
  });
});

describe("TickCost", () => {
  it("keeps the room's slowest simulation tick (tenths of a ms) between two reports", () => {
    const c = new TickCost();
    c.add(0.21);
    c.add(1.37); // a tick with a big chain of explosions
    c.add(0.3);
    expect(c.take()).toBe(14);
    expect(c.take()).toBe(0);
  });
});
