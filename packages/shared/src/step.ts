import { punch, updateHeldBombs, useGlove } from "./air";
import { detonateRemote, placeBomb, updateBombs } from "./bombs";
import { cursedDirection, updateCurses } from "./curse";
import { collectItems } from "./items";
import { tryKick } from "./kick";
import { movePlayer } from "./movement";
import { hasFlame, playerTile, type MatchState, type PlayerInput } from "./state";

/** Advances the simulation by one tick, applying each player's input for this tick. */
export function step(s: MatchState, inputs: Record<string, PlayerInput> = {}): void {
  s.tick++;

  for (const p of s.players) {
    const input = inputs[p.id];
    if (p.stun > 0) {
      p.stun--;
      continue;
    }
    if (p.curse?.kind === "diarrhea") placeBomb(s, p.id);
    if (!input) continue;
    const dir = cursedDirection(p, input.dir);
    if (dir && p.alive) p.facing = dir;
    if (input.bomb && !useGlove(s, p)) placeBomb(s, p.id);
    if (input.action && !detonateRemote(s, p.id)) punch(s, p);
    movePlayer(s, p, dir);
    tryKick(s, p, dir);
  }

  updateHeldBombs(s);
  collectItems(s);
  updateCurses(s);

  updateBombs(s);

  for (const p of s.players) {
    const { x, y } = playerTile(p);
    if (p.alive && hasFlame(s, x, y)) p.alive = false;
  }

  updateHeldBombs(s);
}
