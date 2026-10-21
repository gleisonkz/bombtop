import { addFlame } from "./bombs";
import { BLAST_TICKS, BOLT_RANGE, BOLT_STUN_TICKS, FREEZE_TICKS, ICE_RANGE, KAME_CHARGE, KAME_COOLDOWN, KAME_RANGE, SHIELD_TICKS, SPECIAL_COOLDOWN } from "./constants";
import { bombAt, DIR_VECTORS, getTile, playerTile, setTile, Tile, type BlastKind, type Facing, type MatchState, type Player } from "./state";

const OPPOSITE: Record<Facing, Facing> = { up: "down", down: "up", left: "right", right: "left" };

/**
 * The player's special, when ready. Ninja: an ice blast straight ahead that
 * freezes the first player within ICE_RANGE tiles; walls, blocks and bombs stop it.
 * Thor: a lightning bolt the same way that stuns the first player within BOLT_RANGE tiles.
 * Captain: raises his shield for SHIELD_TICKS (see `shieldAt`).
 * Goku: charges for KAME_CHARGE ticks, then fires the Kamehameha (see `kamehameha`).
 */
export function useSpecial(s: MatchState, p: Player): boolean {
  if (p.specialCooldown > 0) return false;
  if (p.character === "captain") {
    p.shield = SHIELD_TICKS;
  } else if (p.character === "ninja") {
    blast(s, "ice", p.id, playerTile(p), p.facing, true);
  } else if (p.character === "thor") {
    blast(s, "lightning", p.id, playerTile(p), p.facing, true);
  } else if (p.character === "goku") {
    p.charge = KAME_CHARGE;
    p.specialCooldown = KAME_COOLDOWN;
    return true;
  } else {
    return false;
  }
  p.specialCooldown = SPECIAL_COOLDOWN;
  return true;
}

/**
 * The shielded captain on (x,y) facing something that travels (dx,dy) toward him,
 * which then hits the shield instead of him.
 */
export function shieldAt(s: MatchState, x: number, y: number, dx: number, dy: number): Player | undefined {
  return s.players.find((o) => {
    if (!o.alive || o.shield <= 0) return false;
    const t = playerTile(o);
    const [fx, fy] = DIR_VECTORS[o.facing];
    return t.x === x && t.y === y && fx === -dx && fy === -dy;
  });
}

/** What each blast does: how far it reaches and what it does to the first player it hits. */
const BLASTS: Record<Exclude<BlastKind, "kamehameha">, { range: number; strike: (p: Player) => void }> = {
  ice: { range: ICE_RANGE, strike: (p) => (p.frozen = FREEZE_TICKS) },
  lightning: { range: BOLT_RANGE, strike: (p) => (p.stun = BOLT_STUN_TICKS) },
};

/** A blast from (x,y) toward `dir`; a shield it meets sends it back once. */
function blast(s: MatchState, kind: keyof typeof BLASTS, ownerId: string, from: { x: number; y: number }, dir: Facing, canReflect: boolean): void {
  const { range, strike } = BLASTS[kind];
  const [dx, dy] = DIR_VECTORS[dir];
  let length = 0;
  let reflector: Player | undefined;
  for (let i = 1; i <= range; i++) {
    const tx = from.x + dx * i;
    const ty = from.y + dy * i;
    if (getTile(s, tx, ty) !== Tile.Empty || bombAt(s, tx, ty)) break;
    length = i;
    const shield = shieldAt(s, tx, ty, dx, dy);
    if (shield) {
      if (canReflect) reflector = shield;
      break;
    }
    const hit = s.players.find((o) => o.id !== ownerId && o.alive && playerTile(o).x === tx && playerTile(o).y === ty);
    if (hit) {
      strike(hit);
      break;
    }
  }
  s.blasts.push({ ownerId, x: from.x, y: from.y, dir, length, ttl: BLAST_TICKS, kind });
  if (reflector) blast(s, kind, reflector.id, playerTile(reflector), OPPOSITE[dir], false);
}

/**
 * Goku's Kamehameha from (x,y) toward `dir`: fire on every tile up to KAME_RANGE, through blocks
 * (breaking them) and bombs (setting them off), up to the first player in its way, who burns in it;
 * walls stop it, and a shield sends it back once.
 */
export function kamehameha(s: MatchState, ownerId: string, from: { x: number; y: number }, dir: Facing, canReflect: boolean): void {
  const [dx, dy] = DIR_VECTORS[dir];
  let length = 0;
  let reflector: Player | undefined;
  for (let i = 1; i <= KAME_RANGE; i++) {
    const tx = from.x + dx * i;
    const ty = from.y + dy * i;
    const tile = getTile(s, tx, ty);
    if (tile === Tile.Wall) break;
    const shield = shieldAt(s, tx, ty, dx, dy);
    if (shield) {
      if (canReflect) reflector = shield;
      break;
    }
    length = i;
    addFlame(s, tx, ty, ownerId);
    if (tile === Tile.Block) setTile(s, tx, ty, Tile.Empty);
    const bomb = bombAt(s, tx, ty);
    if (bomb) bomb.fuse = 0;
    if (s.players.some((o) => o.id !== ownerId && o.alive && playerTile(o).x === tx && playerTile(o).y === ty)) break;
  }
  s.blasts.push({ ownerId, x: from.x, y: from.y, dir, length, ttl: BLAST_TICKS, kind: "kamehameha" });
  if (reflector) kamehameha(s, reflector.id, playerTile(reflector), OPPOSITE[dir], false);
}

/** Blasts fade after BLAST_TICKS. */
export function updateBlasts(s: MatchState): void {
  for (const b of s.blasts) b.ttl--;
  s.blasts = s.blasts.filter((b) => b.ttl > 0);
}
