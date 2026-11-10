import { Assets, Container, Graphics, Sprite, Text, type Texture } from "pixi.js";
import { Floor, TILE, Tile, getFloor, getTile, seesawHopLift, type Facing, type MatchState } from "@bombtop/shared";

type Scene = Pick<MatchState, "grid" | "stageState" | "stage" | "tick">;
const PROPS = ["clock", "rolling-ball", "forest-pit", "electric-fence", "direction-panel", "foliage", "slots", "slot-switch", "seesaw-plank", "seesaw-base", "costume-mask", "trolley", "flag"] as const;
type Prop = typeof PROPS[number];
const SURPRISE_COLORS = { normal: 0xffffff, ice: 0x9ee8ff, sticky: 0xd9a04c, reverse: 0xdb9cff };
const FLOOR_PROPS = new Map<Floor, Prop>([
  [Floor.Pit, "forest-pit"], [Floor.Surprise, "direction-panel"], [Floor.Foliage, "foliage"],
  [Floor.Slot, "slot-switch"], [Floor.Seesaw, "seesaw-plank"], [Floor.Flag, "flag"],
]);
const ANGLES: Record<Facing, number> = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };

/**
 * The seesaw seen from above, as the arena is: the plank lies along its row, its pivot SEESAW_PIVOT px off
 * the floor, and tilting raises one end and lowers the other by SEESAW_TILT px a tile (the low tip, a tile
 * and a half out, rests on the floor). Heights are screen pixels up from the floor.
 */
const SEESAW_PIVOT = 6;
const SEESAW_TILT = 3;
const SEESAW_THICK = 2;
const SEESAW_PLANK_ART = 106; // plank's width in its 128 px cell
type SeesawLike = { x: number; y: number; dir: Facing; raised: boolean };

/** Height gained per tile toward the seesaw's +dir end: raised has the +dir end up: the end the sim's
 * `endpoint(saw, true)` names "low" is the one a player steps on to tip it down, so it is drawn up (as SB4 draws it). */
function seesawRise(saw: SeesawLike): number { return saw.raised ? SEESAW_TILT : -SEESAW_TILT; }

/** How far up a player standing at (px, py) (screen pixels, their tile's ground point) is lifted by a seesaw plank. */
export function seesawStandLift(state: Pick<MatchState, "stageState">, px: number, py: number): number {
  for (const saw of state.stageState?.seesaws ?? []) {
    const horizontal = saw.dir === "left" || saw.dir === "right";
    const along = horizontal ? px / 16 - (saw.x + 0.5) : py / 16 - (saw.y + 0.5);
    const across = horizontal ? Math.floor(py / 16) - saw.y : Math.floor(px / 16) - saw.x;
    if (across !== 0 || Math.abs(along) > 1.5) continue;
    const sign = saw.dir === "right" || saw.dir === "down" ? 1 : -1;
    return SEESAW_THICK + Math.max(0, SEESAW_PIVOT + along * sign * seesawRise(saw));
  }
  return 0;
}

/** A bomb resting on a seesaw sits on the plank (screen point (px, py) is its ground centre); in the air or in hand it does not. */
export function seesawBombLift(state: Pick<MatchState, "stageState">, bomb: { air?: unknown; heldBy?: string | null }, px: number, py: number): number {
  return bomb.air || bomb.heldBy ? 0 : seesawStandLift(state, px, py);
}

