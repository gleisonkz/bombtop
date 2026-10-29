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
  private spinFrames: Texture[] | null = null;
  private speedFrames: Texture[] | null = null;
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
      const [spin, speed] = await Promise.all([
        Assets.load<Texture>(`${import.meta.env.BASE_URL}sprites/donatello-spin-detailed.png?v=thor-cap-20261026`).catch(() => null),
        Assets.load<Texture>(`${import.meta.env.BASE_URL}sprites/flash-speed-force.png?v=native-game-20261026`).catch(() => null),
      ]);
      if (spin && spin.source.width >= 1024 && spin.source.height >= 128) {
        spin.source.scaleMode = "nearest";
        this.spinFrames = Array.from({ length: 8 }, (_, frame) => new Texture({ source: spin.source,
          frame: new Rectangle(frame * 128, 0, 128, 128) }));
      }
      if (speed && speed.source.width >= CELL * 8 && speed.source.height >= CELL * 3) {
        speed.source.scaleMode = "nearest";
        this.speedFrames = Array.from({ length: 8 }, (_, frame) => new Texture({ source: speed.source,
          frame: new Rectangle(frame * CELL, CELL * 2, CELL, CELL) }));
      }
    } catch {
      this.frames = null;
    }
  }

  beginFrame(): void {
    this.used = 0;
    for (const sprite of this.sprites) sprite.visible = false;
  }

  spin(pose: CompanionEffectPose): boolean {
    return this.spinFrames !== null && this.draw("spin", pose);
  }

  draw(kind: CompanionEffectKind, pose: CompanionEffectPose): boolean {
    if (!this.frames) return false;
    const tick = Number.isFinite(pose.tick) ? Math.max(0, pose.tick) : 0;
    const detailedSpin = kind === "spin" && this.spinFrames !== null;
    let frames = this.frames[ROWS[kind]]!;
    let ticksPerFrame = 6;
    if (detailedSpin) {
      frames = this.spinFrames!;
      ticksPerFrame = 3;
    } else if (kind === "speed" && this.speedFrames) {
      frames = this.speedFrames;
      ticksPerFrame = 2;
    }
    const texture = frames[Math.floor(tick / ticksPerFrame) % frames.length]!;
    const cell = detailedSpin ? 128 : CELL;
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
    sprite.scale.set((pose.size ?? FOOTPRINT[kind]) / cell);
    sprite.position.set(Math.round(pose.x), Math.round(pose.y));
    sprite.rotation = pose.rotation ?? 0;
    sprite.alpha = Math.max(0, Math.min(1, pose.alpha ?? 1));
    sprite.tint = 0xffffff;
    sprite.blendMode = "normal";
    sprite.visible = true;
    return true;
  }
}
