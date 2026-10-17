import { Container, Graphics, Text } from "pixi.js";
import { FUSE_TICKS, ItemKind, TILE, Tile, getTile, type MatchState } from "@bombtopia/shared";

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
  players: [0xf5f5f5, 0x2b2b2b, 0xe84a4a, 0x3d7bf2, 0x45c25b],
  items: { [ItemKind.Fire]: 0xff7a1a, [ItemKind.Bomb]: 0x15151f, [ItemKind.Speed]: 0x3fd0ff },
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

  constructor() {
    this.banner.anchor.set(0.5);
    this.root.addChild(this.world, this.banner);
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
      const cx = b.x * TILE_PX + TILE_PX / 2;
      const cy = b.y * TILE_PX + TILE_PX / 2 + 1;
      g.circle(cx, cy, 6 + pulse).fill(COLORS.bomb);
      g.circle(cx + 3, cy - 6, 1.5).fill(COLORS.fuse);
    }

    s.players.forEach((p, i) => {
      if (!p.alive) return;
      const from = prev.get(p.id) ?? p;
      const ux = from.px + (p.px - from.px) * alpha;
      const uy = from.py + (p.py - from.py) * alpha;
      const cx = (ux / TILE) * TILE_PX;
      const cy = (uy / TILE) * TILE_PX;
      g.ellipse(cx, cy + 6, 5, 2).fill({ color: 0x000000, alpha: 0.3 });
      g.circle(cx, cy - 1, 6).fill(COLORS.players[i % COLORS.players.length]!).stroke({ color: 0x000000, width: 1 });
      g.rect(cx - 3, cy - 3, 2, 3).fill(0x000000);
      g.rect(cx + 1, cy - 3, 2, 3).fill(0x000000);
    });

    this.banner.position.set((width * TILE_PX) / 2, (height * TILE_PX) / 2);
  }

  showBanner(text: string): void {
    this.banner.text = text;
  }
}