export function stageFlightLift({ flight, y, bodyHeight, elevated }: {
  flight: { ticks: number; kind?: "seesaw" | "seesawRebound" } | undefined; y: number; bodyHeight: number; elevated: boolean;
}): number {
  if (!flight || elevated || !Number.isFinite(flight.ticks)) return 0;
  if (flight.kind === "seesaw" || flight.kind === "seesawRebound") return Math.min(seesawHopLift(flight), Math.max(0, y - bodyHeight));
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

  private place(prop: Prop, pose: { x: number; y: number; size?: number; rotation?: number; alpha?: number; above?: boolean; tint?: number; squash?: number; skewY?: number }): void {
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
    const scale = (pose.size ?? 16) / Math.max(texture.width, texture.height);
    const skewY = pose.skewY ?? 0;
    // A vertical shear (skew.y) also narrows the sprite by its cosine: widen it back so the plank keeps its length.
    sprite.scale.set(scale / Math.cos(skewY), scale * (pose.squash ?? 1));
    sprite.skew.set(0, skewY);
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
        const floor = getFloor(state, x, y);
        // Foliage grows over some of SB4 stage 7's pillars too, hiding them.
        if (getTile(state, x, y) !== Tile.Empty && !(floor === Floor.Foliage && getTile(state, x, y) === Tile.Wall)) continue;
        const pose = { x: (x + 0.5) * 16, y: (y + 0.5) * 16 };
        if (floor === Floor.Rail) {
          if (!dynamic?.trolley) this.rail(state, x, y);
          continue;
        }
        if (floor === Floor.Flag && dynamic?.flags) continue;
        if (floor === Floor.Seesaw && dynamic?.seesaws) continue;
        const prop = FLOOR_PROPS.get(floor);
        const surprise = dynamic?.surprise?.[y * state.grid.width + x];
        if (floor === Floor.Surprise && (!surprise || surprise.kind === "normal")) continue;
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
    for (const seesaw of dynamic?.seesaws ?? []) this.seesaw(seesaw);
    const trolley = dynamic?.trolley;
    if (trolley) this.place("trolley", { x: trolley.px / TILE * 16, y: trolley.py / TILE * 16, rotation: ANGLES[trolley.dir] });
    for (const honey of dynamic?.honey ?? []) {
      if (honey.takenBy || getTile(state, honey.x, honey.y) !== Tile.Empty) continue;
      this.place("costume-mask", { x: (honey.x + 0.5) * 16, y: (honey.y + 0.5) * 16, size: 12 });
    }
  }

  /**
   * The pivot's foot stays put on the floor of the middle tile; the plank lies flat along the row, lifted to
   * the pivot's height, and leans by a vertical shear: its high end drawn higher, never rotated.
   */
  private seesaw(saw: SeesawLike): void {
    const cx = (saw.x + 0.5) * 16; const cy = (saw.y + 0.5) * 16;
    const horizontal = saw.dir === "left" || saw.dir === "right";
    const size = 48 * 128 / SEESAW_PLANK_ART;
    if (horizontal) this.rails.roundRect(cx - 24, cy + 3, 48, 4, 2).fill({ color: 0x000000, alpha: 0.28 });
    else this.rails.roundRect(cx - 3, cy - 22, 6, 46, 2).fill({ color: 0x000000, alpha: 0.28 });
    this.place("seesaw-base", { x: cx, y: cy + 4, size, squash: 0.6 });
    const sign = saw.dir === "left" ? -1 : 1;
    if (horizontal) this.place("seesaw-plank", { x: cx, y: cy + 2 - SEESAW_PIVOT, size, skewY: Math.atan(-sign * seesawRise(saw) / 16) });
    else this.place("seesaw-plank", { x: cx, y: cy - SEESAW_PIVOT, size, rotation: Math.PI / 2 });
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
    // SB4 shows the route from boarding until the trolley stops back at its station: gone as the rider gets off.
    if (!trolley?.phase || trolley.phase === "leaving" || !trolley.route || trolley.route.length < 2) return;
    const [start, ...points] = trolley.route;
    for (const style of [{ color: 0xbfc5ce, width: 7 }, { color: 0x34343e, width: 5 }]) {
      this.rails.moveTo((start!.x + 0.5) * 16, (start!.y + 0.5) * 16);
      for (const point of points) this.rails.lineTo((point.x + 0.5) * 16, (point.y + 0.5) * 16);
      this.rails.stroke(style);
    }
    // The station the trip starts and ends at shows its turntable while the trip lasts (SB4, stage 11).
    const cx = (start!.x + 0.5) * 16; const cy = (start!.y + 0.5) * 16;
    this.rails.circle(cx, cy, 6.5).fill({ color: 0x3a2a18 }).circle(cx, cy, 6.5).stroke({ color: 0xbfc5ce, width: 1.5 });
    this.rails.circle(cx, cy, 3.5).stroke({ color: 0x8a7350, width: 1.5 }).circle(cx, cy, 1.5).fill({ color: 0xbfc5ce });
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
