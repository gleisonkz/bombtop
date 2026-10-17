import { FLAME_TICKS, FUSE_TICKS } from "./constants";
import { updateAir } from "./air";
import { updateSlides } from "./kick";
import { bombAt, getTile, playerTile, setTile, Tile, type Bomb, type MatchState } from "./state";

const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

export function placeBomb(s: MatchState, playerId: string): boolean {
  const p = s.players.find((p) => p.id === playerId);
  if (!p || !p.alive) return false;
  const { x, y } = playerTile(p);
  if (bombAt(s, x, y)) return false;
  const active = s.bombs.filter((b) => b.ownerId === playerId).length;
  if (active >= p.bombCapacity) return false;

  s.bombs.push({ ownerId: playerId, x, y, fuse: FUSE_TICKS, range: p.fireRange, type: p.bombType, slide: null, offset: 0, air: null, heldBy: null });
  return true;
}

/** Ticks fuses and flames, resolving explosions and chain reactions. */
export function updateBombs(s: MatchState): void {
  for (const f of s.flames) f.ttl--;
  s.flames = s.flames.filter((f) => f.ttl > 0);

  updateSlides(s);
  updateAir(s);

  for (const b of s.bombs) {
    if (!b.air && !b.heldBy && !isHeldByRemote(s, b)) b.fuse--;
  }
  const queue = s.bombs.filter((b) => b.fuse <= 0);
  while (queue.length > 0) {
    explode(s, queue.shift()!, queue);
  }
}

/** Remote bombs wait for their owner's signal; if the owner dies they fall back to a normal fuse. */
function isHeldByRemote(s: MatchState, b: Bomb): boolean {
  return b.type === "remote" && !!s.players.find((p) => p.id === b.ownerId)?.alive;
}

/**
 * Arms the player's oldest grounded remote bomb to explode on this tick's
 * bomb update. Returns false when there was none.
 */
export function detonateRemote(s: MatchState, playerId: string): boolean {
  const bomb = s.bombs.find((b) => b.ownerId === playerId && b.type === "remote" && b.fuse > 0 && !b.air);
  if (bomb) bomb.fuse = 0;
  return !!bomb;
}

function explode(s: MatchState, bomb: Bomb, queue: Bomb[]): void {
  if (!s.bombs.includes(bomb)) return;
  s.bombs = s.bombs.filter((b) => b !== bomb);
  addFlame(s, bomb.x, bomb.y);
  // Pierce flames run through blocks, items and bombs; only walls stop them.
  const pierce = bomb.type === "pierce";

  for (const [dx, dy] of DIRECTIONS) {
    for (let i = 1; i <= bomb.range; i++) {
      const x = bomb.x + dx * i;
      const y = bomb.y + dy * i;
      const tile = getTile(s, x, y);
      if (tile === Tile.Wall) break;
      addFlame(s, x, y);
      if (tile === Tile.Block) {
        setTile(s, x, y, Tile.Empty);
        if (pierce) continue;
        break;
      }
      const item = s.items.find((it) => it.x === x && it.y === y);
      if (item) {
        s.items = s.items.filter((it) => it !== item);
        if (!pierce) break;
      }
      const hit = bombAt(s, x, y);
      if (hit) {
        queue.push(hit);
        if (!pierce) break;
      }
    }
  }
}

function addFlame(s: MatchState, x: number, y: number): void {
  const existing = s.flames.find((f) => f.x === x && f.y === y);
  if (existing) existing.ttl = FLAME_TICKS;
  else s.flames.push({ x, y, ttl: FLAME_TICKS });
}
