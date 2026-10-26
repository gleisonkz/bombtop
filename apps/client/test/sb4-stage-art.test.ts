import { describe, expect, it } from "vitest";
import { Tile } from "@bombtop/shared";
import { battleTempoText } from "../src/render/battle-clock";
import { stageTileTint } from "../src/render/stage-art";

describe("original SB4 stage visuals", () => {
  it("preserves the creative art and gives each of the two originals a distinct palette", () => {
    for (const tile of [Tile.Empty, Tile.Block, Tile.Wall]) {
      expect(stageTileTint("classic", tile)).toBe(0xffffff);
      expect(stageTileTint("conveyor", tile)).toBe(0xffffff);
      expect(stageTileTint("warp", tile)).toBe(0xffffff);
      expect(stageTileTint("sb4-01", tile)).not.toBe(stageTileTint("sb4-02", tile));
    }
  });

  it("shows the current clock speed only in the time-flow stage", () => {
    expect(battleTempoText({ stage: "classic" })).toBe("");
    expect(battleTempoText({ stage: "sb4-01" })).toBe("");
    expect(battleTempoText({ stage: "sb4-02", tempo: 1 })).toBe("×1");
    expect(battleTempoText({ stage: "sb4-02", tempo: 0.5 })).toBe("×½");
    expect(battleTempoText({ stage: "sb4-02", tempo: 2 })).toBe("×2");
  });
});
