import { Container, Graphics, Text } from "pixi.js";
import { AIR_TICKS_PER_TILE, DIR_VECTORS, FUSE_TICKS, ROUND_TICKS, TICK_RATE, ItemKind, TILE, Tile, Floor, getFloor, getTile, perimeter, type Facing, type MatchState } from "@bombtopia/shared";

/** Sprite size in art pixels; the stage is scaled up by an integer factor. */
export const TILE_PX = 16;

const COLORS = {
  floorA: 0x2f6b3a,
  floorB: 0x2a6234,
  wall: 0x5b5f73,
  wallTop: 0x7c8199,
  block: 0xa86b3c,
  blockEdge: 0x7a4a26,
  bomb: 0x15151f,
  fuse: 0xffd23f,
  flame: 0xff7a1a,
  flameCore: 0xfff1a8,
  cursed: 0xb57bff,
  cart: 0x8d6e63,
  belt: 0x3a3f4b,
  beltArrow: 0xffd23f,
  warp: 0x240046,
  warpCore: 0xc77dff,
  mounts: { hopper: 0x7bd389, dasher: 0xf28482, pusher: 0x84a59d },
  players: [0xf5f5f5, 0x2b2b2b, 0xe84a4a, 0x3d7bf2, 0x45c25b],
  items: {
    [ItemKind.Fire]: 0xff7a1a,
    [ItemKind.Bomb]: 0x15151f,
    [ItemKind.Speed]: 0x3fd0ff,
    [ItemKind.Kick]: 0x9b5de5,
    [ItemKind.Remote]: 0xe63946,
    [ItemKind.Pierce]: 0x48cae4,
    [ItemKind.Punch]: 0xf4a261,
    [ItemKind.Glove]: 0xffffff,
    [ItemKind.Skull]: 0x6a0dad,
    [ItemKind.FullFire]: 0xffd23f,
    [ItemKind.Egg]: 0xfff3e0,
  } satisfies Record<ItemKind, number>,
};

const BELT_DIRS: Partial<Record<Floor, Facing>> = {
  [Floor.ConveyorUp]: "up",
  [Floor.ConveyorDown]: "down",
  [Floor.ConveyorLeft]: "left",
  [Floor.ConveyorRight]: "right",
};

export interface PlayerPos {
  px: number;
  py: number;
}

/** Placeholder renderer: flat shapes until real sprites exist. */
export class Renderer {
  readonly root = new Container();
  private readonly world = new Graphics();
  private readonly banner = new Text({
    text: "",
    resolution: 4, // stays crisp when the stage is scaled up
    style: { fill: 0xffffff, fontFamily: "monospace", fontSize: 12, align: "center", stroke: { color: 0, width: 4 } },
  });

  private readonly clock = new Text({
    text: "",
    resolution: 4,
    style: { fill: 0xffffff, fontFamily: "monospace", fontSize: 8, stroke: { color: 0, width: 2 } },
  });

  constructor() {
    this.banner.anchor.set(0.5);
    this.clock.anchor.set(0.5, 0);
    this.root.addChild(this.world, this.banner, this.clock);
  }

