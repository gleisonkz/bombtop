/** C5EE5D: bit 15 oculta; os demais bits dão a duração em frames nativos. */
export const SB2_SKULL_BLINK_WORDS = [
  0x8001, 1, 0x8001, 1, 0x8001, 1, 0x8001, 1, 0x8001, 1,
  0x8002, 2, 0x8002, 2, 0x8002, 2, 0x8002, 2, 0x8002, 2,
  0x8002, 4, 0x8002, 4, 0x8003, 6, 0x8003, 6,
  0x8004, 8, 0x8004, 8, 0x8004, 8,
  0x8006, 10, 0x8006, 10, 0x8006, 10, 0x8006, 10, 0x80c0,
] as const;
export const SB2_SKULL_BLINK_PERIOD = SB2_SKULL_BLINK_WORDS.reduce<number>((sum, word) => sum + (word & 0x7fff), 0);

/** A coleta é visível no frame zero; a tabela começa no próximo passo PAL. */
export function sb2SkullHidden(elapsed: number): boolean {
  if (elapsed <= 0) return false;
  let frame = (Math.floor(elapsed) - 1) % SB2_SKULL_BLINK_PERIOD;
  for (const word of SB2_SKULL_BLINK_WORDS) {
    const duration = word & 0x7fff;
    if (frame < duration) return (word & 0x8000) !== 0;
    frame -= duration;
  }
  return false;
}
