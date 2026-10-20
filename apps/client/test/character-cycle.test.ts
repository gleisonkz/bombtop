import { describe, expect, it } from "vitest";
import { CHARACTERS } from "@bombtop/shared";
import { cycleCharacter } from "../src/ui/character-cycle";

describe("cycleCharacter", () => {
  it("steps to the next and previous character", () => {
    expect(cycleCharacter(CHARACTERS[0], 1)).toBe(CHARACTERS[1]);
    expect(cycleCharacter(CHARACTERS[1], -1)).toBe(CHARACTERS[0]);
  });

  it("wraps around both ends", () => {
    const last = CHARACTERS[CHARACTERS.length - 1]!;
    expect(cycleCharacter(last, 1)).toBe(CHARACTERS[0]);
    expect(cycleCharacter(CHARACTERS[0], -1)).toBe(last);
  });
});
