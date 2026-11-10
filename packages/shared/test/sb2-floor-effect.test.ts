import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { advanceSb2FloorEffectClock, startSb2FloorEffectClock } from "../src/sb2-floor-effect";

interface Sample {
  index: number;
  phase: number;
  center_code: number;
  records: { background: number; kind: number; animation: number; interval: number; timer: number }[];
}
const replay: { cases: Record<string, Sample[]> } = JSON.parse(readFileSync(
  new URL("../../../docs/sb2/SB2-STAGE12-FLOOR-EFFECTS-REPLAY.json", import.meta.url), "utf8"));
const parityReplay: { cases: Record<string, Sample[]> } = JSON.parse(readFileSync(
  new URL("../../../docs/sb2/SB2-STAGE12-FLOOR-PARITY-EFFECTS-REPLAY.json", import.meta.url), "utf8"));

it.each([
  ["center-trigger", replay.cases["center-trigger"]!, 9],
  ["delay1", parityReplay.cases.delay1!, 10],
  ["delay2", parityReplay.cases.delay2!, 11],
] as const)("reproduz registro e chama do piso11: %s", (_name, samples, activation) => {
  const first = samples.findIndex(sample => sample.records[0]!.background < 0x8000 && sample.records[0]!.kind === 4);
  expect(first).toBe(activation);
  let clock = startSb2FloorEffectClock();
  for (const sample of samples.slice(first)) {
    clock = advanceSb2FloorEffectClock(clock, sample.phase);
    const native = sample.records[0]!;
    expect(clock, `registro ${sample.index}`).toEqual({ animation: native.animation,
      interval: native.interval, timer: native.timer, active: native.background < 0x8000 });
    expect(clock.active && clock.animation > 0, `chama ${sample.index}`).toBe((sample.center_code & 63) === 1);
    clock = JSON.parse(JSON.stringify(clock));
  }
  expect(clock.active).toBe(false);
});
