import { specialTexture } from "./special-palette";
import { Assets, Container, Rectangle, Sprite, Texture } from "pixi.js";

type EnergyKind = "lightning" | "shock" | "magnet" | "ki";
interface EnergyPath { color?: number | null | undefined; x0: number; y0: number; x1: number; y1: number; tick: number; alpha: number; power?: number }
interface EnergyPart { color?: number | null | undefined; x: number; y: number; width: number; height: number; rotation: number; alpha: number }

const STYLES = {
  lightning: { row: 0, impact: 1, height: 20, size: 20 },
  shock: { row: 2, impact: 5, height: 16, size: 16 },
  magnet: { row: 3, impact: 1, height: 18, size: 20 },
  ki: { row: 6, impact: 7, height: 18, size: 16 },
} satisfies Record<EnergyKind, { row: number; impact: number; height: number; size: number }>;

export class EnergyPixelEffects {
  readonly root = new Container();
  readonly behind = new Container();
  private frames: Texture[][] | null = null;
  private loading: Promise<void> | null = null;
  private readonly sprites: Sprite[] = [];
  private used = 0;

  async load(): Promise<void> {
    if (this.frames) return;
    if (this.loading) return this.loading;
    this.loading = this.loadArt();
    try { await this.loading; } finally { this.loading = null; }
  }

  private async loadArt(): Promise<void> {
    const [atlas, charge] = await Promise.all([
      Assets.load<Texture>(`${import.meta.env.BASE_URL}sprites/energy-effects-pixel.png?v=2`),
      Assets.load<Texture>(`${import.meta.env.BASE_URL}sprites/static-power-pixel.png`).catch(() => null),
    ]);
    atlas.source.scaleMode = "nearest";
    this.frames = Array.from({ length: 12 }, (_, row) =>
      Array.from({ length: 4 }, (_, frame) => new Texture({ source: atlas.source, frame: new Rectangle(frame * 64, row * 64, 64, 64) })),
    );
    if (charge) {
      charge.source.scaleMode = "nearest";
      for (let row = 0; row < 2; row++) this.frames[row + 8] = Array.from({ length: 8 }, (_, frame) =>
        new Texture({ source: charge.source, frame: new Rectangle(frame * 64, row * 64, 64, 64) }),
      );
    }
  }

  beginFrame(): void {
    this.used = 0;
    for (const sprite of this.sprites) sprite.visible = false;
  }

  draw(kind: EnergyKind, pose: EnergyPath): boolean {
    if (!this.frames) return false;
    const dx = pose.x1 - pose.x0;
    const dy = pose.y1 - pose.y0;
    const length = Math.hypot(dx, dy);
    if (length < 0.01 || pose.alpha <= 0) return true;
    const rotation = Math.atan2(dy, dx);
    const frame = Math.floor(Math.max(0, pose.tick) / 3) % 4;
    const magnetic = kind === "magnet";
    const style = STYLES[kind];
    const power = pose.power ?? 1;
    for (let distance = 0; distance < length; distance += 16) {
      const width = Math.min(16, length - distance);
      const t = (distance + width / 2) / length;
      this.part(style.row, (frame + Math.floor(distance / 16)) % 4, {
        x: pose.x0 + dx * t, y: pose.y0 + dy * t, width, height: style.height * power, rotation, alpha: pose.alpha, color: pose.color,
      });
    }
    const size = style.size * power;
    this.part(style.impact, frame, { x: pose.x1, y: pose.y1, width: size, height: size, rotation: 0, alpha: pose.alpha, color: pose.color });
    if (magnetic) {
      for (let i = 0; i < 3; i++) {
        const t = 1 - ((Math.max(0, pose.tick) / 24 + i / 3) % 1);
        this.part(4, frame, { x: pose.x0 + dx * t, y: pose.y0 + dy * t, width: 8, height: 17, rotation, alpha: pose.alpha, color: pose.color });
      }
    }
    return true;
  }

  aura(pose: { x: number; y: number; tick: number; alpha: number; color?: number | null | undefined }): boolean {
    return this.bodyAura(10, pose);
  }

  magnetAura(pose: { x: number; y: number; tick: number; alpha: number; color?: number | null | undefined }): boolean {
    return this.bodyAura(8, pose);
  }

  private bodyAura(row: number, pose: { x: number; y: number; tick: number; alpha: number; color?: number | null | undefined }): boolean {
    if (!this.frames) return false;
    if (pose.alpha <= 0) return true;
    const frame = Math.floor(Math.max(0, pose.tick) / 3) % this.frames[row]!.length;
    const body = { x: pose.x, y: pose.y, width: row === 8 ? 44 : 38, height: row === 8 ? 46 : 40, rotation: 0, alpha: pose.alpha, color: pose.color };
    this.part(row, frame, body);
    this.part(row + 1, frame, body);
    return true;
  }

  private part(row: number, frame: number, pose: EnergyPart): void {
    let sprite = this.sprites[this.used++];
    if (!sprite) {
      sprite = new Sprite();
      sprite.anchor.set(0.5);
      this.sprites.push(sprite);
    }
    const layer = row === 8 || row === 10 ? this.behind : this.root;
    if (sprite.parent !== layer) layer.addChild(sprite);
    sprite.texture = specialTexture(this.frames![row]![frame]!, pose.color);
    sprite.tint = 0xffffff;
    sprite.position.set(Math.round(pose.x), Math.round(pose.y));
    sprite.width = pose.width;
    sprite.height = pose.height;
    sprite.rotation = pose.rotation;
    sprite.alpha = Math.max(0, Math.min(1, pose.alpha));
    sprite.visible = true;
  }
}
