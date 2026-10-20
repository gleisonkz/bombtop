import { BLAST_TICKS, FREEZE_TICKS, ICE_RANGE, SHIELD_TICKS, SPECIAL_COOLDOWN } from "./constants";
import { bombAt, DIR_VECTORS, getTile, playerTile, Tile, type Facing, type MatchState, type Player } from "./state";

const OPPOSITE: Record<Facing, Facing> = { up: "down", down: "up", left: "right", right: "left" };

/**
 * The player's special, when ready. Ninja: an ice blast straight ahead that
 * freezes the first player within ICE_RANGE tiles; walls, blocks and bombs stop it.
 * Captain: raises his shield for SHIELD_TICKS (see `shieldAt`).
 */
export function useSpecial(s: MatchState, p: Player): boolean {
  if (p.specialCooldown > 0) return false;
  if (p.character === "captain") {
    p.shield = SHIELD_TICKS;
  } else if (p.character === "ninja") {
    iceBlast(s, p.id, playerTile(p), p.facing, true);
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

/** An ice blast from (x,y) toward `dir`; a shield it meets sends it back once. */
function iceBlast(s: MatchState, ownerId: string, from: { x: number; y: number }, dir: Facing, canReflect: boolean): void {
  const [dx, dy] = DIR_VECTORS[dir];
  let length = 0;
  let reflector: Player | undefined;
  for (let i = 1; i <= ICE_RANGE; i++) {
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
      hit.frozen = FREEZE_TICKS;
      break;
    }
  }
  s.blasts.push({ ownerId, x: from.x, y: from.y, dir, length, ttl: BLAST_TICKS });
  if (reflector) iceBlast(s, reflector.id, playerTile(reflector), OPPOSITE[dir], false);
}

/** Blasts fade after BLAST_TICKS. */
export function updateBlasts(s: MatchState): void {
  for (const b of s.blasts) b.ttl--;
  s.blasts = s.blasts.filter((b) => b.ttl > 0);
}
