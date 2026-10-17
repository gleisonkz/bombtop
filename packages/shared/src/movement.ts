import { TILE } from "./constants";
import { bombAt, getTile, tileCenter, Tile, type Direction, type MatchState, type Player } from "./state";

const VECTORS = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
} as const;

function passable(s: MatchState, x: number, y: number): boolean {
  return getTile(s, x, y) === Tile.Empty && !bombAt(s, x, y);
}

/**
 * Moves a player one tick in `dir`, with grid collision and corner sliding.
 *
 * Works on a generic (along, across) axis pair so the same rules apply to all
 * four directions: `along` is the movement axis, `across` the perpendicular one.
 * A player may only advance past a tile center when the next tile is passable,
 * and must be aligned to a lane before doing so. When off-center, it first
 * slides toward the lane it can actually enter.
 */
export function movePlayer(s: MatchState, p: Player, dir: Direction): void {
  if (!dir || !p.alive) return;
  const [dx, dy] = VECTORS[dir];
  const horizontal = dx !== 0;
  const sign = horizontal ? dx : dy;

  let along = horizontal ? p.px : p.py;
  let across = horizontal ? p.py : p.px;
  const tileAt = (a: number, c: number) =>
    horizontal ? passable(s, a, c) : passable(s, c, a);

  const ta = Math.floor(along / TILE);
  const tc = Math.floor(across / TILE);
  const offset = across - tileCenter(tc);
  const aheadFree = tileAt(ta + sign, tc);
  let budget = p.speed;

  if (offset !== 0) {
    if (aheadFree) {
      const step = Math.min(Math.abs(offset), budget);
      across -= Math.sign(offset) * step;
      budget -= step;
    } else {
      const lane = tc + Math.sign(offset);
      if (tileAt(ta + sign, lane) && tileAt(ta, lane)) {
        const target = tileCenter(lane);
        const step = Math.min(Math.abs(target - across), budget);
        across += Math.sign(target - across) * step;
        budget = 0;
      }
    }
  }

  if (budget > 0) {
    let next = along + sign * budget;
    const aligned = across === tileCenter(tc);
    if (!aheadFree || !aligned) {
      // Can't leave this tile: go no further than its center (never backwards).
      const c = tileCenter(ta);
      next = sign > 0 ? Math.max(along, Math.min(next, c)) : Math.min(along, Math.max(next, c));
    }
    along = next;
  }

  if (horizontal) {
    p.px = along;
    p.py = across;
  } else {
    p.py = along;
    p.px = across;
  }
}
