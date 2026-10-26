import { specialInk, specialTexture } from "./special-palette";
import { Assets, Container, Rectangle, Sprite, Texture, type Graphics } from "pixi.js";
import { TICK_RATE } from "@bombtop/shared";
import { webShotPose } from "./web-motion";

const CELL_SIZE = 64;

export class WebEffects {
  readonly root = new Container();
  private frames: Texture[][] | null = null;
  private readonly sprites: Sprite[] = [];
  private used = 0;

  async load(): Promise<void> {
    const atlas = await Assets.load<Texture>(`${import.meta.env.BASE_URL}sprites/web-effects-pixel-v2.png`);
    atlas.source.scaleMode = "nearest";
    this.frames = Array.from({ length: 3 }, (_, row) =>
      Array.from({ length: 4 }, (_, frame) => new Texture({ source: atlas.source, frame: new Rectangle(frame * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE) })),
    );
  }

  beginFrame(): void {
    this.used = 0;
    for (const sprite of this.sprites) sprite.visible = false;
  }

  draw(pose: { x: number; feet: number; bodyH: number; remaining: number; tick: number; color?: number | null | undefined }): boolean {
    if (!this.frames) return false;
    const sprite = this.sprite(this.frames[0]![Math.floor(pose.tick / 6) % 4]!, pose.color);
    const release = Math.max(0, 1 - pose.remaining / TICK_RATE);
    sprite.anchor.set(0.5, 1);
    sprite.width = 28 + Math.floor(release * 4);
    sprite.height = Math.round(pose.bodyH + 8);
    sprite.position.set(Math.round(pose.x), Math.round(pose.feet + 3));
    sprite.alpha = 1 - Math.floor(release * 4) / 4;
    return true;
  }

  drawShot(g: Graphics, pose: { x0: number; y0: number; x1: number; y1: number; age: number; alpha: number; color?: number | null | undefined }): boolean {
    if (!this.frames) return false;
    const look = webShotPose(pose.age);
    if (!look) return true;
    const x = Math.round(pose.x0 + (pose.x1 - pose.x0) * look.progress);
    const y = Math.round(pose.y0 + (pose.y1 - pose.y0) * look.progress);
    const dx = x - pose.x0;
    const dy = y - pose.y0;
    const length = Math.max(Math.abs(dx), Math.abs(dy));
    if (!look.impact || look.frame < 2) {
      for (let step = 0; step < length; step++) {
        const t = step / Math.max(1, length);
        const curl = Math.round(Math.sin(step * 0.8 + look.frame) * 1);
        const px = Math.round(pose.x0 + dx * t + (dy ? curl : 0));
        const py = Math.round(pose.y0 + dy * t + (dx ? curl : 0));
        g.rect(px, py + 1, 1, 1).fill({ color: specialInk(0x596e8c, pose.color), alpha: pose.alpha });
        g.rect(px, py, 1, 1).fill({ color: specialInk(0xe0e1e3, pose.color), alpha: pose.alpha });
      }
    }
    const sprite = this.sprite(this.frames[look.impact ? 2 : 1]![look.frame]!, pose.color);
    sprite.anchor.set(look.impact ? 0.5 : 0.75, 0.5);
    sprite.width = sprite.height = look.impact ? 20 : 16;
    sprite.position.set(x, y);
    sprite.rotation = look.impact ? 0 : Math.atan2(pose.y1 - pose.y0, pose.x1 - pose.x0);
    sprite.alpha = look.impact ? pose.alpha * (1 - look.frame / 5) : 1;
    return true;
  }

  private sprite(texture: Texture, color?: number | null | undefined): Sprite {
    let sprite = this.sprites[this.used++];
    if (!sprite) {
      sprite = new Sprite(texture);
      this.sprites.push(sprite);
      this.root.addChild(sprite);
    }
    sprite.texture = specialTexture(texture, color);
    sprite.tint = 0xffffff;
    sprite.rotation = 0;
    sprite.alpha = 1;
    sprite.visible = true;
    return sprite;
  }
}
