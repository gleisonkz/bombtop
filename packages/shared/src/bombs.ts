import { FLAME_TICKS, FUSE_TICKS } from "./constants";
import { updateAir } from "./air";
import { playerElevated } from "./player-carry";
import { effectiveCapacity, effectiveFuse, effectiveRange } from "./curse";
import { updateSlides } from "./kick";
import { stageFuseTicks } from "./stage";
import { stageFlame } from "./stage-mechanics";
import { stageSolid } from "./stage-obstacles";
import { stopStageStickyBombs } from "./stage-surprise";
import { shieldAt } from "./special";
import { bombAt, Floor, getFloor, getTile, hasFlame, playerTile, setTile, Tile, type Bomb, type MatchState } from "./state";

const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

export function placeBomb(s: MatchState, playerId: string): boolean {
  const p = s.players.find((p) => p.id === playerId);
  if (!p || !p.alive || playerElevated(p) || p.curse?.kind === "constipation") return false;
  const { x, y } = playerTile(p);
  if (stageSolid(s, x, y) || getFloor(s, x, y) === Floor.Slot || s.stageState?.trolley?.riderId === p.id || s.stageState?.flights?.[p.id]) return false;
  if (bombAt(s, x, y)) return false;
  const active = s.bombs.filter((b) => b.ownerId === playerId && !b.mega).length;
  if (active >= effectiveCapacity(p)) return false;

  s.bombs.push({ ownerId: playerId, x, y, fuse: effectiveFuse(p), range: effectiveRange(p), type: p.bombType, slide: null, offset: 0, air: null, heldBy: null });
  return true;
}

/** Ticks fuses and flames, resolving explosions and chain reactions. */
export function updateBombs(s: MatchState): void {
  const rate = stageFuseTicks(s);
  for (const f of s.flames) {
    if ((f.ttl -= rate) <= 0 && f.block) setTile(s, f.x, f.y, Tile.Empty);
  }
  s.flames = s.flames.filter((f) => f.ttl > 0);

  stopStageStickyBombs(s);
  updateSlides(s);
  updateAir(s);
  s.bombs = s.bombs.filter(b => b.air || b.heldBy || getFloor(s, b.x, b.y) !== Floor.Pit);

  // A flying bomb's fuse waits for it to land, and a carried one's while it is held (as in Super Bomberman 4): it never
  // goes off in the air nor in the hands.
  for (const b of s.bombs) {
    // A remote stays armed while its owner can trigger it; abandoned bombs use their normal fuse.
    const remoteArmed = b.type === "remote" && s.players.some((p) => p.id === b.ownerId && p.alive);
    if (!remoteArmed && !b.air && !b.heldBy) b.fuse -= rate;
  }
  const queue = s.bombs.filter((b) => b.fuse <= 0 || (!b.air && !b.heldBy && hasFlame(s, b.x, b.y)));
  while (queue.length > 0) {
    explode(s, queue.shift()!, queue);
  }
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
  addFlame(s, bomb.x, bomb.y, bomb.ownerId);

  const reachedEnd = new Map<string, boolean>();
  const reflected: { dx: number; dy: number; by: string }[] = [];
  for (const [dx, dy] of DIRECTIONS) {
    const end = burnRay(s, bomb, dx, dy, 1, bomb.range, bomb.ownerId, queue);
    reachedEnd.set(`${dx},${dy}`, end === true);
    if (typeof end === "string") reflected.push({ dx, dy, by: end });
  }
  // A shield sends its arm back: the far arm burns on for another `range` tiles, as the captain's fire.
  for (const { dx, dy, by } of reflected) {
    if (reachedEnd.get(`${-dx},${-dy}`)) burnRay(s, bomb, -dx, -dy, bomb.range + 1, bomb.range * 2, by, queue);
  }
}

/**
 * Burns tiles `from`..`to` steps away from the bomb toward (dx,dy). Returns true
 * when the ray ran its full length, false when something stopped it, or the id of
 * the shielded captain it hit.
 */
function burnRay(s: MatchState, bomb: Bomb, dx: number, dy: number, from: number, to: number, ownerId: string, queue: Bomb[]): boolean | string {
  // Pierce flames run through blocks, items and bombs; only walls (and shields) stop them.
  const pierce = bomb.type === "pierce";
  for (let i = from; i <= to; i++) {
    const x = bomb.x + dx * i;
    const y = bomb.y + dy * i;
    const tile = getTile(s, x, y);
    if (tile === Tile.Wall) return false;
    const direction = dx > 0 ? "right" : dx < 0 ? "left" : dy > 0 ? "down" : "up";
    if (stageFlame(s, x, y, ownerId, direction)) return false;
    const shield = shieldAt(s, x, y, dx, dy);
    if (shield) return shield.id;
    addFlame(s, x, y, ownerId, tile === Tile.Block);
    if (tile === Tile.Block) {
      if (pierce) continue;
      return false;
    }
    const item = s.items.find((it) => it.x === x && it.y === y);
    if (item) {
      s.items = s.items.filter((it) => it !== item);
      if (!pierce) return false;
    }
    const hit = bombAt(s, x, y);
    if (hit) {
      queue.push(hit);
      if (!pierce) return false;
    }
  }
  return true;
}

/** Sets (x,y) on fire; `block` when it is a block burning away, which clears when the flame dies. */
export function addFlame(s: MatchState, x: number, y: number, ownerId: string, block = false): void {
  stageFlame(s, x, y, ownerId);
  const existing = s.flames.find((f) => f.x === x && f.y === y);
  if (existing) {
    existing.ttl = FLAME_TICKS;
    existing.ownerId = ownerId;
    if (block) existing.block = true;
  } else {
    s.flames.push(block ? { x, y, ttl: FLAME_TICKS, ownerId, block } : { x, y, ttl: FLAME_TICKS, ownerId });
  }
}
