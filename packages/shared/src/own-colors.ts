import type { CharacterId } from "./state";

/**
 * Who wears their character's original colors: the first in `picks` (in the order they picked)
 * for each character. Anyone later on a character already taken wears their seat color instead.
 */
export function firstPickers(picks: readonly { id: string; character: CharacterId }[]): Set<string> {
  const taken = new Set<CharacterId>();
  const own = new Set<string>();
  for (const { id, character } of picks) {
    if (taken.has(character)) continue;
    taken.add(character);
    own.add(id);
  }
  return own;
}
