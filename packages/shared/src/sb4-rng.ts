export function nextSb4Random(input: { seed: number; bound: number }): { seed: number; value: number } {
  const seed = (((input.seed & 0xffff) | 1) * 0x383) & 0xffff;
  return { seed, value: Math.floor(seed * (input.bound & 0xff) / 0x10000) };
}
