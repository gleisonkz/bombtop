import { movePlayer, TICK_RATE, TILE, type MatchState, type PublicView } from "@bombtop/shared";

/** Never guess other players further than this past the newest snapshot. */
export const MAX_CARRY_MS = 250;

/**
 * `to` with every player who was walking (from `from` to `to`) walked on for
 * `ms` more, by the game's own movement rules, so a late snapshot doesn't
 * freeze them in place and then jump. Walls and bombs stop them as they would
 * on the server; turns are not guessed.
 */
export function carryOn<V extends PublicView>(from: V, to: V, ms: number): V {
  const ticks = Math.round((Math.min(ms, MAX_CARRY_MS) * TICK_RATE) / 1000);
  if (ticks <= 0) return to;
  const s = to as unknown as MatchState;
  const players = to.players.map((p) => {
    const was = from.players.find((q) => q.id === p.id);
    if (!was || !p.alive) return p;
    const dx = p.px - was.px;
    const dy = p.py - was.py;
    if (dx === 0 && dy === 0) return p;
    if (Math.abs(dx) + Math.abs(dy) >= TILE) return p; // a teleport, not a walk
    const dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
    const q = { ...p };
    for (let i = 0; i < ticks; i++) movePlayer(s, q as never, dir);
    return q;
  });
  return { ...to, players };
}
