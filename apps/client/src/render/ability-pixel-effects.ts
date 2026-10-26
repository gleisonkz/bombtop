import { specialTexture } from "./special-palette";
import { Assets, Container, Rectangle, Sprite, Texture } from "pixi.js";

export const ABILITY_PIXEL_EFFECTS = {
  url: "sprites/ability-effects-pixel.png",
  cell: 64,
  frames: 4,
  ticksPerFrame: 5,
  kinds: ["ki", "chakra", "lantern", "patronus", "shield", "exhaust", "kick", "promise"],
} as const;

export type AbilityPixelKind = typeof ABILITY_PIXEL_EFFECTS.kinds[number];
export type AbilityPixelPose = {
  x: number;
  y: number;
  tick: number;
  alpha?: number;
  size?: number;
  rotation?: number;
  color?: number | null | undefined;
};

const FOOTPRINTS: Record<AbilityPixelKind, number> = {
  ki: 24, chakra: 20, lantern: 40, patronus: 40,
  shield: 36, exhaust: 20, kick: 28, promise: 24,
};

export class AbilityPixelEffects {
  readonly root = new Container();
  private frames: Texture[][] | null = null;
  private loading: Promise<void> | null = null;
  private readonly sprites: Sprite[] = [];
  private used = 0;

  async load(): Promise<void> {
    if (this.frames) return;
    this.loading ??= this.loadAtlas();
    try {
      await this.loading;
    } finally {
      this.loading = null;
    }
  }

  private async loadAtlas(): Promise<void> {
    const { url, cell, frames, kinds } = ABILITY_PIXEL_EFFECTS;
    const atlas = await Assets.load<Texture>(`${import.meta.env.BASE_URL}${url}`);
    atlas.source.scaleMode = "nearest";
    atlas.source.addressMode = "clamp-to-edge";
    this.frames = kinds.map((_, row) => Array.from({ length: frames }, (_, frame) =>
      new Texture({ source: atlas.source, frame: new Rectangle(frame * cell, row * cell, cell, cell) }),
    ));
  }

  beginFrame(): void {
    this.used = 0;
    for (const sprite of this.sprites) sprite.visible = false;
  }

  draw(kind: AbilityPixelKind, pose: AbilityPixelPose): boolean {
    if (!this.frames) return false;
    const size = pose.size ?? FOOTPRINTS[kind];
    const alpha = pose.alpha ?? 1;
    const rotation = pose.rotation ?? 0;
    if (![pose.x, pose.y, pose.tick, size, alpha, rotation].every(Number.isFinite) || size <= 0) return false;
    const row = ABILITY_PIXEL_EFFECTS.kinds.indexOf(kind);
    const count = ABILITY_PIXEL_EFFECTS.frames;
    const phase = Math.floor(pose.tick / ABILITY_PIXEL_EFFECTS.ticksPerFrame);
    const frame = ((phase % count) + count) % count;
    const texture = this.frames[row]?.[frame];
    if (!texture) return false;
    let sprite = this.sprites[this.used++];
    if (!sprite) {
      sprite = new Sprite(texture);
      this.sprites.push(sprite);
      this.root.addChild(sprite);
    }
    sprite.texture = specialTexture(texture, pose.color);
    sprite.anchor.set(0.5);
    sprite.pivot.set(0);
    sprite.skew.set(0);
    sprite.scale.set(size / ABILITY_PIXEL_EFFECTS.cell);
    sprite.position.set(Math.round(pose.x), Math.round(pose.y));
    sprite.rotation = rotation;
    sprite.alpha = Math.max(0, Math.min(1, alpha));
    sprite.tint = 0xffffff;
    sprite.blendMode = "normal";
    sprite.zIndex = 0;
    sprite.roundPixels = true;
    sprite.renderable = true;
    sprite.visible = true;
    return true;
  }
}
