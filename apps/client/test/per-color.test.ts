import { describe, expect, it } from "vitest";
import { ORIGINAL, paintTo, PerColor, skinColor } from "../src/render/per-color";

describe("per-color skins", () => {
  it("paints a color only when it is first drawn, and only once", () => {
    const painted: number[] = [];
    const skins = new PerColor((player) => (painted.push(player), `skin ${player}`), () => {});
    expect(painted).toEqual([]);
    expect(skins.get(3)).toBe("skin 3");
    expect(skins.get(3)).toBe("skin 3");
    expect(painted).toEqual([3]);
  });

  it("lets go of every painted color", () => {
    const freed: string[] = [];
    const skins = new PerColor((player) => `skin ${player}`, (s) => freed.push(s));
    skins.get(0);
    skins.get(2);
    skins.clear();
    expect(freed).toEqual(["skin 0", "skin 2"]);
    expect(skins.size).toBe(0);
  });
});

describe("own colors", () => {
  it("a player in their character's original colors gets the unpainted sheet; anyone else their seat's color", () => {
    expect(skinColor({ ownColors: true }, 3)).toBe(ORIGINAL);
    expect(skinColor({}, 3)).toBe(3);
  });

  it("paints a seat in its color, and leaves the original sheet as drawn", () => {
    const seats = [0xf5f5f5, 0x3d7bf2];
    expect(paintTo(1, seats)).toEqual([0x3d, 0x7b, 0xf2]);
    expect(paintTo(ORIGINAL, seats)).toBeNull();
    expect(paintTo(7, seats)).toEqual([0xf5, 0xf5, 0xf5]); // past the palette: the first seat's
  });
});
