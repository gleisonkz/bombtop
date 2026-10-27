import { cursedDirection, effectiveSpeed } from "./curse";
import { movePlayer, steer } from "./movement";
import type { StageSurpriseKind as SurpriseKind } from "./stage-state";
import { moveIcePlayer } from "./stage-ice";
import { stageTempoRate } from "./stage";
import { Floor, getFloor, playerTile, type Direction, type Facing, type MatchState, type Player, type PlayerInput } from "./state";

export { igniteSurpriseFloor, initializeSurpriseSelection } from "./stage-surprise-flames";

/** ROM: 1C08 halves base movement; 1C0C refreshes 64 quarter-rate reverse counts. */
export const SURPRISE_CONFIG = { stickySpeedScale: 0.5, reverseTicks: 256 } as const;

const KINDS = ["normal", "ice", "sticky", "reverse"] as const;
const DIRECTIONS: readonly Facing[] = ["up", "down", "left", "right"];

function clearVisit(locks: Record<string, number>, id: string): void {
  delete locks[`surprise:entry:${id}`];
}

function floorKind(s: MatchState, p: Player): SurpriseKind {
  const { x, y } = playerTile(p);
  if (getFloor(s, x, y) !== Floor.Surprise) return "normal";
  return s.stageState?.surprise?.[y * s.grid.width + x]?.kind ?? "normal";
}

function isBusy(s: MatchState, p: Player, input?: PlayerInput): boolean {
  return p.stun > 0 || p.webbed > 0 || p.shield > 0 || p.charge > 0
    || p.rasengan > 0 || p.truck > 0 || p.jumpTicks > 0 || p.dashTicks > 0
    || !!p.shove || !!input?.brace || !!s.stageState?.flights?.[p.id];
}

function startVisit(s: MatchState, p: Player, kind: SurpriseKind, locks: Record<string, number>): void {
  const { x, y } = playerTile(p);
  const entry = (y * s.grid.width + x) * KINDS.length + KINDS.indexOf(kind);
  const key = `surprise:entry:${p.id}`;
  if (locks[key] === entry) return;
  locks[key] = entry;
}

function reverse(dir: Direction): Direction {
  return dir ? DIRECTIONS[DIRECTIONS.indexOf(dir) ^ 1]! : null;
}

function floorDirection(s: MatchState, p: Player, dir: Direction): Direction {
  const intended = cursedDirection(p, dir);
  const until = s.stageState?.floorLocks?.[`surprise:reverse:${p.id}`] ?? 0;
  return s.tick < until && p.curse?.kind !== "reverse" ? reverse(intended) : intended;
}

function moveOnFloor(s: MatchState, p: Player, kind: SurpriseKind, input: PlayerInput | undefined): void {
  let dir = floorDirection(s, p, input?.dir ?? null);
  const alt = floorDirection(s, p, input?.alt ?? null);
  if (kind === "sticky") {
    const speed = effectiveSpeed(p) * stageTempoRate(s) * SURPRISE_CONFIG.stickySpeedScale;
    const { px, py } = p;
    movePlayer(s, p, dir, speed);
    if (alt && p.px === px && p.py === py) {
      movePlayer(s, p, alt, speed);
      dir = alt;
    }
  } else dir = steer(s, p, dir, alt);
  if (dir) p.facing = dir;
}

/** Maintenance only: safe before updateSlides and again after stage updates. */
export function stopStageStickyBombs(s: MatchState): void {
  if (String(s.stage) !== "sb4-06") return;
  for (const b of s.bombs) {
    if (!b.slide || b.air || b.heldBy || b.conveyor || getFloor(s, b.x, b.y) !== Floor.Surprise) continue;
    if (s.stageState?.surprise?.[b.y * s.grid.width + b.x]?.kind !== "sticky") continue;
    b.slide = null;
    b.offset = 0;
  }
}

/**
 * Replaces steer for one player; true means floor movement was assumed, even if blocked.
 * Input is raw: existing curses are read, never replaced. Facing is the selected direction.
 * Numeric locks store tile/kind entry, reverse deadline and last move tick.
 * Typed iceSlides retain their destination after the player leaves an ice tile.
 */
export function moveSurprisePlayer(s: MatchState, p: Player, input?: PlayerInput, entryFacing = p.facing): boolean {
  if (String(s.stage) !== "sb4-06") return false;
  const stage = s.stageState ??= {};
  const locks = stage.floorLocks ??= {};
  const key = `surprise:move:${p.id}`;
  if (!p.alive) {
    if (stage.iceSlides) delete stage.iceSlides[p.id];
    clearVisit(locks, p.id);
    delete locks[`surprise:reverse:${p.id}`];
    delete locks[key];
    return false;
  }
  if (locks[key] === s.tick) return true;
  const kind = floorKind(s, p);
  const sliding = !!stage.iceSlides?.[p.id];
  const reverseKey = `surprise:reverse:${p.id}`;
  if (kind === "reverse") {
    // Native C24CB4 decrements on a global four-update phase; refresh on contact.
    locks[reverseKey] = s.tick - s.tick % 4 + SURPRISE_CONFIG.reverseTicks;
  }
  if (kind === "normal" && !sliding && s.tick >= (locks[reverseKey] ?? 0)) {
    clearVisit(locks, p.id);
    delete locks[reverseKey];
    delete locks[key];
    return false;
  }
  locks[key] = s.tick;
  startVisit(s, p, kind, locks);
  if (!isBusy(s, p, input)) {
    if (sliding || kind === "ice") {
      if (!moveIcePlayer(s, p, entryFacing)) moveOnFloor(s, p, "normal", input);
    } else moveOnFloor(s, p, kind, input);
    if (floorKind(s, p) !== kind) clearVisit(locks, p.id);
  }
  return true;
}

/** Standalone movement wrapper for tests/tools. Do not call after ordinary steering. */
export function updateSurpriseFloors(s: MatchState, inputs: Record<string, PlayerInput>): Set<string> {
  const handled = new Set<string>();
  stopStageStickyBombs(s);
  for (const p of s.players) {
    if (moveSurprisePlayer(s, p, inputs[p.id])) handled.add(p.id);
  }
  return handled;
}
