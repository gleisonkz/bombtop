import type { LobbyMember } from "@bombtop/shared";

/** Longest name drawn over a player in the arena, in characters (longer ones end in "…"). */
const MAX_NAME = 10;

/**
 * The names drawn over the players' heads in the arena: the humans' (ours marked, `me`); bots go untagged, so the
 * people stand out.
 */
export function nameTags(members: readonly LobbyMember[], me: string | null): Map<string, { text: string; me: boolean }> {
  const tags = new Map<string, { text: string; me: boolean }>();
  for (const m of members) {
    const name = m.name.trim();
    if (m.bot || !name) continue;
    tags.set(m.id, { text: name.length > MAX_NAME ? `${name.slice(0, MAX_NAME)}…` : name, me: m.id === me });
  }
  return tags;
}
