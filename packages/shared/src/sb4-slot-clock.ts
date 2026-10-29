import type { StageSlotClock } from "./stage-state";

const COUNTER_OFFSETS = [0, 68, 44] as const;
const NATIVE_SYMBOLS = ["skull", "bar", "seven", "fire"] as const;

export function createSb4SlotClock(phases: readonly number[], atTick: number): StageSlotClock {
  if (phases.length !== 3) throw new RangeError("Three slot reel phases are required");
  return {
    lastTick: atTick,
    cursor: 0,
    afterAll: 0,
    reels: phases.map((phase, index) => ({
      counter: COUNTER_OFFSETS[index]!,
      interval: 1,
      accumulator: 0,
      phase: phase & 30,
      stopped: false,
    })),
  };
}

export function stepSb4SlotClock(clock: StageSlotClock): boolean {
  const allStopped = clock.reels.every(reel => reel.stopped);
  const reel = clock.reels[clock.cursor]!;
  reel.accumulator++;
  if (reel.accumulator >= reel.interval) {
    reel.accumulator = 0;
    if (reel.interval >= 4 && (reel.phase & 6) === 0) reel.stopped = true;
    else reel.phase = (reel.phase + 2) & 30;
  }
  reel.counter++;
  if (reel.counter >= 384 && (reel.counter & 7) === 0) reel.interval++;
  clock.cursor = (clock.cursor + 1) % clock.reels.length;
  if (allStopped) clock.afterAll++;
  return clock.afterAll >= 2;
}

export function symbolsFromSb4SlotClock(clock: StageSlotClock): (typeof NATIVE_SYMBOLS)[number][] {
  return clock.reels.map(reel => NATIVE_SYMBOLS[(reel.phase >> 3) & 3]!);
}
