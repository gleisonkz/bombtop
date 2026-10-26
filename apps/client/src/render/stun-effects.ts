import { Assets, Container, Rectangle, Sprite, Texture } from "pixi.js";

export class StunEffects {
  readonly root = new Container();
  private frames: Texture[] | null = null;
  private readonly sprites: Sprite[] = [];
  private used = 0;

  async load(): Promise<void> {
    const atlas = await Assets.load<Texture>(`${import.meta.env.BASE_URL}sprites/stun-effects-pixel-v2.png`);
    atlas.source.scaleMode = "nearest";
    this.frames = Array.from({ length: 12 }, (_, frame) => new Texture({
      source: atlas.source, frame: new Rectangle(frame * 64, 0, 64, 32),
    }));
  }

  beginFrame(): void {
    this.used = 0;
    for (const sprite of this.sprites) sprite.visible = false;
  }

  draw(pose: { x: number; headY: number; remaining: number; tick: number; alpha: number }): boolean {
    if (!this.frames || pose.remaining <= 0 || pose.alpha <= 0) return false;
    const tick = Number.isFinite(pose.tick) ? Math.max(0, pose.tick) : 0;
    const texture = this.frames[Math.floor(tick / 5) % 12]!;
    let sprite = this.sprites[this.used++];
    if (!sprite) {
      sprite = new Sprite(texture);
      sprite.anchor.set(0.5, 1);
      this.sprites.push(sprite);
      this.root.addChild(sprite);
    }
    sprite.texture = texture;
    sprite.scale.set(0.375);
    sprite.position.set(Math.round(pose.x), Math.round(pose.headY + 3));
    sprite.alpha = pose.alpha;
    sprite.visible = true;
    return true;
  }
}
