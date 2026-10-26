import { describe, expect, it } from "vitest";
import { createMatch } from "@bombtop/shared";
import { skullAlpha } from "../src/render/sprites";

describe("Skull invisibility", () => {
  it("blinks out only while invisible disease is active", () => {
    const s = createMatch({ seed: 3, blockDensity: 0, playerIds: ["p1", "p2"] });
    const p = s.players[0]!;
    p.curse = { kind: "invisible" };
    expect(skullAlpha(p, 0)).toBe(1);
    expect(skullAlpha(p, 15)).toBe(1);
    expect(skullAlpha(p, 30)).toBe(0);
    expect(skullAlpha(p, 60)).toBe(1);
    p.curse = null;
    expect(skullAlpha(p, 30)).toBe(1);
    expect(p.alive).toBe(true);
  });
});
