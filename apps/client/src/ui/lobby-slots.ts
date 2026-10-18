import type { LobbyMember } from "@bombtop/shared";
import { PLAYER_COLORS } from "./art";

export interface Slot {
  member: LobbyMember | null;
  color: string;
}

/** Seats for the lobby: members in join order (same colors as in the arena), then empty seats. */
export function lobbySlots(members: LobbyMember[], max: number): Slot[] {
  return Array.from({ length: Math.max(max, members.length) }, (_, i) => ({
    member: members[i] ?? null,
    color: PLAYER_COLORS[i % PLAYER_COLORS.length]!,
  }));
}

/** CSS classes for a member's seat; bots carry their level, which picks how they move. */
export function seatClass(member: LobbyMember, me: string): string {
  return ["seat", member.id === me && "me", !member.connected && "away", member.bot && "bot", member.bot]
    .filter(Boolean)
    .join(" ");
}
