import { specialTexture } from "./special-palette";
import { Assets, Container, Rectangle, Sprite, Texture } from "pixi.js";

export type CompanionEffectKind = "heart" | "tunnel" | "mound" | "spin" | "speed" | "smoke" | "stun";
export interface CompanionEffectPose {
  x: number;
  y: number;
  tick: number;
  alpha?: number;
  size?: number;
  rotation?: number;
  color?: number | null | undefined;
}

const ROWS: Record<CompanionEffectKind, number> = { heart: 0, tunnel: 1, spin: 2, speed: 3, smoke: 4, stun: 5, mound: 6 };
const FOOTPRINT: Record<CompanionEffectKind, number> = { heart: 16, tunnel: 24, spin: 28, speed: 24, smoke: 28, stun: 24, mound: 12 };
const CELL = 64;

export class CompanionPixelEffects {
  readonly root = new Container();
  readonly ground = new Container();
  private frames: Texture[][] | null = null;
  private loading: Promise<void> | null = null;
  private readonly sprites: Sprite[] = [];
  private used = 0;

  async load(): Promise<void> {
    if (this.frames) return;
    this.loading ??= this.loadAtlas();
    await this.loading;
    this.loading = null;
  }

  private async loadAtlas(): Promise<void> {
    try {
      const atlas = await Assets.load<Texture>(`${import.meta.env.BASE_URL}sprites/companion-effects-pixel.png?v=2`);
      atlas.source.scaleMode = "nearest";
      this.frames = Array.from({ length: 7 }, (_, row) =>
        Array.from({ length: 4 }, (_, frame) => new Texture({
          source: atlas.source,
          frame: new Rectangle(frame * CELL, row * CELL, CELL, CELL),
        })),
      );
    } catch {
      this.frames = null;
    }
  }

  beginFrame(): void {
    this.used = 0;
    for (const sprite of this.sprites) sprite.visible = false;
  }

  draw(kind: CompanionEffectKind, pose: CompanionEffectPose): boolean {
    if (!this.frames) return false;
    const tick = Number.isFinite(pose.tick) ? Math.max(0, pose.tick) : 0;
    const texture = this.frames[ROWS[kind]]![Math.floor(tick / 6) % 4]!;
    let sprite = this.sprites[this.used++];
    if (!sprite) {
      sprite = new Sprite(texture);
      this.sprites.push(sprite);
    }
    const layer = kind === "tunnel" || kind === "mound" ? this.ground : this.root;
    if (sprite.parent !== layer) layer.addChild(sprite);
    sprite.texture = specialTexture(texture, pose.color);
    sprite.anchor.set(0.5);
    sprite.pivot.set(0);
    sprite.skew.set(0);
    sprite.scale.set((pose.size ?? FOOTPRINT[kind]) / CELL);
    sprite.position.set(Math.round(pose.x), Math.round(pose.y));
    sprite.rotation = pose.rotation ?? 0;
    sprite.alpha = Math.max(0, Math.min(1, pose.alpha ?? 1));
    sprite.tint = 0xffffff;
    sprite.blendMode = "normal";
    sprite.visible = true;
    return true;
  }
}
