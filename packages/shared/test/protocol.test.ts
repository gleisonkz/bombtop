import { describe, expect, it } from "vitest";
import { botLevel, characterId, CHARACTERS, inputSeq, inputTick, sanitizeInput, sanitizeName } from "../src";

describe("sanitizeInput", () => {
  it("passes valid input through", () => {
    expect(sanitizeInput({ dir: "left", bomb: true, action: false })).toEqual({ dir: "left", bomb: true, action: false });
  });

  it("drops unknown directions and coerces buttons to strict booleans", () => {
    expect(sanitizeInput({ dir: "diagonal", bomb: "yes", action: 1 })).toEqual({ dir: null, bomb: false, action: false });
  });

  it("keeps a held bomb button only when it is strictly true", () => {
    expect(sanitizeInput({ dir: null, bomb: false, hold: true })).toEqual({ dir: null, bomb: false, action: false, hold: true });
    expect(sanitizeInput({ dir: null, bomb: false, hold: 1 })).toEqual({ dir: null, bomb: false, action: false });
  });

  it("survives garbage", () => {
    for (const raw of [null, undefined, 42, "x", [], { dir: { up: true } }]) {
      expect(sanitizeInput(raw)).toEqual({ dir: null, bomb: false, action: false });
    }
  });
});

describe("inputTick", () => {
  it("reads the client tick an input was made on", () => {
    expect(inputTick({ dir: null, seq: 3, t: 1200 })).toBe(1200);
  });

  it("is undefined for old or malformed messages, so the server applies them at once", () => {
    for (const raw of [null, {}, { t: -1 }, { t: 2.5 }, { t: "9" }, { t: Number.MAX_VALUE }]) {
      expect(inputTick(raw), JSON.stringify(raw)).toBeUndefined();
    }
  });
});

describe("inputSeq", () => {
  it("reads the input sequence number", () => {
    expect(inputSeq({ dir: null, seq: 42 })).toBe(42);
  });

  it("treats anything else as 0", () => {
    for (const raw of [null, {}, { seq: -1 }, { seq: 1.5 }, { seq: "3" }, { seq: Number.MAX_VALUE }]) {
      expect(inputSeq(raw)).toBe(0);
    }
  });
});

describe("sanitizeName", () => {
  it("trims and caps length", () => {
    expect(sanitizeName("  Ana  ")).toBe("Ana");
    expect(sanitizeName("x".repeat(40))).toHaveLength(16);
  });

  it("strips control characters", () => {
    expect(sanitizeName("Bo\u0000b​\n")).toBe("Bob");
  });

  it("falls back when empty or not a string", () => {
    expect(sanitizeName("   ")).toBe("Jogador");
    expect(sanitizeName(undefined)).toBe("Jogador");
  });
});

describe("botLevel", () => {
  it("accepts only known difficulties", () => {
    expect(botLevel({ level: "hard" })).toBe("hard");
    expect(botLevel({ level: "godlike" })).toBeNull();
    expect(botLevel(null)).toBeNull();
  });
});

describe("characterId", () => {
  it("accepts only known characters, bare or in a message", () => {
    expect(CHARACTERS).toEqual(["bomb", "ninja", "captain", "thor", "goku", "naruto", "spider", "pikachu", "static"]);
    expect(characterId("ninja")).toBe("ninja");
    expect(characterId("captain")).toBe("captain");
    expect(characterId("thor")).toBe("thor");
    expect(characterId("goku")).toBe("goku");
    expect(characterId("naruto")).toBe("naruto");
    expect(characterId("spider")).toBe("spider");
    expect(characterId("pikachu")).toBe("pikachu");
    expect(characterId({ character: "bomb" })).toBe("bomb");
    expect(characterId({ character: "dragon" })).toBeNull();
    expect(characterId(null)).toBeNull();
  });
});
