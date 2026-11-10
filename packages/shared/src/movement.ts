import { TILE } from "./constants";
import { effectiveSpeed } from "./curse";
import { playerElevated } from "./player-carry";
import { stageTempoRate } from "./stage";
import { stageSolid } from "./stage-obstacles";
import { isSb2Stage } from "./sb2-stage";
import { moveSb2Player } from "./sb2-movement";
import { moveSb2Stage8Player } from "./sb2-stage8-controller";
import { moveSb2Stage6Player } from "./sb2-stage6-controller";
import { moveSb2Stage9Player } from "./sb2-stage9-controller";
import { moveSb2Stage2Player } from "./sb2-stage2-controller";
import { moveSb2Stage3Player } from "./sb2-stage3-controller";
import { bombAt, DIR_VECTORS, getTile, tileCenter, Tile, type Direction, type MatchState, type Player } from "./state";

export function canPlayerEnterTile(s: MatchState, p: Player, x: number, y: number): boolean {
  const tile = getTile(s, x, y);
  if (s.stage === "sb2-03" && (x === 3 || x === 11) && (y === -1 || y === 13)) return true;
  return !stageSolid(s, x, y) && (tile === Tile.Empty || (!!p.canBlockPass && tile === Tile.Block)) && (!!p.canBombPass || !bombAt(s, x, y));
}

function canKickAhead(s: MatchState, p: Player, x: number, y: number): boolean {
  return !p.canBombPass && (p.canKick || p.mount === "pusher") && !!bombAt(s, x, y);
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
/** Moves along `dir`, or along `alt` when `dir` makes no progress. Returns the direction used. */
export function steer(s: MatchState, p: Player, dir: Direction, alt: Direction): Direction {
  if (p.stun > 0) return null;
  const { px, py } = p;
  movePlayer(s, p, dir);
  if (s.stage === "sb2-02" && s.stageState?.sb2?.stage2Transport?.[p.id]) return p.facing;
  if (!alt || alt === dir || p.px !== px || p.py !== py) return dir;
  movePlayer(s, p, alt);
  return alt;
}

export function movePlayer(s: MatchState, p: Player, dir: Direction, speed = effectiveSpeed(p) * stageTempoRate(s)): void {
  if (isSb2Stage(s.stage)) {
    if (s.stage === "sb2-02") moveSb2Stage2Player(s, p, dir);
    else if (s.stage === "sb2-03") moveSb2Stage3Player(s, p, dir, speed / (TILE / 16));
    else if (s.stage === "sb2-08") moveSb2Stage8Player(s, p, dir, speed / (TILE / 16));
    else if (s.stage === "sb2-06") moveSb2Stage6Player(s, p, dir, speed / (TILE / 16));
    else if (s.stage === "sb2-09") moveSb2Stage9Player(s, p, dir, speed / (TILE / 16));
    else moveSb2Player(s, p, dir, speed / (TILE / 16));
    if (s.stage === "sb2-11") {
      // O limite de caminhada escreve so o inteiro, mantendo a fracao nativa.
      const scale = TILE / 16, x = p.px / scale + 8, y = p.py / scale + 24;
      p.px = (Math.max(32, Math.min(224, Math.floor(x))) + x % 1 - 8) * scale;
      p.py = (Math.max(48, Math.min(208, Math.floor(y))) + y % 1 - 24) * scale;
    }
    return;
  }
  if (!dir || !p.alive || playerElevated(p)) return;
  const [dx, dy] = DIR_VECTORS[dir];
  const horizontal = dx !== 0;
  const sign = horizontal ? dx : dy;

  let along = horizontal ? p.px : p.py;
  let across = horizontal ? p.py : p.px;
  const tileAt = (a: number, c: number) =>
    horizontal ? canPlayerEnterTile(s, p, a, c) : canPlayerEnterTile(s, p, c, a);

  const ta = Math.floor(along / TILE);
  const tc = Math.floor(across / TILE);
  const offset = across - tileCenter(tc);
  const aheadFree = tileAt(ta + sign, tc);
  let budget = speed;

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
      } else if (canKickAhead(s, p, horizontal ? ta + sign : tc, horizontal ? tc : ta + sign)) {
        // A bomb we can kick and no way around it: line up with it so the kick lands.
        across -= Math.sign(offset) * Math.min(Math.abs(offset), budget);
      }
      budget = 0;
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
