import { BLAST_TICKS, FREEZE_TICKS, ICE_RANGE, SPECIAL_COOLDOWN } from "./constants";
import { bombAt, DIR_VECTORS, getTile, playerTile, Tile, type MatchState, type Player } from "./state";

/**
 * The player's special, when ready. Ninja: an ice blast straight ahead that
 * freezes the first player within ICE_RANGE tiles; walls, blocks and bombs stop it.
 */
export function useSpecial(s: MatchState, p: Player): boolean {
  if (p.character !== "ninja" || p.specialCooldown > 0) return false;
  const { x, y } = playerTile(p);
  const [dx, dy] = DIR_VECTORS[p.facing];
  let length = 0;
  for (let i = 1; i <= ICE_RANGE; i++) {
    const tx = x + dx * i;
    const ty = y + dy * i;
    if (getTile(s, tx, ty) !== Tile.Empty || bombAt(s, tx, ty)) break;
    length = i;
    const hit = s.players.find((o) => o !== p && o.alive && playerTile(o).x === tx && playerTile(o).y === ty);
    if (hit) {
      hit.frozen = FREEZE_TICKS;
      break;
    }
  }
  s.blasts.push({ ownerId: p.id, x, y, dir: p.facing, length, ttl: BLAST_TICKS });
  p.specialCooldown = SPECIAL_COOLDOWN;
  return true;
}

/** Blasts fade after BLAST_TICKS. */
export function updateBlasts(s: MatchState): void {
  for (const b of s.blasts) b.ttl--;
  s.blasts = s.blasts.filter((b) => b.ttl > 0);
}
