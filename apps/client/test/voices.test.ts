import { describe, expect, it } from "vitest";
import { CHARACTERS } from "@bombtop/shared";
import { SOUNDS } from "../src/audio/sound";
import { voiceLine, VOICE_LINES, winnerVoice } from "../src/audio/voices";

describe("voiceLine", () => {
  it("gives Goku his own lines for being picked, dying and winning", () => {
    expect(voiceLine("goku", "pick")).toBe("goku-pick");
    expect(voiceLine("goku", "death")).toBe("goku-death");
    expect(voiceLine("goku", "win")).toBe("goku-win");
  });

  it("is silent for characters without a voice yet", () => {
    expect(voiceLine("bomb", "pick")).toBeNull();
    expect(voiceLine("ninja", "death")).toBeNull();
  });

  it("only names sounds in the mix", () => {
    for (const c of CHARACTERS) {
      for (const name of Object.values(VOICE_LINES[c] ?? {})) expect(SOUNDS[name]).toBeDefined();
    }
  });
});

describe("winnerVoice", () => {
  const members = [
    { id: "a", character: "goku" as const },
    { id: "b", character: "bomb" as const },
  ];

  it("lets the winner cheer in their own voice", () => {
    expect(winnerVoice("a", members)).toBe("goku-win");
  });

  it("stays quiet on a tie or for a winner without a voice", () => {
    expect(winnerVoice(null, members)).toBeNull();
    expect(winnerVoice("b", members)).toBeNull();
    expect(winnerVoice("gone", members)).toBeNull();
  });
});
