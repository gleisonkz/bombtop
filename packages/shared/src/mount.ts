import { DASH_SPEED, DASH_TICKS, INVULN_TICKS, JUMP_SPEED, JUMP_TICKS } from "./constants";
import { movePlayer } from "./movement";
import { nextRandom } from "./rng";
import {
  bombAt,
  DIR_VECTORS,
  getTile,
  playerTile,
  tileCenter,
  Tile,
  type MatchState,
  type MountKind,
  type Player,
} from "./state";

export const MOUNTS: readonly MountKind[] = ["hopper", "dasher", "pusher"];

export function giveRandomMount(s: MatchState, p: Player): void {
  if (p.mount) return;
  p.mount = MOUNTS[Math.floor(nextRandom(s) * MOUNTS.length)]!;
}

/**
 * Applies a lethal hit: invulnerable players shrug it off, mounted riders
 * lose the mount. Returns true if the player died.
 */
export function hurt(p: Player): boolean {
  if (!p.alive || p.invuln > 0) return false;
  if (p.mount) {
    p.mount = null;
    p.invuln = INVULN_TICKS;
    return false;
  }
  p.alive = false;
  return true;
}

/** The mount's special move on the action button. Returns false if nothing happened. */
export function useMountAbility(s: MatchState, p: Player): boolean {
  if (!p.alive || !p.mount) return false;
  if (p.mount === "dasher") {
    p.dashTicks = DASH_TICKS;
    return true;
  }
  if (p.mount === "hopper") {
    const { x, y } = playerTile(p);
    const [dx, dy] = DIR_VECTORS[p.facing];
    const tx = x + dx * 2;
    const ty = y + dy * 2;
    if (getTile(s, tx, ty) !== Tile.Empty || bombAt(s, tx, ty)) return false;
    p.px = tileCenter(x);
    p.py = tileCenter(y);
    p.jumpTicks = JUMP_TICKS;
    return true;
  }
  return false;
}

/**
 * Advances an in-progress jump or dash. Returns true while the player is
 * busy (their regular input is ignored this tick).
 */
export function updateMountMove(s: MatchState, p: Player): boolean {
  if (p.jumpTicks > 0) {
    const [dx, dy] = DIR_VECTORS[p.facing];
    p.px += dx * JUMP_SPEED;
    p.py += dy * JUMP_SPEED;
    p.jumpTicks--;
    return true;
  }
  if (p.dashTicks > 0) {
    movePlayer(s, p, p.facing, DASH_SPEED);
    p.dashTicks--;
    return true;
  }
  return false;
}
