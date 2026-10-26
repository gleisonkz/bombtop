import { Assets, Container, Graphics, Sprite, Text, type Texture } from "pixi.js";
import { Floor, TILE, Tile, getFloor, getTile, type Facing, type MatchState } from "@bombtop/shared";

type Scene = Pick<MatchState, "grid" | "stageState" | "stage" | "tick">;
const PROPS = ["clock", "rolling-ball", "forest-pit", "electric-fence", "direction-panel", "foliage", "slots", "slot-switch", "seesaw", "costume-mask", "trolley", "flag"] as const;
type Prop = typeof PROPS[number];
const SURPRISE_COLORS = { normal: 0xffffff, ice: 0x9ee8ff, sticky: 0xd9a04c, reverse: 0xdb9cff };
const FLOOR_PROPS = new Map<Floor, Prop>([
  [Floor.Pit, "forest-pit"], [Floor.Surprise, "direction-panel"], [Floor.Foliage, "foliage"],
  [Floor.Slot, "slot-switch"], [Floor.Seesaw, "seesaw"], [Floor.Flag, "flag"],
]);
const ANGLES: Record<Facing, number> = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };

export function stageFlightLift({ flight, y, bodyHeight, elevated }: {
  flight: { ticks: number } | undefined; y: number; bodyHeight: number; elevated: boolean;
}): number {
  if (!flight || elevated || !Number.isFinite(flight.ticks)) return 0;
  const progress = Math.max(0, Math.min(1, flight.ticks / 24));
  return Math.min(48 * progress * (1 - progress), Math.max(0, y - bodyHeight));
}

export class Sb4StageEffects {
  readonly ground = new Container();
  readonly above = new Container();
  private readonly rails = new Graphics();
  private readonly art = new Map<Prop, Texture>();
  private readonly pending = new Map<Prop, Promise<void>>();
  private readonly sprites: { sprite: Sprite; layer: Container }[] = [];
  private used = 0;
  private readonly reelLabels: Text[] = [];

  constructor() { this.ground.addChild(this.rails); }

  async load(): Promise<void> {
    await Promise.all(PROPS.map(prop => {
      if (this.art.has(prop)) return;
      let loading = this.pending.get(prop);
      if (!loading) {
        loading = Assets.load<Texture>(`${import.meta.env.BASE_URL}sprites/sb4-battle/prop-${prop}.png`)
          .then(texture => { texture.source.scaleMode = "linear"; this.art.set(prop, texture); })
          .catch(error => { console.warn(`Stage prop art unavailable: ${prop}`, error); })
          .finally(() => { this.pending.delete(prop); });
        this.pending.set(prop, loading);
      }
      return loading;
    }));
  }

  private place(prop: Prop, pose: { x: number; y: number; size?: number; rotation?: number; alpha?: number; above?: boolean; tint?: number }): void {
    const texture = this.art.get(prop);
    if (!texture) return;
    const layer = pose.above ? this.above : this.ground;
    let entry = this.sprites[this.used];
    if (!entry) {
      const sprite = new Sprite(); sprite.anchor.set(0.5);
      entry = { sprite, layer }; this.sprites.push(entry); layer.addChild(sprite);
    } else if (entry.layer !== layer) { layer.addChild(entry.sprite); entry.layer = layer; }
    this.used++;
    const { sprite } = entry;
    sprite.texture = texture;
    sprite.position.set(pose.x, pose.y);
    sprite.scale.set((pose.size ?? 16) / Math.max(texture.width, texture.height));
    sprite.rotation = pose.rotation ?? 0;
    sprite.alpha = pose.alpha ?? 1;
    sprite.tint = pose.tint ?? 0xffffff;
    sprite.visible = true;
  }

  costume(pose: { x: number; y: number; alpha: number }): void {
    this.place("costume-mask", { ...pose, above: true, size: 8 });
  }

  draw(state: Scene, ownerColor?: (id: string) => number | undefined): void {
    this.used = 0;
    for (const { sprite } of this.sprites) sprite.visible = false;
    for (const label of this.reelLabels) label.visible = false;
    this.rails.clear();
    this.floor(state);
    this.trolleyRails(state);
    this.props(state, ownerColor);
  }

  private floor(state: Scene): void {
    const dynamic = state.stageState;
    for (let y = 0; y < state.grid.height; y++) {
      for (let x = 0; x < state.grid.width; x++) {
        if (getTile(state, x, y) !== Tile.Empty) continue;
        const floor = getFloor(state, x, y);
        const pose = { x: (x + 0.5) * 16, y: (y + 0.5) * 16 };
        if (floor === Floor.Rail) {
          if (!dynamic?.trolley) this.rail(state, x, y);
          continue;
        }
        if (floor === Floor.Flag && dynamic?.flags) continue;
        if (floor === Floor.Seesaw && dynamic?.seesaws) continue;
        const prop = FLOOR_PROPS.get(floor);
        const surprise = dynamic?.surprise?.[y * state.grid.width + x];
        if (prop) this.place(prop, { ...pose, above: floor === Floor.Foliage,
          tint: surprise ? SURPRISE_COLORS[surprise.kind] : 0xffffff,
          rotation: surprise?.kind === "reverse" ? Math.PI : 0 });
      }
    }
  }

