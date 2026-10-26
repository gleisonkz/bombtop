import { Assets, Container, Sprite, type Texture } from "pixi.js";
import { isolatedTextureRow } from "./texture-cells";

type GroundEffectKind = "warp" | "protection";

export class GroundEffects {
  readonly root = new Container();
  private art: Record<GroundEffectKind, Texture[]> | null = null;
  private loading: Promise<void> | null = null;
  private readonly sprites: Sprite[] = [];
  private used = 0;

  async load(): Promise<void> {
    if (this.art) return;
    if (this.loading) return this.loading;
    this.loading = this.loadArt();
    await this.loading;
    this.loading = null;
  }

  private async loadArt(): Promise<void> {
    try {
      const sheet: Texture = await Assets.load(`${import.meta.env.BASE_URL}sprites/ground-effects.png?v=20261025-portal-protection-v1`);
      const image = sheet.source.resource as CanvasImageSource;
      this.art = {
        warp: isolatedTextureRow(image, 0, 128, 6),
        protection: isolatedTextureRow(image, 1, 128, 6),
      };
    } catch {
      this.art = null;
    }
  }

  beginFrame(): void {
    this.used = 0;
    for (const sprite of this.sprites) sprite.visible = false;
  }

  draw(kind: GroundEffectKind, cx: number, cy: number, tick: number): boolean {
    if (!this.art) return false;
    const frame = Number.isFinite(tick) ? Math.floor(Math.max(0, tick) / 8) % 6 : 0;
    let sprite = this.sprites[this.used];
    if (!sprite) {
      sprite = new Sprite();
      sprite.anchor.set(0.5);
      sprite.scale.set(14 / 128);
      this.sprites.push(sprite);
      this.root.addChild(sprite);
    }
    this.used++;
    sprite.texture = this.art[kind][frame]!;
    sprite.position.set(cx, cy);
    sprite.visible = true;
    return true;
  }
}
