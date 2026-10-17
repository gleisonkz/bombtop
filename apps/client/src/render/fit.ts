/** Largest scale that fits the arena on screen (not snapped to integers: the art is vector drawn). */
export function fitScale(viewW: number, viewH: number, arenaW: number, arenaH: number): number {
  return Math.max(1, Math.min(viewW / arenaW, viewH / arenaH));
}
