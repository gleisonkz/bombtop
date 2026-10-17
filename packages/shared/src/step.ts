import { updateBombs } from "./bombs";
import { hasFlame, playerTile, type MatchState } from "./state";

/** Advances the simulation by one tick. */
export function step(s: MatchState): void {
  s.tick++;

  updateBombs(s);

  for (const p of s.players) {
    const { x, y } = playerTile(p);
    if (p.alive && hasFlame(s, x, y)) p.alive = false;
  }
}
