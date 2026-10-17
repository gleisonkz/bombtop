import { AIR_DISTANCE, AIR_TICKS_PER_TILE, STUN_TICKS } from "./constants";
import { bombAt, DIR_VECTORS, getTile, playerTile, Tile, type Bomb, type Facing, type MatchState, type Player } from "./state";

/** Launches a grounded bomb into the air from its current tile. */
export function launch(b: Bomb, dir: Facing): void {
  b.air = { dir, tilesLeft: AIR_DISTANCE, progress: 0 };
  b.slide = null;
  b.offset = 0;
}

/** Punches the grounded bomb on the tile the player is facing. */
export function punch(s: MatchState, p: Player): void {
  if (!p.alive || !p.canPunch) return;
  const { x, y } = playerTile(p);
  const [dx, dy] = DIR_VECTORS[p.facing];
  const bomb = bombAt(s, x + dx, y + dy);
  if (bomb) launch(bomb, p.facing);
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
