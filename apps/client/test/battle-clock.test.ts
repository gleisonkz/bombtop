import { describe, expect, it } from "vitest";
import { ROUND_TICKS, TICK_RATE } from "@bombtop/shared";
import { battleClockText } from "../src/render/battle-clock";
import { readFileSync } from "node:fs";

describe("Battle Mode clock", () => {
  it("preserva a opcao explicita de tempo infinito no SB2", () => {
    expect(battleClockText({ tick: ROUND_TICKS, pressureAt: 0,
      stageState: { sb2: { counterOffset: 0, pendingInputs: {}, battleClock: null } } })).toBe("∞");
  });
  it("apresenta o relogio PAL capturado, inclusive a pausa depois da morte", () => {
    const native = JSON.parse(readFileSync(new URL("../../../docs/sb2/SB2-STAGE12-CLOSURE-CLOCK-REPLAY.json", import.meta.url), "utf8"));
    for (const sample of native.samples as { clock: { minutes: number; seconds: number; frame: number } }[]) {
      const { clock } = sample;
      expect(battleClockText({ tick: 0, pressureAt: 0,
        stageState: { sb2: { counterOffset: 0, pendingInputs: {}, battleClock: clock } } }))
        .toBe(`${clock.minutes}:${String(clock.seconds).padStart(2, "0")}`);
    }
  });
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
