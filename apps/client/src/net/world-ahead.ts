import { step, type MatchState, type PublicView } from "@bombtop/shared";

/** Never run the world further ahead than this (half a second): past it, the guess is worth less than the wait. */
export const MAX_AHEAD = 30;

/**
 * The server's view run `ticks` forward on our side, with no one pressing anything:
 * fuses burn down, bombs blow and flames spread at the time our own (predicted)
 * player lives in, not a round trip late. The sim is deterministic, so this is
 * what the server will show unless someone acts in between.
 */
export function aheadOf<V extends PublicView>(view: V, ticks: number): V {
  const n = Math.min(MAX_AHEAD, Math.max(0, Math.floor(ticks)));
  if (n === 0) return view;
  const s = { ...structuredClone(view), rng: 0 } as V & MatchState;
  for (let i = 0; i < n; i++) step(s);
  const { rng: _rng, ...ahead } = s;
  return ahead as unknown as V;
}
