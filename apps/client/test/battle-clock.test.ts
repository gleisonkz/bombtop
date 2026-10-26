import { describe, expect, it } from "vitest";
import { ROUND_TICKS, TICK_RATE } from "@bombtop/shared";
import { battleClockText } from "../src/render/battle-clock";

describe("Battle Mode clock", () => {
  it("shows the actual round deadline while the arena pressure has already begun", () => {
    const deadline = 3 * 60 * TICK_RATE;
    expect(battleClockText({ tick: 0, pressureAt: 2 * 60 * TICK_RATE, roundEndsAt: deadline })).toBe("3:00");
    expect(battleClockText({ tick: 2 * 60 * TICK_RATE, pressureAt: 2 * 60 * TICK_RATE, roundEndsAt: deadline })).toBe("1:00");
    expect(battleClockText({ tick: deadline - 1, pressureAt: 2 * 60 * TICK_RATE, roundEndsAt: deadline })).toBe("0:01");
    expect(battleClockText({ tick: deadline, pressureAt: 2 * 60 * TICK_RATE, roundEndsAt: deadline })).toBe("0:00");
  });

  it("preserves Bombtop's original countdown for matches without a time limit", () => {
    expect(battleClockText({ tick: 0, pressureAt: ROUND_TICKS })).toBe("3:00");
    expect(battleClockText({ tick: ROUND_TICKS, pressureAt: ROUND_TICKS })).toBe("SUDDEN DEATH!");
  });

  it("does not announce full Sudden Death when only the limited edge collapse is enabled", () => {
    expect(battleClockText({ tick: ROUND_TICKS, pressureAt: ROUND_TICKS, pressureLimit: 44 })).toBe("∞");
  });
});
