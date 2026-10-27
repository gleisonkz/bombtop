import { describe, expect, it } from "vitest";
import { nextSurpriseSelection } from "../src/sb4-surprise-selection";

describe("SB4 surprise selection at C1550B", () => {
  it("replays the measured arm and center samples with the shared counter", () => {
    // stage06-selection-trace.json: Y 0048,0044,0046; then center refreshes.
    const samples = [14, 11, 2, 3, 2, 1, 1, 3, 1, 1, 1, 3, 2, 3, 1];
    const expected = ["ice", "ice", "sticky", "normal", "ice", "normal", "normal", "normal", "normal", "normal", "sticky", "normal", "ice", "normal", "normal"];
    let counter = 69;
    for (const [index, sample] of samples.entries()) {
      const result = nextSurpriseSelection({ counter, sample, seed: 123 });
      expect(result.kind).toBe(expected[index]);
      expect(result.counter).toBe(--counter);
      expect(result.seed).toBe(123);
    }
  });

  it("uses the literal sixteen-word normal/ice table, allowing unchanged results", () => {
    const result = Array.from({ length: 16 }, (_, sample) => nextSurpriseSelection({ counter: 69, sample, seed: 0 }).kind);
    expect(result).toEqual([null, "normal", "ice", "normal", "ice", "ice", "normal", "ice", "normal", "ice", "normal", "ice", "normal", "normal", "ice", "ice"]);
  });

  it("leaves the counter and RNG alone for a zero sample", () => {
    expect(nextSurpriseSelection({ counter: 69, sample: 0, seed: 7 })).toEqual({ kind: null, counter: 69, seed: 7 });
  });

  it("emits reverse on counter exhaustion and resets by the original RNG", () => {
    expect(nextSurpriseSelection({ counter: 1, sample: 14, seed: 0 })).toEqual({ kind: "reverse", counter: 67, seed: 899 });
  });
});