  /**
   * Draws the match. `prev` holds player positions from the previous tick so
   * movement can be interpolated by `alpha` (0..1) between ticks.
   */
  draw(s: MatchState, prev: Map<string, PlayerPos>, alpha: number): void {
    const g = this.world.clear();
    const { width, height } = s.grid;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const px = x * TILE_PX;
        const py = y * TILE_PX;
        const tile = getTile(s, x, y);
        if (tile === Tile.Wall) {
          g.rect(px, py, TILE_PX, TILE_PX).fill(COLORS.wall);
          g.rect(px, py, TILE_PX, 4).fill(COLORS.wallTop);
        } else if (tile === Tile.Block) {
          g.rect(px, py, TILE_PX, TILE_PX).fill(COLORS.blockEdge);
          g.rect(px + 1, py + 1, TILE_PX - 2, TILE_PX - 3).fill(COLORS.block);
        } else {
          g.rect(px, py, TILE_PX, TILE_PX).fill((x + y) % 2 ? COLORS.floorA : COLORS.floorB);
          this.drawFloor(g, getFloor(s, x, y), px, py, s.tick);
        }
      }
    }

    for (const item of s.items) {
      if (getTile(s, item.x, item.y) !== Tile.Empty) continue;
      const cx = item.x * TILE_PX + TILE_PX / 2;
      const cy = item.y * TILE_PX + TILE_PX / 2;
      g.roundRect(cx - 6, cy - 6, 12, 12, 2).fill(0xf2e6c9);
      g.circle(cx, cy, 4).fill(COLORS.items[item.kind]);
    }

    for (const f of s.flames) {
      g.rect(f.x * TILE_PX, f.y * TILE_PX, TILE_PX, TILE_PX).fill(COLORS.flame);
      g.rect(f.x * TILE_PX + 4, f.y * TILE_PX + 4, TILE_PX - 8, TILE_PX - 8).fill(COLORS.flameCore);
    }

    for (const b of s.bombs) {
      const pulse = Math.sin(((FUSE_TICKS - b.fuse) / 60) * Math.PI * 4) * 0.8;
      const moving = b.air?.dir ?? b.slide;
      const [dx, dy] = moving ? DIR_VECTORS[moving] : [0, 0];
      const t = b.air ? b.air.progress / AIR_TICKS_PER_TILE : b.offset / TILE;
      const lift = b.air ? Math.sin(t * Math.PI) * 6 + 4 : 0; // hop arc while airborne
      const cx = b.x * TILE_PX + TILE_PX / 2 + dx * t * TILE_PX;
      const cy = b.y * TILE_PX + TILE_PX / 2 + 1 + dy * t * TILE_PX - lift;
      g.circle(cx, cy, 6 + pulse).fill(COLORS.bomb);
      g.circle(cx + 3, cy - 6, 1.5).fill(COLORS.fuse);
    }

    const ring = perimeter(width, height);
    s.players.forEach((p, i) => {
      const color = COLORS.players[i % COLORS.players.length]!;
      if (!p.alive) {
        const t = p.cart && ring[p.cart.pos];
        if (!t) return;
        const cx = t.x * TILE_PX + TILE_PX / 2;
        const cy = t.y * TILE_PX + TILE_PX / 2;
        g.roundRect(cx - 7, cy - 1, 14, 7, 2).fill(COLORS.cart).stroke({ color: 0x000000, width: 1 });
        g.circle(cx, cy - 3, 4).fill(color).stroke({ color: 0x000000, width: 1 });
        return;
      }
      const from = prev.get(p.id) ?? p;
      const ux = from.px + (p.px - from.px) * alpha;
      const uy = from.py + (p.py - from.py) * alpha;
      const cx = (ux / TILE) * TILE_PX;
      const cy = (uy / TILE) * TILE_PX;
      if (p.invuln > 0 && Math.floor(s.tick / 4) % 2 === 0) return; // blink while invulnerable
      g.ellipse(cx, cy + 6, 5, 2).fill({ color: 0x000000, alpha: 0.3 });
      if (p.mount) {
        g.ellipse(cx, cy + 3, 7, 4).fill(COLORS.mounts[p.mount]).stroke({ color: 0x000000, width: 1 });
      }
      const cursedFlash = p.curse && Math.floor(s.tick / 6) % 2 === 0;
      const body = cursedFlash ? COLORS.cursed : color;
      g.circle(cx, cy - 1, 6).fill(body).stroke({ color: 0x000000, width: 1 });
      g.rect(cx - 3, cy - 3, 2, 3).fill(0x000000);
      g.rect(cx + 1, cy - 3, 2, 3).fill(0x000000);
    });

    this.banner.position.set((width * TILE_PX) / 2, (height * TILE_PX) / 2);
    this.clock.position.set((width * TILE_PX) / 2, 3);
    const left = Math.max(0, Math.ceil((ROUND_TICKS - s.tick) / TICK_RATE));
    this.clock.text = left > 0 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : "SUDDEN DEATH!";
  }

  private drawFloor(g: Graphics, floor: Floor, px: number, py: number, tick: number): void {
    if (floor === Floor.Warp) {
      const pulse = 1 + Math.sin(tick / 8) * 0.6;
      g.circle(px + TILE_PX / 2, py + TILE_PX / 2, 6).fill(COLORS.warp);
      g.circle(px + TILE_PX / 2, py + TILE_PX / 2, 3 + pulse).fill(COLORS.warpCore);
      return;
    }
    const belt = BELT_DIRS[floor];
    if (!belt) return;
    const [dx, dy] = DIR_VECTORS[belt];
    g.rect(px, py, TILE_PX, TILE_PX).fill(COLORS.belt);
    // Chevrons scroll in the belt direction.
    const shift = (tick / 2) % 8;
    for (let k = -1; k < 2; k++) {
      const o = k * 8 + shift;
      const cx = px + TILE_PX / 2 + dx * o;
      const cy = py + TILE_PX / 2 + dy * o;
      if (cx < px || cx > px + TILE_PX || cy < py || cy > py + TILE_PX) continue;
      g.moveTo(cx - dy * 4 - dx * 2, cy - dx * 4 - dy * 2)
        .lineTo(cx + dx * 2, cy + dy * 2)
        .lineTo(cx + dy * 4 - dx * 2, cy + dx * 4 - dy * 2)
        .stroke({ color: COLORS.beltArrow, width: 1.5 });
    }
  }

  showBanner(text: string): void {
    this.banner.text = text;
  }
}
