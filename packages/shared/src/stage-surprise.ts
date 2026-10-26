import { cursedDirection, effectiveSpeed } from "./curse";
import { movePlayer, steer } from "./movement";
import { nextRandom } from "./rng";
import { stageTempoRate } from "./stage";
import { Floor, getFloor, playerTile, type Direction, type Facing, type MatchState, type Player, type PlayerInput } from "./state";

/** Provisional tuning, not measured SNES timing. Reverse ends on leaving its tile. */
export const SURPRISE_CONFIG = { stickySpeedScale: 0.5, reverseTicks: 120 } as const;

const KINDS = ["normal", "ice", "sticky", "reverse"] as const;
const DIRECTIONS: readonly Facing[] = ["up", "down", "left", "right"];
type SurpriseKind = (typeof KINDS)[number];

/** Each flame tick changes a tile once. Choosing another state is a provisional rule. */
export function igniteSurpriseFloor(s: MatchState, x: number, y: number): void {
  if (String(s.stage) !== "sb4-06" || getFloor(s, x, y) !== Floor.Surprise) return;
  const stage = s.stageState ??= {};
  const locks = stage.floorLocks ??= {};
  const index = y * s.grid.width + x;
  const key = `surprise:hit:${index}`;
  if (locks[key] === s.tick) return;
  const floors = stage.surprise ??= {};
  const current = floors[index] ?? { kind: "normal", hits: 0 };
  const choices = KINDS.filter(kind => kind !== current.kind);
  floors[index] = { kind: choices[Math.floor(nextRandom(s) * choices.length)]!, hits: current.hits + 1 };
  locks[key] = s.tick;
}

function clearVisit(locks: Record<string, number>, id: string): void {
  delete locks[`surprise:entry:${id}`];
  delete locks[`surprise:momentum:${id}`];
  delete locks[`surprise:reverse:${id}`];
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
  if (kind !== "ice") delete locks[`surprise:momentum:${p.id}`];
  if (kind === "reverse") locks[`surprise:reverse:${p.id}`] = s.tick + SURPRISE_CONFIG.reverseTicks;
  else delete locks[`surprise:reverse:${p.id}`];
}

function reverse(dir: Direction): Direction {
  return dir ? DIRECTIONS[DIRECTIONS.indexOf(dir) ^ 1]! : null;
}

function slide(s: MatchState, p: Player, input: PlayerInput | undefined, locks: Record<string, number>): void {
  const key = `surprise:momentum:${p.id}`;
  const stored = locks[key];
  const dir = stored === undefined ? cursedDirection(p, input?.dir ?? p.facing) : DIRECTIONS[stored]!;
  if (!dir) return;
  const { px, py } = p;
  p.facing = dir;
  movePlayer(s, p, dir);
  if (p.px === px && p.py === py) delete locks[key];
  else locks[key] = DIRECTIONS.indexOf(dir);
}

function moveOnFloor(s: MatchState, p: Player, kind: SurpriseKind, input: PlayerInput | undefined): void {
  const locks = s.stageState!.floorLocks!;
  if (kind === "ice") {
    slide(s, p, input, locks);
    return;
  }
  let dir = cursedDirection(p, input?.dir ?? null);
  let alt = cursedDirection(p, input?.alt ?? null);
  if (kind === "reverse" && s.tick < locks[`surprise:reverse:${p.id}`]!) {
    dir = reverse(dir);
    alt = reverse(alt);
  }
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
 * Numeric locks store tile/kind entry, direction index, reverse deadline and last move tick.
 */
export function moveSurprisePlayer(s: MatchState, p: Player, input?: PlayerInput): boolean {
  if (String(s.stage) !== "sb4-06") return false;
  const stage = s.stageState ??= {};
  const locks = stage.floorLocks ??= {};
  const key = `surprise:move:${p.id}`;
  if (!p.alive) {
    clearVisit(locks, p.id);
    delete locks[key];
    return false;
  }
  if (locks[key] === s.tick) return true;
  const kind = floorKind(s, p);
  if (kind === "normal") {
    clearVisit(locks, p.id);
    delete locks[key];
    return false;
  }
  locks[key] = s.tick;
  startVisit(s, p, kind, locks);
  if (!isBusy(s, p, input)) {
    moveOnFloor(s, p, kind, input);
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
