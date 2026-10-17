/** One mulberry32 step: returns [value in 0..1, next state]. */
function mulberry32(state: number): [number, number] {
  const a = (state + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
}

/** Deterministic PRNG (mulberry32). Same seed => same sequence on client and server. */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    const [value, next] = mulberry32(state);
    state = next;
    return value;
  };
}

/** Draws from a PRNG whose state lives in serializable match state. */
export function nextRandom(s: { rng: number }): number {
  const [value, next] = mulberry32(s.rng);
  s.rng = next;
  return value;
}
