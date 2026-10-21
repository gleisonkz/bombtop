import { describe, expect, it } from "vitest";
import { TickClock } from "../src/loop/tick-clock";

const STEP = 1000 / 60;

describe("TickClock", () => {
  it("runs one tick per tick's worth of time", () => {
    const c = new TickClock(STEP, 0);
    expect(c.due(STEP / 2)).toBe(0);
    expect(c.due(STEP)).toBe(1);
    expect(c.due(STEP * 3)).toBe(2);
  });

  it("after a stall, catches up a few ticks per call instead of all at once", () => {
    const c = new TickClock(STEP, 0, { maxPerCall: 4, maxBehindMs: 500 });
    const first = c.due(300); // the page froze for 300 ms: 18 ticks owed
    expect(first).toBe(4);
    let total = first;
    let now = 300;
    for (let i = 0; i < 20; i++) total += c.due((now += STEP / 2));
    // Every owed tick is played (the match keeps real time), only spread out.
    expect(total).toBe(Math.floor(now / STEP + 1e-9));
  });

  it("drops time past the backlog limit (a phone asleep doesn't fast-forward the match)", () => {
    const c = new TickClock(STEP, 0, { maxPerCall: 1000, maxBehindMs: 500 });
    expect(c.due(10_000)).toBe(Math.floor(500 / STEP + 1e-9));
    expect(c.behind).toBeLessThan(STEP);
  });

  it("reports how far behind it is", () => {
    const c = new TickClock(STEP, 0, { maxPerCall: 2, maxBehindMs: 500 });
    c.due(STEP * 10);
    expect(c.behind).toBeCloseTo(STEP * 8);
  });
});
