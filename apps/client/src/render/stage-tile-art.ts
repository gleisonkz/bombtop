import { Assets, type Texture } from "pixi.js";
import type { StageId } from "@bombtop/shared";
import { TILES } from "./sprites";
import { sb4TileLayout } from "./stage-art";
import { isolatedTextureRow } from "./texture-cells";

export class StageTileArt {
  private readonly loads = new Map<StageId, Promise<Texture[] | null>>();

  async load(layout: typeof TILES): Promise<ReadonlyMap<StageId, Texture[]>> {
    if (layout.url !== TILES.url || layout.size !== TILES.size || layout.scale !== TILES.scale || layout.cells !== TILES.cells) return new Map();
    const entries = await Promise.all((["sb4-01", "sb4-02"] as const).map(async (stage, index) => {
      let pending = this.loads.get(stage);
      if (!pending) {
        pending = this.loadAtlas(index + 1).then(textures => {
          if (!textures) this.loads.delete(stage);
          return textures;
        });
        this.loads.set(stage, pending);
      }
      const textures = await pending;
      return textures ? [stage, textures] as const : null;
    }));
    return new Map(entries.filter(entry => entry !== null));
  }

  private async loadAtlas(number: number): Promise<Texture[] | null> {
    const layout = sb4TileLayout(number)!;
    const url = `${import.meta.env.BASE_URL}${layout.url}`;
    try {
      const base = await Assets.load<Texture>(url);
      if (base.width !== 1920 || base.height !== 128) {
        throw new Error(`Expected 1920x128 stage atlas, received ${base.width}x${base.height}`);
      }
      return isolatedTextureRow(base.source.resource as CanvasImageSource, 0, layout.size, 15);
    } catch (error) {
      console.warn(`Stage tile art fallback: ${url}`, error);
      return null;
    }
  }
}
