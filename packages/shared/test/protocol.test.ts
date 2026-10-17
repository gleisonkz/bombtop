import { describe, expect, it } from "vitest";
import { sanitizeInput, sanitizeName } from "../src";

describe("sanitizeInput", () => {
  it("passes valid input through", () => {
    expect(sanitizeInput({ dir: "left", bomb: true, action: false })).toEqual({ dir: "left", bomb: true, action: false });
  });

  it("drops unknown directions and coerces buttons to strict booleans", () => {
    expect(sanitizeInput({ dir: "diagonal", bomb: "yes", action: 1 })).toEqual({ dir: null, bomb: false, action: false });
  });

  it("survives garbage", () => {
    for (const raw of [null, undefined, 42, "x", [], { dir: { up: true } }]) {
      expect(sanitizeInput(raw)).toEqual({ dir: null, bomb: false, action: false });
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
