import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { advanceSb2SpringPadClock, startSb2SpringPadClock, type Sb2SpringPadClock } from "../src/sb2-spring-pad";
interface Sample { index: number; phase: number; active: boolean; timer: number; command: number }
const replay: { cases: Record<string, Sample[]> } = JSON.parse(readFileSync(
  new URL("../../../docs/sb2/SB2-STAGE12-SPRING-PAD-CLOCK-REPLAY.json", import.meta.url), "utf8"));
it.each(Object.entries(replay.cases))("reproduz registro3D88 do piso12: %s", (_name, samples) => {
  let clock: Sb2SpringPadClock | undefined;
  let previousActive = false;
  for (const sample of samples) {
    if (sample.active && !previousActive) clock = startSb2SpringPadClock();
    previousActive = sample.active;
    if (!clock) continue;
    clock = advanceSb2SpringPadClock(clock, sample.phase).clock;
    expect(clock, `registro ${sample.index}`).toEqual({ active: sample.active, timer: sample.timer, command: sample.command });
    clock = JSON.parse(JSON.stringify(clock));
  }
});
