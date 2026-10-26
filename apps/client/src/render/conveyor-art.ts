import { Assets, Container, Sprite, type Texture } from "pixi.js";
import { Floor } from "@bombtop/shared";
import { isolatedTextureRow } from "./texture-cells";

const ROWS = new Map([
  [Floor.ConveyorRight, 0], [Floor.ConveyorDown, 1],
  [Floor.ConveyorLeft, 2], [Floor.ConveyorUp, 3],
]);
const CELL = 128;
const FRAMES = 16;

/** Registered conveyor tiles; only rubber and painted arrows move in the atlas. */
export class ConveyorArt {
  readonly root = new Container();
  private art: Texture[][] | null = null;
  private loading: Promise<void> | null = null;
  private readonly sprites: Sprite[] = [];
  private used = 0;

  async load(): Promise<void> {
    if (this.art) return;
    if (!this.loading) this.loading = this.loadArt();
    await this.loading;
    this.loading = null;
  }

  private async loadArt(): Promise<void> {
    try {
      const sheet: Texture = await Assets.load(`${import.meta.env.BASE_URL}sprites/conveyors.png?v=20261025-v1`);
      this.art = Array.from({ length: 4 }, (_, row) =>
        isolatedTextureRow(sheet.source.resource as CanvasImageSource, row, CELL, FRAMES));
    } catch {
      this.art = null;
    }
  }

  beginFrame(): void {
    this.used = 0;
    for (const sprite of this.sprites) sprite.visible = false;
  }

  draw(floor: Floor, px: number, py: number, tick: number): boolean {
    const row = ROWS.get(floor);
    if (!this.art || row === undefined) return false;
    const frame = Number.isFinite(tick) ? Math.floor(Math.max(0, tick) / 2) % FRAMES : 0;
    let sprite = this.sprites[this.used];
    if (!sprite) {
      sprite = new Sprite();
      sprite.scale.set(16 / CELL);
      this.sprites.push(sprite);
      this.root.addChild(sprite);
    }
    this.used++;
    sprite.texture = this.art[row]![frame]!;
    sprite.position.set(px, py);
    sprite.visible = true;
    return true;
  }
}
