import { getTile, Tile, type MatchState } from "./state";

/** What clients may see: no buried items and no PRNG state. */
export type PublicView = Omit<MatchState, "rng">;

/** Deep-copied, cheat-safe snapshot of the match for broadcasting. */
export function publicView(s: MatchState): PublicView {
  const { rng: _rng, ...rest } = structuredClone(s);
  return { ...rest, items: rest.items.filter((i) => getTile(s, i.x, i.y) === Tile.Empty) };
}
