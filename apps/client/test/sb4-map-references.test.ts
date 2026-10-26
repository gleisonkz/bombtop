import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pngHeader = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

describe("Super Bomberman 4 original map references", () => {
  it.each(Array.from({ length: 12 }, (_, i) => i + 1))("packs stage %i in the standard Bombtop tile contract", number => {
    const file = `tiles-${String(number).padStart(2, "0")}.png`;
    const atlas = readFileSync(new URL(`../public/sprites/sb4-battle/${file}`, import.meta.url));
    expect(atlas.subarray(0, 8)).toEqual(pngHeader);
    expect(atlas.readUInt32BE(16)).toBe(1920);
    expect(atlas.readUInt32BE(20)).toBe(128);
  });
  it.each(Array.from({ length: 12 }, (_, i) => i + 1))("stores the unscaled 256×224 Battle Group 1 screenshot of stage %i", number => {
    const filename = `stage-${String(number).padStart(2, "0")}.png`;
    const screenshot = readFileSync(new URL(`../../../concept/references/sb4-battle/${filename}`, import.meta.url));
    expect(screenshot.subarray(0, 8)).toEqual(pngHeader);
    expect(screenshot.readUInt32BE(16)).toBe(256);
    expect(screenshot.readUInt32BE(20)).toBe(224);
    if (number <= 2) {
      const preview = readFileSync(new URL(`../public/sprites/sb4-battle/${filename}`, import.meta.url));
      expect(preview).toEqual(screenshot);
    }
  });
});
