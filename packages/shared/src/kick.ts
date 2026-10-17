import { KICK_SPEED, TILE } from "./constants";
import {
  bombAt,
  DIR_VECTORS,
  getTile,
  playerTile,
  tileCenter,
  Tile,
  type Direction,
  type MatchState,
  type Player,
} from "./state";

/**
 * A player with kick who is pressed against a resting bomb (stopped at their
 * tile center, facing it) sends it sliding.
 */
export function tryKick(s: MatchState, p: Player, dir: Direction): void {
  if (!dir || !p.alive || !p.canKick) return;
  const { x, y } = playerTile(p);
  if (p.px !== tileCenter(x) || p.py !== tileCenter(y)) return;
  const [dx, dy] = DIR_VECTORS[dir];
  const bomb = bombAt(s, x + dx, y + dy);
  if (bomb && !bomb.slide) bomb.slide = dir;
}

/** A sliding bomb may enter empty tiles with no bomb and no living player. */
function freeForBomb(s: MatchState, x: number, y: number): boolean {
  if (getTile(s, x, y) !== Tile.Empty || bombAt(s, x, y)) return false;
  return !s.players.some((p) => {
    if (!p.alive) return false;
    const t = playerTile(p);
    return t.x === x && t.y === y;
  });
}

export function updateSlides(s: MatchState): void {
  for (const b of s.bombs) {
    if (!b.slide) continue;
    const [dx, dy] = DIR_VECTORS[b.slide];
    if (!freeForBomb(s, b.x + dx, b.y + dy)) {
      b.slide = null;
      b.offset = 0;
      continue;
    }
    b.offset += KICK_SPEED;
    if (b.offset >= TILE) {
      b.x += dx;
      b.y += dy;
      b.offset -= TILE;
    }
  }
}
