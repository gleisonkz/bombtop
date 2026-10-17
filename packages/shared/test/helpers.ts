import { createMatch, step, TILE, type Direction, type MatchState, type PlayerInput } from "../src";

export const center = (t: number) => t * TILE + TILE / 2;

/** Arena with no blocks and two players (p1 at 1,1 and p2 at 11,9). */
export function emptyMatch(ids = ["p1", "p2"]): MatchState {
  return createMatch({ seed: 1, playerIds: ids, blockDensity: 0 });
}

export function run(s: MatchState, ticks: number, inputs: Record<string, PlayerInput> = {}) {
  for (let i = 0; i < ticks; i++) step(s, inputs);
}

/** Holds a direction for `ticks` ticks. */
export function hold(s: MatchState, dir: Direction, ticks: number, id = "p1") {
  run(s, ticks, { [id]: { dir, bomb: false } });
}

/** Presses a button for a single tick. */
export function press(s: MatchState, button: "bomb" | "action", id = "p1", dir: Direction = null) {
  step(s, { [id]: { dir, bomb: button === "bomb", action: button === "action" } });
}

export const player = (s: MatchState, id = "p1") => s.players.find((p) => p.id === id)!;
