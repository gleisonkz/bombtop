import { describe, expect, it } from "vitest";
import { PerColor } from "../src/render/per-color";

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
