import { AIR_DISTANCE, AIR_TICKS_PER_TILE, STUN_TICKS } from "./constants";
import { placeBomb } from "./bombs";
import { playerCarryButton, playerElevated } from "./player-carry";
import { bombAt, DIR_VECTORS, getTile, playerTile, Tile, type Bomb, type Facing, type MatchState, type Player, type PlayerInput } from "./state";

/** Launches a grounded bomb into the air from its current tile. */
export function launch(b: Bomb, dir: Facing): void {
  b.air = { dir, span: AIR_DISTANCE, tilesLeft: AIR_DISTANCE, progress: 0 };
  b.slide = null;
  b.offset = 0;
  delete b.conveyor;
  delete b.kickedBy;
}

/** Punches the grounded bomb on the tile the player is facing. Returns false if there was none. */
export function punch(s: MatchState, p: Player): boolean {
  if (!p.alive || !p.canPunch || p.mount || playerElevated(p)) return false;
  const { x, y } = playerTile(p);
  const [dx, dy] = DIR_VECTORS[p.facing];
  const bomb = bombAt(s, x + dx, y + dy);
  if (bomb) launch(bomb, p.facing);
  return !!bomb;
}

/**
 * The bomb button, glove included: a carried bomb is thrown once the button
 * is let go; a press on your own bomb lifts it; any other press places one.
 */
export function bombButton(s: MatchState, p: Player, input: PlayerInput, inputs: Record<string, PlayerInput> = {}): void {
  if (!p.alive || playerElevated(p)) return;
  const held = s.bombs.find((b) => b.heldBy === p.id);
  if (held) {
    if (input.hold) return;
    held.heldBy = null;
    launch(held, p.facing);
    return;
  }
  if (playerCarryButton(s, p, input, inputs)) return;
  if (!input.bomb) return;
  if (!lift(s, p)) placeBomb(s, p.id);
}

/** Lifts the bomb the player stands on, if they have the glove. */
function lift(s: MatchState, p: Player): boolean {
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

/** Moves one tile, wrapping around the border walls to the opposite side. Returns true if it wrapped. */
function hop(s: MatchState, b: Bomb, dir: Facing): boolean {
  const [dx, dy] = DIR_VECTORS[dir];
  const { width, height } = s.grid;
  const [x, y] = [b.x + dx, b.y + dy];
  b.x = x <= 0 ? width - 2 : x >= width - 1 ? 1 : x;
  b.y = y <= 0 ? height - 2 : y >= height - 1 ? 1 : y;
  return b.x !== x || b.y !== y;
}

/**
 * Advances airborne bombs. On reaching their target they land on a free
 * tile; solid tiles, grounded bombs and players make them bounce one tile
 * further (stunning the player hit, unless they carry a bomb).
 */
export function updateAir(s: MatchState): void {
  for (const b of s.bombs) {
    const air = b.air;
    if (!air) continue;
    if (++air.progress < AIR_TICKS_PER_TILE) continue;
    air.progress = 0;
    // Coming in from across the arena, it comes down on the first tile (as in Super Bomberman 4).
    if (hop(s, b, air.dir)) air.span = air.tilesLeft = 1;
    if (--air.tilesLeft > 0) continue;

    const hit = s.players.find((p) => {
      const t = playerTile(p);
      return p.alive && !playerElevated(p) && t.x === b.x && t.y === b.y;
    });
    // Someone carrying a bomb overhead takes the hit on it: it bounces on, nobody is stunned.
    if (hit && !s.bombs.some((o) => o.heldBy === hit.id)) hit.stun = STUN_TICKS;
    if (hit || getTile(s, b.x, b.y) !== Tile.Empty || bombAt(s, b.x, b.y)) {
      air.span = air.tilesLeft = 1;
      continue;
    }
    b.air = null;
  }
}
