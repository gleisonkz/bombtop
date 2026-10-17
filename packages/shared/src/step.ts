import { placeBomb, updateBombs } from "./bombs";
import { collectItems } from "./items";
import { movePlayer } from "./movement";
import { hasFlame, playerTile, type MatchState, type PlayerInput } from "./state";

/** Advances the simulation by one tick, applying each player's input for this tick. */
export function step(s: MatchState, inputs: Record<string, PlayerInput> = {}): void {
  s.tick++;

  for (const p of s.players) {
    const input = inputs[p.id];
    if (!input) continue;
    if (input.dir && p.alive) p.facing = input.dir;
    if (input.bomb) placeBomb(s, p.id);
    movePlayer(s, p, input.dir);
  }

  collectItems(s);

  updateBombs(s);

  for (const p of s.players) {
    const { x, y } = playerTile(p);
    if (p.alive && hasFlame(s, x, y)) p.alive = false;
  }
}
