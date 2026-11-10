import { describe, expect, it } from "vitest";
import { createMatch } from "@bombtop/shared";
import { skullAlpha } from "../src/render/sprites";
import { readFileSync } from "node:fs";

describe("Skull invisibility", () => {
  it("usa as 709 observações nativas de SB2, independentemente do tick de renderização", () => {
    const report = JSON.parse(readFileSync(new URL("../../../docs/sb2/SB2-SKULL-BLINK-COMPARISON.json", import.meta.url), "utf8"));
    const s = createMatch({ seed: 1, playerIds: ["p1", "p2"] });
    const p = s.players[0]!;
    for (let frame = 0; frame < report.samples.length; frame++) {
      p.curse = { kind: "invisible", sb2Status: 1, elapsed: frame };
      const hidden = (report.samples[frame].players[0].flags & 64) !== 0;
      expect(skullAlpha(p, frame * 3), `blink-${frame}`).toBe(hidden ? 0 : 1);
    }
  });

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
