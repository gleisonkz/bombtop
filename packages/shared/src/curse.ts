import { CURSE_TICKS, MAX_SPEED, SLOW_SPEED } from "./constants";
import { nextRandom } from "./rng";
import { playerTile, type CurseKind, type Direction, type MatchState, type Player } from "./state";

export const CURSES: readonly CurseKind[] = ["slow", "fast", "reverse", "diarrhea", "constipation", "weakFire"];

const OPPOSITE = { up: "down", down: "up", left: "right", right: "left" } as const;

export function applyRandomCurse(s: MatchState, p: Player): void {
  const kind = CURSES[Math.floor(nextRandom(s) * CURSES.length)]!;
  p.curse = { kind, ticks: CURSE_TICKS };
}

export function effectiveSpeed(p: Player): number {
  if (p.curse?.kind === "slow") return SLOW_SPEED;
  if (p.curse?.kind === "fast") return MAX_SPEED;
  return p.speed;
}

export function effectiveRange(p: Player): number {
  return p.curse?.kind === "weakFire" ? 1 : p.fireRange;
}

export function cursedDirection(p: Player, dir: Direction): Direction {
  return dir && p.curse?.kind === "reverse" ? OPPOSITE[dir] : dir;
}

/** Counts curses down and spreads them between living players sharing a tile. */
export function updateCurses(s: MatchState): void {
  for (const p of s.players) {
    if (p.curse && --p.curse.ticks <= 0) p.curse = null;
  }
  const alive = s.players.filter((p) => p.alive);
  for (const carrier of alive) {
    if (!carrier.curse) continue;
    const t = playerTile(carrier);
    for (const other of alive) {
      if (other.curse) continue;
      const o = playerTile(other);
      if (o.x === t.x && o.y === t.y) other.curse = { ...carrier.curse };
    }
  }
}
