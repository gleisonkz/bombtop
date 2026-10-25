/**
 * The score bar over the arena's top wall (as in Super Bomberman 4): each player's head and rounds won, split to either
 * side of the round clock in the middle, in seat order from left to right.
 */

/** A slot's width (a head and its number), world pixels. */
export const SCORE_SLOT = 28;
/** Half the room the clock takes in the middle ("SUDDEN DEATH!" at its widest). */
const CLOCK_HALF = 32;

/** Each slot's center x on an arena `width` pixels wide: the first half (rounded up) left of the clock, the rest right. */
export function scoreSlots(n: number, width: number): number[] {
  const mid = width / 2;
  const left = Math.ceil(n / 2);
  const xs: number[] = [];
  for (let i = 0; i < left; i++) xs.push(mid - CLOCK_HALF - SCORE_SLOT * (left - i - 0.5));
  for (let i = 0; i < n - left; i++) xs.push(mid + CLOCK_HALF + SCORE_SLOT * (i + 0.5));
  return xs;
}
