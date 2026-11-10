import { SB4_STAGES, Tile, type Sb2StageId, type StageId } from "@bombtop/shared";
import { TILES } from "./sprites";

export function sb4TileLayout(number: number): typeof TILES | null {
  if (!Number.isInteger(number) || number < 1 || number > 12) return null;
  return { ...TILES, url: `sprites/sb4-battle/tiles-${String(number).padStart(2, "0")}.png` };
}

/**
 * SB2 arenas reuse the SB4 tile atlases, each the one closest to the original arena's look
 * (floor, pillars and border as the native captures show them).
 */
export const SB2_TILE_ATLAS: Readonly<Record<Sb2StageId, number>> = {
  "sb2-01": 1, // grey stone pillars on green
  "sb2-02": 7, // ice
  "sb2-03": 12, // water all round
  "sb2-04": 11, // wood and barrels
  "sb2-05": 10, // green floor in a hedge
  "sb2-06": 5, // warm floor, brown blocks
  "sb2-07": 8, // red and white border
  "sb2-08": 2, // machinery
  "sb2-09": 9, // teal machine room
  "sb2-10": 4, // rocks in a meadow
  "sb2-11": 3, // open paved floor
  "sb2-12": 6, // teal floor
};

/** The tile atlas a stage is drawn with; null for the default art. */
export function stageTileLayout(stage: StageId | undefined): typeof TILES | null {
  if (!stage) return null;
  if (stage in SB2_TILE_ATLAS) return sb4TileLayout(SB2_TILE_ATLAS[stage as Sb2StageId]);
  const sb4 = SB4_STAGES.indexOf(stage as (typeof SB4_STAGES)[number]);
  return sb4 < 0 ? null : sb4TileLayout(sb4 + 1);
}

const PALETTES: Record<"sb4-01" | "sb4-02", Record<Tile, number>> = {
  "sb4-01": {
    [Tile.Empty]: 0xc6efb5,
    [Tile.Block]: 0xdac2a1,
    [Tile.Wall]: 0xc3c7c7,
  },
  "sb4-02": {
    [Tile.Empty]: 0x92a7c9,
    [Tile.Block]: 0xdba981,
    [Tile.Wall]: 0xffd59b,
  },
};

export function stageTileTint(stage: StageId | undefined, tile: Tile): number {
  return stage === "sb4-01" || stage === "sb4-02" ? PALETTES[stage][tile] : 0xffffff;
}
