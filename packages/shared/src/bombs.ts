import { FLAME_TICKS, FUSE_TICKS } from "./constants";
import { bombAt, getTile, playerTile, setTile, Tile, type Bomb, type MatchState } from "./state";

const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

export function placeBomb(s: MatchState, playerId: string): boolean {
  const p = s.players.find((p) => p.id === playerId);
  if (!p || !p.alive) return false;
  const { x, y } = playerTile(p);
  if (bombAt(s, x, y)) return false;
  const active = s.bombs.filter((b) => b.ownerId === playerId).length;
  if (active >= p.bombCapacity) return false;

  s.bombs.push({ ownerId: playerId, x, y, fuse: FUSE_TICKS, range: p.fireRange });
  return true;
}

/** Ticks fuses and flames, resolving explosions and chain reactions. */
export function updateBombs(s: MatchState): void {
  for (const f of s.flames) f.ttl--;
  s.flames = s.flames.filter((f) => f.ttl > 0);

  for (const b of s.bombs) b.fuse--;
  const queue = s.bombs.filter((b) => b.fuse <= 0);
  while (queue.length > 0) {
    explode(s, queue.shift()!, queue);
  }
}

function explode(s: MatchState, bomb: Bomb, queue: Bomb[]): void {
  if (!s.bombs.includes(bomb)) return;
  s.bombs = s.bombs.filter((b) => b !== bomb);
  addFlame(s, bomb.x, bomb.y);

  for (const [dx, dy] of DIRECTIONS) {
    for (let i = 1; i <= bomb.range; i++) {
      const x = bomb.x + dx * i;
      const y = bomb.y + dy * i;
      const tile = getTile(s, x, y);
      if (tile === Tile.Wall) break;
      addFlame(s, x, y);
      if (tile === Tile.Block) {
        setTile(s, x, y, Tile.Empty);
        break;
      }
      const hit = bombAt(s, x, y);
      if (hit) {
        queue.push(hit);
        break;
      }
    }
  }
}

function addFlame(s: MatchState, x: number, y: number): void {
  const existing = s.flames.find((f) => f.x === x && f.y === y);
  if (existing) existing.ttl = FLAME_TICKS;
  else s.flames.push({ x, y, ttl: FLAME_TICKS });
}
