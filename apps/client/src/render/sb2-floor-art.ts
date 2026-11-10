import { Assets, Container, Sprite, type Texture } from "pixi.js";
import type { PublicView } from "@bombtop/shared";
import { isolatedTextureRow } from "./texture-cells";
import { SB2_FLOOR_CELLS, sb2FloorDecals, type Sb2FloorCell } from "./sb2-floor-decals";

/** Draws SB2 arenas' floors (ice, tracks, plates, pads, arrows...) over the tiles, from sb2-floors.png. */
export class Sb2FloorArt {
  readonly root = new Container();
  private art: Map<Sb2FloorCell, Texture> | null = null;
  private loading: Promise<void> | null = null;
  private readonly sprites: Sprite[] = [];

  async load(): Promise<void> {
    if (this.art) return;
    this.loading ??= Assets.load<Texture>(`${import.meta.env.BASE_URL}sprites/sb2-floors.png?v=20261106`).then(sheet => {
      const cells = isolatedTextureRow(sheet.source.resource as CanvasImageSource, 0, 128, SB2_FLOOR_CELLS.length);
      this.art = new Map(SB2_FLOOR_CELLS.map((cell, i) => [cell, cells[i]!]));
    }).catch(error => { console.warn("SB2 floor art", error); });
    await this.loading;
  }

  /**
   * Draws the arena's floor pieces; warps and belts go to the callbacks (the shared portal and
   * conveyor art). `tile` is the size of a tile in pixels.
   */
  draw(s: PublicView, tile: number, other: (decal: { cell: "warp" | "belt"; x: number; y: number; belt?: number }) => void): void {
    let used = 0;
    for (const decal of sb2FloorDecals(s)) {
      if (decal.cell === "warp" || decal.cell === "belt") { other(decal); continue; }
      const texture = this.art?.get(decal.cell);
      if (!texture) continue;
      let sprite = this.sprites[used];
      if (!sprite) {
        sprite = new Sprite();
        sprite.anchor.set(0.5);
        this.sprites.push(sprite);
        this.root.addChild(sprite);
      }
      used++;
      sprite.texture = texture;
      sprite.scale.set(tile / 128);
      sprite.rotation = decal.rotation * Math.PI / 2;
      sprite.position.set((decal.x + 0.5) * tile, (decal.y + 0.5) * tile);
      sprite.visible = true;
    }
    for (let i = used; i < this.sprites.length; i++) this.sprites[i]!.visible = false;
  }
}
