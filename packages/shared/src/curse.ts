import { FUSE_TICKS, MAX_SPEED, SLOW_SPEED, TICK_RATE } from "./constants";
import { nextRandom } from "./rng";
import { playerTile, type CurseKind, type Direction, type MatchState, type Player } from "./state";

export const CURSES: readonly CurseKind[] = [
  "diarrhea", "weakFire", "hiccups", "fast", "shortFuse", "invisible",
  "cannotStop", "slow", "longFuse", "constipation", "reverse",
];

const OPPOSITE = { up: "down", down: "up", left: "right", right: "left" } as const;

export function applyRandomCurse(s: MatchState, p: Player): void {
  const kind = CURSES[Math.floor(nextRandom(s) * CURSES.length)]!;
  p.curse = { kind };
}

export function effectiveSpeed(p: Player): number {
  const speed = p.curse?.kind === "slow" ? SLOW_SPEED : p.curse?.kind === "fast" ? MAX_SPEED : p.speed;
  return p.bubble > 0 ? speed / 2 : speed; // the green lantern's bubble is heavy going
}

export function effectiveRange(p: Player): number {
  return p.curse?.kind === "weakFire" ? 1 : p.fireRange;
}

export function effectiveCapacity(p: Player): number {
  return p.curse?.kind === "weakFire" ? 1 : p.bombCapacity;
}

export function effectiveFuse(p: Player): number {
  if (p.curse?.kind === "shortFuse") return TICK_RATE;
  if (p.curse?.kind === "longFuse") return 4 * TICK_RATE;
  return FUSE_TICKS;
}

export function cursedDirection(p: Player, dir: Direction): Direction {
  return dir && p.curse?.kind === "reverse" ? OPPOSITE[dir] : dir;
}

/**
 * Passes curses between living players sharing a tile: whoever touches a cursed player takes the
 * curse off them (one at a time, never straight back to who passed it on).
 */
export function updateCurses(s: MatchState): void {
  const alive = s.players.filter((p) => p.alive);
  const touching = (a: Player, b: Player) => {
    const ta = playerTile(a);
    const tb = playerTile(b);
    return ta.x === tb.x && ta.y === tb.y;
  };
  for (const p of alive) {
    const from = p.curse?.from && s.players.find((o) => o.id === p.curse!.from);
    if (p.curse?.from && !(from && from.alive && touching(p, from))) delete p.curse.from;
  }
  const passes: [Player, Player][] = [];
  for (const carrier of alive) {
    if (!carrier.curse) continue;
    const taker = alive.find((o) => o !== carrier && !o.curse && o.id !== carrier.curse!.from && touching(carrier, o) && !passes.some(([, t]) => t === o));
    if (taker) passes.push([carrier, taker]);
  }
  for (const [carrier, taker] of passes) {
    taker.curse = { kind: carrier.curse!.kind, from: carrier.id };
    carrier.curse = null;
  }
}
