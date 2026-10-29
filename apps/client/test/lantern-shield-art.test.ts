import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { BUBBLE, bubbleLook } from "../src/render/sprites";
import { BUBBLE_TICKS } from "@bombtop/shared";

describe("generated Lantern construct shield", () => {
  it("uses the generated atlas with unchanged forming and dissolving durations", () => {
    expect(BUBBLE.url).toContain("lantern-construct-shield.png");
    expect(BUBBLE.size).toBe(320);
    expect(BUBBLE.frames).toEqual({ form: 4, loop: 8, pop: 4 });
    expect(BUBBLE.frames.form * BUBBLE.ticks).toBe(16);
    expect(BUBBLE.frames.pop * BUBBLE.ticks).toBe(16);
    expect(bubbleLook(BUBBLE_TICKS, 0)).toMatchObject({ row: BUBBLE.rows.form, frame: 0 });
    expect(bubbleLook(1, BUBBLE_TICKS - 1)).toMatchObject({ row: BUBBLE.rows.pop, frame: 3 });
    expect(bubbleLook(0, BUBBLE_TICKS)).toBeNull();
  });
  it("ships an RGBA atlas matching the declared cells and cache limit", () => {
    const png = readFileSync(new URL("../public/sprites/lantern-construct-shield.png", import.meta.url));
    expect(png.readUInt32BE(16)).toBe(8 * BUBBLE.size);
    expect(png.readUInt32BE(20)).toBe(3 * BUBBLE.size);
    expect(png[25]).toBe(6);
    expect(png.byteLength).toBeLessThan(4 * 1024 * 1024);
  });
});
