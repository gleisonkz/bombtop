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

  it("gives Naruto his own lines too", () => {
    expect(voiceLine("naruto", "pick")).toBe("naruto-pick");
    expect(voiceLine("naruto", "death")).toBe("naruto-death");
    expect(voiceLine("naruto", "win")).toBe("naruto-win");
  });

  it("gives every character their own lines for being picked, dying and winning", () => {
    for (const c of CHARACTERS) {
      for (const moment of ["pick", "death", "win"] as const) expect(voiceLine(c, moment)).toBe(`${c}-${moment}`);
    }
  });

  it("gives a shout on using the special to those whose special sound has no voice in it", () => {
    for (const c of ["bomb", "ninja", "captain", "thor", "spider", "pikachu", "flash", "bugs"] as const) expect(voiceLine(c, "special")).toBe(`${c}-special`);
    expect(voiceLine("goku", "special")).toBeNull(); // shouted over the kamehameha sound
    expect(voiceLine("naruto", "special")).toBeNull();
    expect(voiceLine("static", "special")).toBeNull(); // his magnet's crackle is his special's sound
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

  it("stays quiet on a tie or for a winner who left", () => {
    expect(winnerVoice(null, members)).toBeNull();
    expect(winnerVoice("gone", members)).toBeNull();
  });
});
