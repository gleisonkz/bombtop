import { describe, expect, it } from "vitest";
import { createSb4SlotClock, stepSb4SlotClock, symbolsFromSb4SlotClock } from "../src/sb4-slot-clock";

describe("SB4 slot reel CPU cadence", () => {
  it("reproduces the 1233 logical updates in the native slot control trace", () => {
    const clock = createSb4SlotClock([16, 24, 16], 129);
    const stoppedAt: { index: number; tick: number }[] = [];
    let done = false;
    for (let tick = 1; tick <= 1233; tick++) {
      const prior = clock.reels.map(reel => reel.stopped);
      done = stepSb4SlotClock(clock);
      clock.reels.forEach((reel, index) => {
        if (reel.stopped && !prior[index]) stoppedAt.push({ index, tick });
      });
      if (tick < 1233) expect(done).toBe(false);
    }
    expect(done).toBe(true);
    expect(stoppedAt).toEqual([
      { index: 1, tick: 1028 },
      { index: 2, tick: 1101 },
      { index: 0, tick: 1231 },
    ]);
    expect(clock.reels.map(reel => [reel.counter, reel.interval, reel.accumulator, reel.phase])).toEqual([
      [411, 5, 0, 0],
      [479, 13, 11, 0],
      [455, 10, 9, 8],
    ]);
    expect(symbolsFromSb4SlotClock(clock)).toEqual(["skull", "skull", "bar"]);
  });

  it("continues identically after JSON serialization", () => {
    const original = createSb4SlotClock([0, 8, 16], 30);
    for (let i = 0; i < 300; i++) stepSb4SlotClock(original);
    const recovered = JSON.parse(JSON.stringify(original)) as typeof original;
    for (let i = 0; i < 930; i++) {
      expect(stepSb4SlotClock(recovered)).toBe(stepSb4SlotClock(original));
    }
    expect(recovered).toEqual(original);
  });
});
