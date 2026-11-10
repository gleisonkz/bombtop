import { describe, expect, it } from "vitest";
import { SB2_STAGES, SB4_STAGES } from "@bombtop/shared";
import { SB2_TILE_ATLAS, stageTileLayout } from "../src/render/stage-art";

describe("SB2 arenas drawn with the project's stage art", () => {
  it("reuses one SB4 atlas per arena, picked by the original's look", () => {
    expect(Object.keys(SB2_TILE_ATLAS)).toEqual([...SB2_STAGES]);
    expect(SB2_TILE_ATLAS["sb2-01"]).toBe(1);   // stone pillars on grass
    expect(SB2_TILE_ATLAS["sb2-02"]).toBe(7);   // ice
    expect(SB2_TILE_ATLAS["sb2-10"]).toBe(4);   // rocks in a meadow
    for (const stage of SB2_STAGES) {
      const atlas = SB2_TILE_ATLAS[stage];
      expect(stageTileLayout(stage)!.url).toBe(`sprites/sb4-battle/tiles-${String(atlas).padStart(2, "0")}.png`);
    }
  });

  it("keeps the SB4 maps on their own atlases and the classic ones on the default art", () => {
    SB4_STAGES.forEach((stage, i) => expect(stageTileLayout(stage)!.url).toBe(`sprites/sb4-battle/tiles-${String(i + 1).padStart(2, "0")}.png`));
    expect(stageTileLayout("classic")).toBeNull();
  });
});
