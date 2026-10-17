import { describe, expect, it } from "vitest";
import { FixedStep } from "../src/loop/fixed-step";

const TICK = 1000 / 60;

describe("FixedStep", () => {
  it("runs one tick per tick interval", () => {
    expect(new FixedStep(TICK).advance(TICK)).toBe(1);
  });

  it("accumulates partial frames", () => {
    const f = new FixedStep(TICK);
    expect(f.advance(TICK / 2)).toBe(0);
    expect(f.advance(TICK / 2)).toBe(1);
  });

  it("runs several ticks on a slow frame", () => {
    expect(new FixedStep(TICK).advance(TICK * 3 + 1)).toBe(3);
  });

  it("keeps the remainder for the next frame", () => {
    const f = new FixedStep(TICK);
    f.advance(TICK * 1.5);
    expect(f.advance(TICK * 0.5)).toBe(1);
  });

  it("caps ticks per frame and drops the backlog (e.g. after a hidden tab)", () => {
    const f = new FixedStep(TICK, 5);
    expect(f.advance(10_000)).toBe(5);
    expect(f.advance(0)).toBe(0);
  });

  it("ignores negative deltas", () => {
    expect(new FixedStep(TICK).advance(-50)).toBe(0);
  });

  it("exposes the interpolation factor between ticks", () => {
    const f = new FixedStep(TICK);
    f.advance(TICK * 1.25);
    expect(f.alpha).toBeCloseTo(0.25);
  });
});
