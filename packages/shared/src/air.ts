import { AIR_DISTANCE, AIR_TICKS_PER_TILE, STUN_TICKS } from "./constants";
import { bombAt, DIR_VECTORS, getTile, playerTile, Tile, type Bomb, type Facing, type MatchState, type Player } from "./state";

/** Launches a grounded bomb into the air from its current tile. */
export function launch(b: Bomb, dir: Facing): void {
  b.air = { dir, tilesLeft: AIR_DISTANCE, progress: 0 };
  b.slide = null;
  b.offset = 0;
}

/** Punches the grounded bomb on the tile the player is facing. Returns false if there was none. */
export function punch(s: MatchState, p: Player): boolean {
  if (!p.alive || !p.canPunch) return false;
  const { x, y } = playerTile(p);
  const [dx, dy] = DIR_VECTORS[p.facing];
  const bomb = bombAt(s, x + dx, y + dy);
  if (bomb) launch(bomb, p.facing);
  return !!bomb;
}

/**
 * Bomb button with the glove: throws the carried bomb, or lifts the bomb
 * the player stands on. Returns false when neither applies (caller then
 * places a bomb as usual).
 */
export function useGlove(s: MatchState, p: Player): boolean {
  const held = s.bombs.find((b) => b.heldBy === p.id);
  if (held) {
    held.heldBy = null;
    launch(held, p.facing);
    return true;
  }
  if (!p.alive || !p.canGlove) return false;
  const { x, y } = playerTile(p);
  const bomb = bombAt(s, x, y);
  if (!bomb) return false;
  bomb.heldBy = p.id;
  return true;
}

/** Carried bombs follow their holder; a dead holder drops them on the spot. */
export function updateHeldBombs(s: MatchState): void {
  for (const b of s.bombs) {
    if (!b.heldBy) continue;
    const holder = s.players.find((p) => p.id === b.heldBy);
    if (!holder) continue;
    const { x, y } = playerTile(holder);
    b.x = x;
    b.y = y;
    if (!holder.alive) b.heldBy = null;
  }
}

/** Moves one tile, wrapping around the border walls to the opposite side. */
function hop(s: MatchState, b: Bomb, dir: Facing): void {
  const [dx, dy] = DIR_VECTORS[dir];
  const { width, height } = s.grid;
  b.x += dx;
  b.y += dy;
  if (b.x <= 0) b.x = width - 2;
  if (b.x >= width - 1) b.x = 1;
  if (b.y <= 0) b.y = height - 2;
  if (b.y >= height - 1) b.y = 1;
}

/**
 * Advances airborne bombs. On reaching their target they land on a free
 * tile; solid tiles, grounded bombs and players make them bounce one tile
 * further (stunning the player hit).
 */
export function updateAir(s: MatchState): void {
  for (const b of s.bombs) {
    const air = b.air;
    if (!air) continue;
    if (++air.progress < AIR_TICKS_PER_TILE) continue;
    air.progress = 0;
    hop(s, b, air.dir);
    if (--air.tilesLeft > 0) continue;

    const hit = s.players.find((p) => {
      const t = playerTile(p);
      return p.alive && t.x === b.x && t.y === b.y;
    });
    if (hit) hit.stun = STUN_TICKS;
    if (hit || getTile(s, b.x, b.y) !== Tile.Empty || bombAt(s, b.x, b.y)) {
      air.tilesLeft = 1;
      continue;
    }
    b.air = null;
  }
}
