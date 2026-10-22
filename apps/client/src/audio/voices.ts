import type { CharacterId } from "@bombtop/shared";

/** When a character speaks up: picked in the lobby, dying, winning, using their special. */
export type VoiceMoment = "pick" | "death" | "win" | "special";

type Lines<C extends string> = `${C}-${"pick" | "death" | "win"}`;
export type VoiceName = Lines<CharacterId> | `${"bomb" | "ninja" | "captain" | "thor" | "spider" | "pikachu"}-special`;

const lines = <C extends CharacterId>(c: C) => ({ pick: `${c}-pick`, death: `${c}-death`, win: `${c}-win` }) as const;

/** Characters' own voices. Goku and Naruto shout over their special's own sound (kamehameha, rasengan), so no special line. */
export const VOICE_LINES: Record<CharacterId, Partial<Record<VoiceMoment, VoiceName>>> = {
  bomb: { ...lines("bomb"), special: "bomb-special" },
  ninja: { ...lines("ninja"), special: "ninja-special" },
  captain: { ...lines("captain"), special: "captain-special" },
  thor: { ...lines("thor"), special: "thor-special" },
  goku: lines("goku"),
  naruto: lines("naruto"),
  spider: { ...lines("spider"), special: "spider-special" },
  pikachu: { ...lines("pikachu"), special: "pikachu-special" },
};

export function voiceLine(character: CharacterId, moment: VoiceMoment): VoiceName | null {
  return VOICE_LINES[character]?.[moment] ?? null;
}

/** The winner's cheer, if their character has a voice (null on a tie). */
export function winnerVoice(winnerId: string | null, members: readonly { id: string; character: CharacterId }[]): VoiceName | null {
  const winner = members.find((m) => m.id === winnerId);
  return winner ? voiceLine(winner.character, "win") : null;
}