  private props(state: Scene, ownerColor?: (id: string) => number | undefined): void {
    const dynamic = state.stageState;
    if (state.stage === "sb4-02") this.place("clock", { x: state.grid.width * 8, y: 8, size: 14 });
    if (state.stage === "sb4-05") this.fence(state);
    if (dynamic?.roulette) {
      this.place("slots", { x: state.grid.width * 8, y: 8, size: 24, alpha: dynamic.roulette.active ? 1 : 0.7 });
      this.reels(state);
    }
    for (const ball of dynamic?.balls ?? []) this.place("rolling-ball", { x: ball.px / TILE * 16, y: ball.py / TILE * 16 });
    for (const flag of dynamic?.flags ?? []) {
      if (flag.destroyed) continue;
      this.place("flag", { x: (flag.x + 0.5) * 16, y: (flag.y + 0.5) * 16,
        tint: (flag.ownerId ? ownerColor?.(flag.ownerId) : undefined) ?? 0xffffff });
    }
    for (const seesaw of dynamic?.seesaws ?? []) this.place("seesaw", {
      x: (seesaw.x + 0.5) * 16, y: (seesaw.y + 0.5) * 16, size: 48,
      rotation: ANGLES[seesaw.dir] + (seesaw.raised ? -0.15 : 0),
    });
    const trolley = dynamic?.trolley;
    if (trolley) this.place("trolley", { x: trolley.px / TILE * 16, y: trolley.py / TILE * 16, rotation: ANGLES[trolley.dir] });
    for (const honey of dynamic?.honey ?? []) {
      if (honey.takenBy || getTile(state, honey.x, honey.y) !== Tile.Empty) continue;
      this.place("costume-mask", { x: (honey.x + 0.5) * 16, y: (honey.y + 0.5) * 16, size: 12 });
    }
  }

  private reels(state: Scene): void {
    const roulette = state.stageState?.roulette;
    if (!roulette?.reels) return;
    roulette.reels.forEach((symbol, index) => {
      let label = this.reelLabels[index];
      if (!label) {
        label = new Text({ text: "", resolution: 2, style: {
          fontFamily: "monospace", fontSize: 4, fill: 0xffffff, stroke: { color: 0x15152a, width: 1 },
        } });
        label.anchor.set(0.5);
        this.reelLabels.push(label); this.above.addChild(label);
      }
      label.text = symbol === "seven" ? "7" : symbol.toUpperCase();
      label.position.set(state.grid.width * 8 + (index - 1) * 14, 17);
      label.alpha = roulette.stopped?.[index] ? 1 : 0.55;
      label.visible = true;
    });
  }

  private rail(state: Scene, x: number, y: number): void {
    const cx = (x + 0.5) * 16; const cy = (y + 0.5) * 16;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      if (getFloor(state, x + dx, y + dy) !== Floor.Rail) continue;
      for (const offset of [-3, 3]) this.rails.moveTo(cx + dy * offset, cy + dx * offset)
        .lineTo(cx + dx * 8 + dy * offset, cy + dy * 8 + dx * offset).stroke({ color: 0xbfc5ce, width: 1 });
    }
  }

  private trolleyRails(state: Scene): void {
    const trolley = state.stageState?.trolley;
    if (!trolley?.phase || !trolley.route || trolley.route.length < 2) return;
    const [start, ...points] = trolley.route;
    for (const style of [{ color: 0xbfc5ce, width: 7 }, { color: 0x34343e, width: 5 }]) {
      this.rails.moveTo((start!.x + 0.5) * 16, (start!.y + 0.5) * 16);
      for (const point of points) this.rails.lineTo((point.x + 0.5) * 16, (point.y + 0.5) * 16);
      this.rails.stroke(style);
    }
  }

  private fence(state: Scene): void {
    for (let x = 1; x < state.grid.width - 1; x++) {
      this.place("electric-fence", { x: (x + 0.5) * 16, y: 8 });
      this.place("electric-fence", { x: (x + 0.5) * 16, y: (state.grid.height - 0.5) * 16 });
    }
    for (let y = 1; y < state.grid.height - 1; y++) {
      this.place("electric-fence", { x: 8, y: (y + 0.5) * 16, rotation: Math.PI / 2 });
      this.place("electric-fence", { x: (state.grid.width - 0.5) * 16, y: (y + 0.5) * 16, rotation: Math.PI / 2 });
    }
  }
}
