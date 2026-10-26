import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { FUSE_TICKS } from "@bombtop/shared";
import { BOMBS, bombLook } from "../src/render/sprites";

describe("Bomber mega bomb", () => {
  it("ships a dedicated square HD RGBA texture matching its render contract", () => {
    const path = BOMBS.mega.url.split("?")[0];
    const png = readFileSync(new URL(`../public/${path}`, import.meta.url));
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(BOMBS.mega.size);
    expect(png.readUInt32BE(20)).toBe(BOMBS.mega.size);
    expect(png[25]).toBe(6); // PNG truecolor with alpha.
    expect(png.equals(readFileSync(new URL("../public/sprites/bombs/armed.png", import.meta.url)))).toBe(false);
  });
  it("ships four distinct RGBA stages and their matching flash textures", () => {
    expect(BOMBS.mega.url.split("?")[0]).toBe("sprites/bombs/mega/armed.png");
    const states = new Set<string>();
    for (const stage of BOMBS.stages) {
      for (const suffix of ["", "-white"]) {
        const png = readFileSync(new URL(`../public/sprites/bombs/mega/${stage}${suffix}.png`, import.meta.url));
        expect(png.subarray(1, 4).toString()).toBe("PNG");
        expect(png.readUInt32BE(16)).toBe(512);
        expect(png.readUInt32BE(20)).toBe(512);
        expect(png[25]).toBe(6);
        if (suffix === "") states.add(png.toString("base64"));
      }
    }
    expect(states.size).toBe(4);
  });
  it("keeps its spherical proportions throughout its fuse and pulse", () => {
    for (let tick = 0; tick < FUSE_TICKS; tick++) {
      const look = bombLook({ fuse: FUSE_TICKS - tick, tick, type: "normal", mega: true });
      expect(look.sx).toBe(look.sy);
      expect(look.sx).toBeGreaterThan(1.3);
    }
  });
});
