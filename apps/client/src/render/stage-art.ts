import { Tile, type StageId } from "@bombtop/shared";
import { TILES } from "./sprites";

export function sb4TileLayout(number: number): typeof TILES | null {
  if (!Number.isInteger(number) || number < 1 || number > 12) return null;
  return { ...TILES, url: `sprites/sb4-battle/tiles-${String(number).padStart(2, "0")}.png` };
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
