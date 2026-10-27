import { nextSb4Random } from "./sb4-rng";
import type { StageSurpriseKind } from "./stage-state";

// C15558, indexed by the low nibble of nonzero $1EAC.
const TABLE: readonly StageSurpriseKind[] = [
  "ice", "normal", "ice", "normal", "ice", "ice", "normal", "ice",
  "normal", "ice", "normal", "ice", "normal", "normal", "ice", "ice",
];

/** C30D38 and C15534: a shared counter in 64..127, not a per-panel timer. */
export function nextSurpriseCounter(seed: number): { seed: number; counter: number } {
  const next = nextSb4Random({ seed, bound: 255 });
  return { seed: next.seed, counter: (next.value & 63) + 64 };
}

/** Literal C1550B selection, independent of how a flame supplies its sample. */
export function nextSurpriseSelection(input: { sample: number; counter: number; seed: number }): {
  kind: StageSurpriseKind | null;
  counter: number;
  seed: number;
} {
  if (input.sample === 0) return { kind: null, counter: input.counter, seed: input.seed };
  const counter = (input.counter - 1) & 0xffff;
  if (counter === 0) return { kind: "reverse", ...nextSurpriseCounter(input.seed) };
  const kind = (counter & 7) === 2 ? "sticky" : TABLE[input.sample & 15]!;
  return { kind, counter, seed: input.seed };
}
