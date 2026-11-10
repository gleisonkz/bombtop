import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { createMatch } from "../src/arena";
import { sb2NativeFramesAfterTicks } from "../src/sb2-native-clock";
import { step } from "../src/step";

interface Sample { index: number; counter: number; seed: number; history: number[] }
const reference: { cases: Record<string, Sample[]> } = JSON.parse(readFileSync(
  new URL("../../../docs/sb2/SB2-RANDOM-HISTORY-REPLAY.json", import.meta.url), "utf8"));

it.each(Object.entries(reference.cases).filter(([, samples]) => samples.length > 1))(
  "reproduz as16 palavras nativas no step: %s", (name, samples) => {
    const initial = samples[0]!;
    let s = createMatch({ stage: "sb2-02", seed: 1, playerIds: ["a", "b"], suddenDeath: false });
    Object.assign(s.stageState!.sb2!, { counterOffset: initial.counter, randomSeed: initial.seed,
      randomWord: initial.history[0], randomHistory: [...initial.history] });
    for (const sample of samples.slice(1)) {
      const before = sb2NativeFramesAfterTicks(s.tick);
      do { step(s); } while (sb2NativeFramesAfterTicks(s.tick) === before);
      expect(s.stageState!.sb2!.randomSeed, `semente ${name}:${sample.index}`).toBe(sample.seed);
      expect(s.stageState!.sb2!.randomHistory, `histórico ${name}:${sample.index}`).toEqual(sample.history);
      s = JSON.parse(JSON.stringify(s));
    }
  },
);
