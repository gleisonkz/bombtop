import { nextSb4Random } from "./sb4-rng";

/** C00CAA: o limite é o byte baixo da semente anterior, não uma constante. */
export function nextSb2RandomWord(seed: number): { seed: number; word: number } {
  const next = nextSb4Random({ seed, bound: seed });
  return { seed: next.seed, word: next.value };
}
