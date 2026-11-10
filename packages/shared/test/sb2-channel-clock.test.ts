import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { advanceSb2ChannelClock, requestSb2Channel, type Sb2ChannelClock } from "../src/sb2-channel";

interface Sample { index: number; frame: number; clock: Sb2ChannelClock; request_after_step: boolean }
const reference: { cases: Record<string, Sample[]> } = JSON.parse(readFileSync(
  new URL("../../../docs/sb2/SB2-CHANNEL-CLOCK-SAMPLES.json", import.meta.url), "utf8"));

it.each(Object.entries(reference.cases))("reproduz o relógio nativo em %s com solicitações observadas", (_name, samples) => {
  let clock = { ...samples[0]!.clock };
  for (const sample of samples.slice(1)) {
    advanceSb2ChannelClock(clock);
    if (sample.request_after_step) requestSb2Channel(clock);
    expect(clock, `frame nativo ${sample.frame}`).toEqual(sample.clock);
    clock = JSON.parse(JSON.stringify(clock));
  }
});
