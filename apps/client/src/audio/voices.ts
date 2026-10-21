import type { CharacterId } from "@bombtop/shared";

/** When a character speaks up. */
export type VoiceMoment = "pick" | "death" | "win";

export type VoiceName = "goku-pick" | "goku-death" | "goku-win";

/** Characters' own voices; the rest use the shared sounds (or stay quiet). */
export const VOICE_LINES: Partial<Record<CharacterId, Record<VoiceMoment, VoiceName>>> = {
  goku: { pick: "goku-pick", death: "goku-death", win: "goku-win" },
};

export function voiceLine(character: CharacterId, moment: VoiceMoment): VoiceName | null {
  return VOICE_LINES[character]?.[moment] ?? null;
}

/** The winner's cheer, if their character has a voice (null on a tie). */
export function winnerVoice(winnerId: string | null, members: readonly { id: string; character: CharacterId }[]): VoiceName | null {
  const winner = members.find((m) => m.id === winnerId);
  return winner ? voiceLine(winner.character, "win") : null;
}
