import { Assets, Container, Graphics, Rectangle, Sprite, Text, Texture } from "pixi.js";
import { mascotSvg, PLAYER_COLORS, type MascotView, type Mood } from "../ui/art";
import { airLift } from "./air-arc";
import { Fx } from "./fx";
import { paintTo, PerColor, skinColor } from "./per-color";
import { BOMBS, FLAMES, RASENGAN, rasenganLook, between, ITEMS, MASCOT, TILES, burnCell, castsShadow, itemCell, itemFrame, tileCell, MotionTracker, beamAlpha, BEAM_DELAY, boltOrigin, boltPoints, magnetWaves, speedLines, tunnelMounds, spinLook, kissHearts, charmHearts, sneakAlpha, patronusLook, PATRONUS, truckLook, TRUCK, bubbleLook, BUBBLE, bracing, castTicks, KAMEHAMEHA, kameSegments, outsideBeams, outsideBubbles, type KamePiece, flameFrame, flamePiece, type FlamePiece, bombFrame, bombLook, deathFrame, frozenLook, iceBlock, webbedLook, cocoon, mascotDeath, mascotPose, paintSheet, playerFrame, SHEETS, SPIRAL, spiralFrame, type FrameRect, type SheetLayout } from "./sprites";
import { AIR_TICKS_PER_TILE, BLAST_TICKS, blastLife, PATRONUS_TICKS_PER_TILE, DEFAULT_CHARACTER, DIR_VECTORS, FUSE_TICKS, KAME_CHARGE, ROUND_TICKS, TICK_RATE, ItemKind, TILE, Tile, Floor, getFloor, getTile, perimeter, SHIELD_TICKS, TRUCK_TICKS, type Blast, type Bomb, type BombType, type CharacterId, type Facing, type PublicView } from "@bombtop/shared";

/** Sprite size in art pixels; the stage is scaled up by an integer factor. */
export const TILE_PX = 16;

const COLORS = {
  heart: 0xff4f9a,
  /** The glow round harry's stag and its sparkles. */
  patronus: 0xbfe8ff,
  energon: 0x7fd0ff,
  exhaust: 0x8c8c96,
  truck: 0xd8262e,
  /** The puff the pink panther leaves as he slips out of sight. */
  sneakPuff: 0xf7a6cf,
  heartShine: 0xffd0e6,
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
  ice: 0x7fd8ff,
  bolt: 0xffe45c,
  /** Static's electromagnetism: light violet. */
  magnet: 0xb9a4ff,
  /** The flash's suit, for his speed lines. */
  speed: 0xe8352e,
  /** The green lantern's will: emerald light. */
  lantern: 0x4dff6e,
  /** Donatello's bo staff: wood, and the pale blur of it whirling. */
  staff: 0x8a5a2b,
  staffBlur: 0xe8d9b0,
  /** Bugs' tunnel: dug-up earth, its shade and the dark of the holes. */
  dirt: 0x9a6a3c,
  dirtShade: 0x5e3d20,
  hole: 0x2a1a0e,
  ki: 0x7fdcff,
  web: 0xf4f4f8,
  webShade: 0x9a9aa8,
  cart: 0x8d6e63,
  belt: 0x3a3f4b,
  beltArrow: 0xffd23f,
  warp: 0x240046,
  warpCore: 0xc77dff,
  mounts: { hopper: 0x7bd389, dasher: 0xf28482, pusher: 0x84a59d },
  players: PLAYER_COLORS.map((c) => parseInt(c.slice(1), 16)),
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

/** A character sheet repainted in each player color it is drawn in. */
interface Skin {
  sheet: SheetLayout;
  sources: PerColor<Texture>;
  frames: Map<string, Texture>;
}

/** Loads a sheet; each player color is painted the first time a player in it is drawn. */
async function loadSkin(sheet: SheetLayout): Promise<Skin> {
  const base: Texture = await Assets.load(`${import.meta.env.BASE_URL}${sheet.url}`);
  const img = base.source.resource as CanvasImageSource;
  const frames = new Map<string, Texture>();
  const paint = (player: number): Texture => {
    const rgb = paintTo(player, COLORS.players);
    const canvas = document.createElement("canvas");
    canvas.width = sheet.width;
    canvas.height = sheet.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    if (rgb) {
      const data = ctx.getImageData(0, 0, sheet.width, sheet.height);
      paintSheet(data.data, sheet, rgb);
      ctx.putImageData(data, 0, 0);
    }
    const tex = Texture.from(canvas);
    tex.source.scaleMode = sheet.url === SHEETS.bomber.url ? "nearest" : (sheet.scale ?? 1) < 1 ? "linear" : "nearest";
    return tex;
  };
  const free = (tex: Texture): void => {
    const canvas = tex.source.resource as HTMLCanvasElement;
    tex.destroy(true);
    canvas.width = canvas.height = 0; // iOS keeps a canvas's pixels until it is shrunk
    frames.clear();
  };
  return { sheet, sources: new PerColor(paint, free), frames };
}

/** Mascot pixels per SVG unit: drawn larger than shown so it stays smooth when the stage is scaled up. */
const MASCOT_RES = 2;

const mascotKey = (player: number, mood: Mood, view: MascotView, step: number) => `${player}:${mood}:${view}:${step}`;

async function rasterize(svg: string): Promise<Texture> {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = MASCOT.width * MASCOT_RES;
  canvas.height = MASCOT.height * MASCOT_RES;
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  const tex = Texture.from(canvas);
  tex.source.scaleMode = "linear";
  return tex;
}

/** Placeholder renderer: flat shapes, with sprite characters once a sheet is loaded. */
export class Renderer {
  readonly root = new Container();
  private readonly world = new Graphics();
  /** Flames sit on the floor, under players and bombs. */
  private readonly flameLayer = new Container();
  /** Goku's Kamehameha, over the players. */
  private readonly beamLayer = new Container();
  private kameArt: Record<KamePiece["kind"], Texture[]> | null = null;
  private readonly kameSprites: Sprite[] = [];
  private kameUsed = 0;
  /** Naruto's Rasengan (the ball in his hand, the burst where it strikes), over the players too. */
  private rasenArt: { orb: Texture[]; burst: Texture[] } | null = null;
  private readonly rasenSprites: Sprite[] = [];
  private patronusArt: Record<"side" | "down" | "up", Texture[]> | null = null;
  private readonly patronusSprites: Sprite[] = [];
  private patronusUsed = 0;
  /** Optimus's truck, one per player driving it, among the players (sorted by depth with them). */
  private truckArt: Record<"side" | "down" | "up", Texture[]> | null = null;
  private readonly truckSprites = new Map<string, Sprite>();
  /** Who is turning into the truck, and who drives it: each change bursts into plates and sparks. */
  private shifting = new Set<string>();
  private driving = new Set<string>();
  /** Last tick each truck puffed exhaust. */
  private exhaustAt = new Map<string, number>();
  private rasenUsed = 0;
  private bubbleArt: Texture[][] | null = null;
  private readonly bubbleSprites: Sprite[] = [];
  private bubbleUsed = 0;
  private readonly itemLayer = new Container();
  private readonly tileLayer = new Container();
  private tileArt: Texture[] | null = null;
  private tileScale = TILES.scale;
  private readonly tileSprites: Sprite[] = [];
  /** Blown-up blocks burning away, over the grass they stood on. */
  private readonly burnLayer = new Container();
  private readonly burnSprites: Sprite[] = [];
  private readonly people = new Container();
  private readonly overlay = new Graphics();
  private readonly sprites = new Map<string, Sprite>();
  /** The captain's spiral of light, behind and in front of him, once loaded. */
  private spiralArt: { behind: Texture[]; front: Texture[] } | null = null;
  private readonly skins = new Map<CharacterId, Skin>();
  /** The mascot in each player color and mood (`${player}:${mood}`), once drawn. */
  private mascots: Map<string, Texture> | null = null;
  private characters = new Map<string, CharacterId>();
  /** One texture per bomb type, once the bomb art is loaded. */
  private bombArt: Map<string, Texture> | null = null;
  private readonly bombSprites: Sprite[] = [];
  /** Flame textures by piece, one per stage of the flame's life, once loaded. */
  private flameArt: Record<FlamePiece["kind"], Texture[]> | null = null;
  private readonly flameSprites: Sprite[] = [];
  private itemArt: Map<ItemKind, Texture[]> | null = null;
  private readonly itemSprites: Sprite[] = [];
  private readonly fx = new Fx(TILE_PX);
  /** Tiles as last drawn, to tell which flames just blew up a block. */
  private lastTiles: readonly Tile[] = [];
  private readonly motion = new MotionTracker();
  /** Where and when each player was last seen alive, to play their death there. */
  private readonly lastSeen = new Map<string, { cx: number; cy: number; deadAt: number | null }>();
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

  /** `lite`: weak screens (smart TVs): text drawn at less detail, no particles. */
  constructor(private readonly lite = false) {
    if (lite) this.banner.resolution = this.clock.resolution = 1.5;
    this.banner.anchor.set(0.5);
    this.clock.anchor.set(0.5, 0);
    this.people.sortableChildren = true; // lower players overlap the ones above them
    this.root.addChild(this.tileLayer, this.world, this.burnLayer, this.itemLayer, this.flameLayer, this.people, this.beamLayer, this.overlay, this.banner, this.clock);
  }

  /** Draws a character's players with a sheet instead of shapes. */
  async useSheet(character: CharacterId, sheet: SheetLayout): Promise<void> {
    this.skins.set(character, await loadSkin(sheet));
  }

  /**
   * Draws the bomb mascot in every player color, for players who pick it: each view
   * walking (4 steps, happy), plus the stunned and sad faces where they show.
   */
  async useMascots(): Promise<void> {
    const looks: { mood: Mood; view: MascotView; step: number }[] = [];
    for (const view of ["front", "back", "side"] as const) for (let step = 0; step < 4; step++) looks.push({ mood: "happy", view, step });
    for (const mood of MASCOT.moods) if (mood !== "happy") for (const view of ["front", "side"] as const) looks.push({ mood, view, step: 0 });
    const entries = await Promise.all(
      PLAYER_COLORS.flatMap((color, player) =>
        looks.map(async (l) => [mascotKey(player, l.mood, l.view, l.step), await rasterize(mascotSvg({ color, ...l }))] as const),
      ),
    );
    this.mascots = new Map(entries);
  }

  /** Each player's character, from the lobby. */
  setCharacters(characters: Map<string, CharacterId>): void {
    this.characters = characters;
    // Characters off the stage let go of their painted colors (an iPhone holds only so many canvases).
    const on = new Set(characters.values());
    for (const [character, skin] of this.skins) if (!on.has(character)) skin.sources.clear();
  }

  /** Players who wear another seat's color than their own (the guides dress each character in theirs). */
  setColors(colors: Map<string, number>): void {
    this.colors = colors;
  }

  private colors = new Map<string, number>();

  /**
   * Whose eyes this screen sees through: a sneaking pink panther is gone for everyone else. null for screens that only
   * watch or show several players at once (TV, demo, intro, couch), which see him faint.
   */
  setViewer(id: string | null): void {
    this.viewer = id;
  }

  private viewer: string | null = null;
  /** Who was sneaking last frame, for the puff as he slips away. */
  private sneaking = new Set<string>();

  private character(id: string): CharacterId {
    return this.characters.get(id) ?? DEFAULT_CHARACTER;
  }

  /** Draws bombs with the bomb art instead of shapes. */
  async useSpiralArt(): Promise<void> {
    const base: Texture = await Assets.load(`${import.meta.env.BASE_URL}${SPIRAL.url}`);
    base.source.scaleMode = "linear"; // shrunk to the captain's scale
    const row = (r: number) =>
      Array.from({ length: SPIRAL.frames }, (_, f) => new Texture({ source: base.source, frame: new Rectangle(f * SPIRAL.frameW, r * SPIRAL.frameH, SPIRAL.frameW, SPIRAL.frameH) }));
    this.spiralArt = { behind: row(SPIRAL.rows.behind), front: row(SPIRAL.rows.front) };
  }

  async useKameArt(): Promise<void> {
    const base: Texture = await Assets.load(`${import.meta.env.BASE_URL}${KAMEHAMEHA.url}`);
    base.source.scaleMode = "linear";
    const row = (r: number) =>
      Array.from({ length: KAMEHAMEHA.frames }, (_, f) => new Texture({ source: base.source, frame: new Rectangle(f * KAMEHAMEHA.size, r * KAMEHAMEHA.size, KAMEHAMEHA.size, KAMEHAMEHA.size) }));
    this.kameArt = { orb: row(KAMEHAMEHA.rows.orb), body: row(KAMEHAMEHA.rows.body), head: row(KAMEHAMEHA.rows.head) };
  }

  async useRasenganArt(): Promise<void> {
    const base: Texture = await Assets.load(`${import.meta.env.BASE_URL}${RASENGAN.url}`);
    base.source.scaleMode = "linear";
    const row = (r: number) =>
      Array.from({ length: RASENGAN.frames }, (_, f) => new Texture({ source: base.source, frame: new Rectangle(f * RASENGAN.size, r * RASENGAN.size, RASENGAN.size, RASENGAN.size) }));
    this.rasenArt = { orb: row(RASENGAN.rows.orb), burst: row(RASENGAN.rows.burst) };
  }

  async useBubbleArt(): Promise<void> {
    const base: Texture = await Assets.load(`${import.meta.env.BASE_URL}${BUBBLE.url}`);
    base.source.scaleMode = "linear";
    const row = (r: number, n: number) =>
      Array.from({ length: n }, (_, f) => new Texture({ source: base.source, frame: new Rectangle(f * BUBBLE.size, r * BUBBLE.size, BUBBLE.size, BUBBLE.size) }));
    const { rows, frames } = BUBBLE;
    this.bubbleArt = [];
    this.bubbleArt[rows.form] = row(rows.form, frames.form);
    this.bubbleArt[rows.loop] = row(rows.loop, frames.loop);
    this.bubbleArt[rows.pop] = row(rows.pop, frames.pop);
  }

  async usePatronusArt(): Promise<void> {
    const base: Texture = await Assets.load(`${import.meta.env.BASE_URL}${PATRONUS.url}`);
    base.source.scaleMode = "nearest";
    const { size, frames, rows } = PATRONUS;
    const row = (r: number) => Array.from({ length: frames }, (_, f) => new Texture({ source: base.source, frame: new Rectangle(f * size, r * size, size, size) }));
    this.patronusArt = { side: row(rows.side), down: row(rows.down), up: row(rows.up) };
  }

  async useTruckArt(): Promise<void> {
    const base: Texture = await Assets.load(`${import.meta.env.BASE_URL}${TRUCK.url}`);
    base.source.scaleMode = "nearest";
    const { w, h, frames, rows } = TRUCK;
    const row = (r: number) => Array.from({ length: frames }, (_, f) => new Texture({ source: base.source, frame: new Rectangle(f * w, r * h, w, h) }));
    this.truckArt = { side: row(rows.side), down: row(rows.down), up: row(rows.up) };
  }

  /**
   * Optimus turning into his truck and driving it: a blue glow as he turns, plates and sparks bursting when he becomes
   * the truck and when he turns back, the truck (rumbling, puffing exhaust from its stacks, speed lines behind it)
   * in his place while he drives, its wheels turning. True while the truck stands in for him.
   */
  private drawTruck(g: Graphics, p: Pick<PublicView["players"][number], "id" | "truck" | "facing">, cx: number, cy: number, tick: number, alpha: number): boolean {
    if (p.truck > TRUCK_TICKS) {
      const t = 1 - (p.truck - TRUCK_TICKS) / 12;
      g.circle(cx, cy - 6, 6 + t * 6).fill({ color: COLORS.energon, alpha: 0.12 + 0.2 * t });
      g.circle(cx, cy - 6, 3 + t * 3).fill({ color: 0xffffff, alpha: 0.15 * t });
      if (!this.shifting.has(p.id) && !this.lite) this.fx.transform(cx, cy - 8);
      this.shifting.add(p.id);
    } else this.shifting.delete(p.id);
    const look = truckLook(p, tick);
    if (!look) {
      if (this.driving.has(p.id) && !this.lite) this.fx.transform(cx, cy - 6);
      this.driving.delete(p.id);
      return false;
    }
    if (!this.driving.has(p.id) && !this.lite) this.fx.transform(cx, cy - 6);
    this.driving.add(p.id);
    const [dx, dy] = DIR_VECTORS[p.facing];
    // speed lines behind it
    for (let k = 0; k < 3; k++) {
      const off = (k - 1) * 5 - 6;
      const len = 6 + ((tick + k * 3) % 5);
      const bx = cx - dx * 12;
      const by = cy - dy * 8;
      if (dx) g.moveTo(bx, by + off).lineTo(bx - dx * len, by + off).stroke({ color: 0xffffff, width: 1, alpha: 0.55 * alpha });
      else g.moveTo(bx + off + 6, by).lineTo(bx + off + 6, by - dy * len).stroke({ color: 0xffffff, width: 1, alpha: 0.55 * alpha });
    }
    // exhaust from the stacks, now and then
    if (!this.lite && tick - (this.exhaustAt.get(p.id) ?? -99) >= 5) {
      this.exhaustAt.set(p.id, tick);
      this.fx.puff(cx - dx * 6, cy - 20 - dy * 4, COLORS.exhaust);
    }
    if (!this.truckArt) {
      g.roundRect(cx - 10, cy - 12, 20, 14, 3).fill({ color: COLORS.truck, alpha }).stroke({ color: 0x000000, width: 1 });
      return true;
    }
    let sprite = this.truckSprites.get(p.id);
    if (!sprite) {
      sprite = new Sprite();
      sprite.anchor.set(TRUCK.anchorX / TRUCK.w, TRUCK.anchorY / TRUCK.h);
      this.truckSprites.set(p.id, sprite);
      this.people.addChild(sprite);
    }
    sprite.texture = this.truckArt[look.view][look.frame]!;
    sprite.scale.set(look.flip ? -TRUCK.scale : TRUCK.scale, TRUCK.scale);
    sprite.position.set(cx, cy + 6);
    sprite.zIndex = cy;
    sprite.alpha = alpha;
    sprite.visible = true;
    return true;
  }

  /** Harry's stag galloping along his patronus (its feet on the path), glowing, with sparkles trailing it. */
  private drawPatronus(g: Graphics, x0: number, y0: number, x1: number, y1: number, dir: Facing, run: number, age: number): void {
    const look = patronusLook(x0, y0, x1, y1, dir, run, age);
    if (!look) return;
    for (const s of look.sparkles) g.circle(s.x, s.y - 4, s.size).fill({ color: COLORS.patronus, alpha: s.alpha });
    g.ellipse(look.x, look.y - 9, 13, 9).fill({ color: COLORS.patronus, alpha: 0.18 * look.alpha });
    if (!this.patronusArt) {
      g.ellipse(look.x, look.y - 7, 8, 5).fill({ color: 0xffffff, alpha: look.alpha });
      return;
    }
    let sprite = this.patronusSprites[this.patronusUsed];
    if (!sprite) {
      sprite = new Sprite();
      sprite.anchor.set(PATRONUS.anchorX / PATRONUS.size, PATRONUS.anchorY / PATRONUS.size);
      sprite.blendMode = "add";
      this.patronusSprites.push(sprite);
      this.beamLayer.addChild(sprite);
    }
    this.patronusUsed++;
    sprite.texture = this.patronusArt[look.view][look.frame]!;
    sprite.scale.set(look.flip ? -PATRONUS.scale : PATRONUS.scale, PATRONUS.scale);
    sprite.alpha = look.alpha;
    sprite.position.set(look.x, look.y);
    sprite.visible = true;
  }

  /** The green lantern's bubble round (x,y), from the art once loaded (else a plain green ring). */
  private placeBubble(g: Graphics, look: { row: number; frame: number; alpha: number }, x: number, y: number): void {
    if (!this.bubbleArt) {
      g.circle(x, y, 13).fill({ color: COLORS.lantern, alpha: 0.15 * look.alpha }).stroke({ color: COLORS.lantern, width: 1.5, alpha: look.alpha });
      return;
    }
    let sprite = this.bubbleSprites[this.bubbleUsed];
    if (!sprite) {
      sprite = new Sprite();
      sprite.anchor.set(0.5);
      sprite.blendMode = "add";
      this.bubbleSprites.push(sprite);
      this.beamLayer.addChild(sprite);
    }
    this.bubbleUsed++;
    sprite.texture = this.bubbleArt[look.row]![look.frame]!;
    sprite.scale.set(BUBBLE.scale);
    sprite.alpha = look.alpha;
    sprite.position.set(x, y);
    sprite.visible = true;
  }

  /** The Rasengan's ball or burst at (x,y), from the art once loaded (else a plain glowing ball). */
  private placeRasengan(g: Graphics, look: { orb: number } | { burst: number }, x: number, y: number): void {
    if (!this.rasenArt) {
      const r = "orb" in look ? 3 : 3 + look.burst * 1.5;
      g.circle(x, y, r + 1.5).fill({ color: COLORS.ki, alpha: 0.45 });
      g.circle(x, y, r).fill({ color: 0xffffff, alpha: "orb" in look ? 0.9 : 0.6 });
      return;
    }
    let sprite = this.rasenSprites[this.rasenUsed];
    if (!sprite) {
      sprite = new Sprite();
      sprite.anchor.set(0.5);
      this.rasenSprites.push(sprite);
      this.beamLayer.addChild(sprite);
    }
    this.rasenUsed++;
    sprite.texture = "orb" in look ? this.rasenArt.orb[look.orb]! : this.rasenArt.burst[look.burst]!;
    sprite.scale.set("orb" in look ? RASENGAN.orbScale : RASENGAN.burstScale);
    sprite.position.set(x, y);
    sprite.visible = true;
  }

  async useFlameArt(): Promise<void> {
    const base: Texture = await Assets.load(`${import.meta.env.BASE_URL}${FLAMES.url}`);
    base.source.scaleMode = "linear"; // drawn at half size
    const row = (r: number) =>
      Array.from({ length: FLAMES.frames }, (_, f) => new Texture({ source: base.source, frame: new Rectangle(f * FLAMES.size, r * FLAMES.size, FLAMES.size, FLAMES.size) }));
    this.flameArt = { center: row(FLAMES.rows.center), mid: row(FLAMES.rows.mid), end: row(FLAMES.rows.end) };
  }

  /** Draws the arena (grass, blocks, walls) with the tile art instead of flat colors. */
  async useTileArt(layout: typeof TILES = TILES): Promise<void> {
    const base: Texture = await Assets.load(`${import.meta.env.BASE_URL}${layout.url}`);
    base.source.scaleMode = "linear"; // drawn smaller than the art
    const count = base.width / layout.size;
    this.tileScale = layout.scale;
    this.tileArt = Array.from({ length: count }, (_, i) => new Texture({ source: base.source, frame: new Rectangle(i * layout.size, 0, layout.size, layout.size) }));
  }

  /** `burning`: tile index -> ticks left on a blown-up block's flame. */
  private drawTiles(s: PublicView, burning: ReadonlyMap<number, number>): void {
    const art = this.tileArt!;
    const { width, height } = s.grid;
    for (const sprite of this.tileSprites) sprite.visible = false;
    for (const sprite of this.burnSprites) sprite.visible = false;
    let burns = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        let sprite = this.tileSprites[i];
        if (!sprite) {
          sprite = new Sprite();
          this.tileSprites[i] = sprite;
          this.tileLayer.addChild(sprite);
        }
        const ttl = burning.get(i);
        sprite.texture = art[tileCell(ttl === undefined ? getTile(s, x, y) : Tile.Empty, x, y, width, height)]!;
        sprite.scale.set(this.tileScale);
        sprite.position.set(x * TILE_PX, y * TILE_PX);
        sprite.visible = true;
        if (ttl === undefined) continue;
        let burn = this.burnSprites[burns];
        if (!burn) {
          burn = new Sprite();
          this.burnSprites.push(burn);
          this.burnLayer.addChild(burn);
        }
        burns++;
        burn.texture = art[burnCell(ttl)]!;
        burn.scale.set(this.tileScale);
        burn.position.set(x * TILE_PX, y * TILE_PX);
        burn.visible = true;
      }
    }
  }

  /** Draws power-ups as plates with icons (and a glint now and then) instead of dots. */
  async useItemArt(): Promise<void> {
    const base: Texture = await Assets.load(`${import.meta.env.BASE_URL}${ITEMS.url}`);
    base.source.scaleMode = "linear"; // drawn at under a third of its size
    this.itemArt = new Map(
      ITEMS.order.map((kind) => [
        kind,
        Array.from({ length: ITEMS.frames }, (_, f) => new Texture({ source: base.source, frame: new Rectangle(itemCell(kind), f * ITEMS.size, ITEMS.size, ITEMS.size) })),
      ]),
    );
  }

  private drawItems(items: PublicView["items"], tick: number, visible: (x: number, y: number) => boolean): void {
    for (const sprite of this.itemSprites) sprite.visible = false;
    const art = this.itemArt!;
    let n = 0;
    for (const item of items) {
      if (!visible(item.x, item.y)) continue;
      let sprite = this.itemSprites[n];
      if (!sprite) {
        sprite = new Sprite();
        sprite.anchor.set(0.5);
        sprite.scale.set(ITEMS.scale);
        this.itemSprites.push(sprite);
        this.itemLayer.addChild(sprite);
      }
      n++;
      sprite.texture = art.get(item.kind)![itemFrame(tick, item.x, item.y)]!;
      sprite.position.set((item.x + 0.5) * TILE_PX, (item.y + 0.5) * TILE_PX);
      sprite.visible = true;
    }
  }

  /** Draws flames as art pieces (fireball, arms, tips) picked from their neighbours. */
  private drawFlames(flames: PublicView["flames"]): void {
    for (const sprite of this.flameSprites) sprite.visible = false;
    const art = this.flameArt!;
    const lit = new Set(flames.map((f) => `${f.x},${f.y}`));
    const burning = (x: number, y: number) => lit.has(`${x},${y}`);
    flames.forEach((f, i) => {
      let sprite = this.flameSprites[i];
      if (!sprite) {
        sprite = new Sprite();
        sprite.anchor.set(0.5);
        sprite.scale.set(FLAMES.scale);
        this.flameSprites.push(sprite);
        this.flameLayer.addChild(sprite);
      }
      const piece = flamePiece(burning, f.x, f.y);
      sprite.texture = art[piece.kind][flameFrame(f.ttl)]!;
      sprite.rotation = piece.rot;
      sprite.position.set((f.x + 0.5) * TILE_PX, (f.y + 0.5) * TILE_PX);
      sprite.visible = true;
    });
  }

  /** Sparks, debris and smoke over everything. */
  private drawParticles(g: Graphics): void {
    if (this.lite) return;
    for (const p of this.fx.particles) {
      const k = p.age / p.life;
      if (p.kind === "smoke") g.circle(p.x, p.y, p.size * (1 + k)).fill({ color: p.color, alpha: 0.35 * (1 - k) });
      else if (p.kind === "debris") g.rect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size).fill({ color: p.color, alpha: 1 - k * k });
      else g.circle(p.x, p.y, p.size * (1 - k * 0.6)).fill({ color: p.color, alpha: 1 - k });
    }
  }

  async useBombArt(): Promise<void> {
    const stages = await Promise.all(BOMBS.stages.flatMap((stage) => [stage, `${stage}-white`]).map(async (variant) => {
      const base: Texture = await Assets.load(`${import.meta.env.BASE_URL}sprites/bombs/${variant}.png`);
      base.source.scaleMode = "linear";
      return { variant, base };
    }));
    this.bombArt = new Map(stages.flatMap(({ variant, base }) => BOMBS.order.map((type) => [
      `${variant}:${type}`,
      new Texture({ source: base.source, frame: new Rectangle(bombFrame(type), 0, BOMBS.size, BOMBS.size) }),
    ] as const)));
  }

  /** Places the `n`th bomb sprite of this frame, centered on (cx, cy), with its spark on `glow`. */
  private placeBomb(n: number, b: Bomb, tick: number, cx: number, cy: number, z: number, glow: Graphics): void {
    let sprite = this.bombSprites[n];
    if (!sprite) {
      sprite = new Sprite();
      sprite.anchor.set(BOMBS.anchorX / BOMBS.size, BOMBS.anchorY / BOMBS.size);
      this.bombSprites.push(sprite);
      this.people.addChild(sprite);
    }
    const look = bombLook({ fuse: b.fuse, tick, type: b.type, mega: b.mega });
    sprite.texture = this.bombArt!.get(`${look.stage}${look.flash ? "-white" : ""}:${b.type}`)!;
    sprite.position.set(cx, cy);
    sprite.scale.set(BOMBS.scale * look.sx, BOMBS.scale * look.sy);
    sprite.tint = look.tint;
    sprite.zIndex = z;
    sprite.visible = true;
    if (!look.glow) return;
    const spark = BOMBS.glow[b.type];
    const gx = cx + (spark.x - BOMBS.anchorX) * BOMBS.scale * look.sx;
    const gy = cy + (spark.y - BOMBS.anchorY) * BOMBS.scale * look.sy;
    glow.circle(gx, gy, 2.4).fill({ color: spark.color, alpha: 0.35 });
    glow.circle(gx, gy, 1.1).fill({ color: 0xffffff, alpha: 0.9 });
  }

  private placeSprite(skin: Skin, id: string, player: number, f: FrameRect, cx: number, cy: number, tint: number): void {
    const { sheet } = skin;
    const sprite = this.sprite(id);
    const scale = sheet.scale ?? 1;
    sprite.texture = this.frame(skin, player % COLORS.players.length, f.x, f.y);
    sprite.anchor.set(sheet.anchorX / sheet.frameW, sheet.anchorY / sheet.frameH);
    sprite.position.set(cx, cy + 6);
    sprite.scale.set(f.flip ? -scale : scale, scale);
    sprite.rotation = 0;
    sprite.alpha = 1;
    sprite.tint = tint;
    sprite.zIndex = cy;
  }

  private placeMascot(
    id: string,
    player: number,
    cx: number,
    cy: number,
    look: { sx: number; sy: number; dy: number; rot?: number; flip?: boolean; alpha?: number; mood: Mood; view?: MascotView; step?: number },
    tint = 0xffffff,
  ): void {
    const sprite = this.sprite(id);
    const scale = MASCOT.scale / MASCOT_RES;
    const color = player % COLORS.players.length;
    sprite.texture =
      this.mascots!.get(mascotKey(color, look.mood, look.view ?? "front", look.step ?? 0)) ??
      this.mascots!.get(mascotKey(color, look.mood, "front", 0))!;
    sprite.anchor.set(MASCOT.anchorX / MASCOT.width, MASCOT.anchorY / MASCOT.height);
    sprite.position.set(cx, cy + 6 + look.dy);
    sprite.scale.set(scale * look.sx * (look.flip ? -1 : 1), scale * look.sy);
    sprite.rotation = look.rot ?? 0;
    sprite.alpha = look.alpha ?? 1;
    sprite.tint = tint;
    sprite.zIndex = cy;
  }

  /** The spiral of light round a captain with his shield up: half behind him, half in front. */
  private placeSpiral(id: string, ticks: number, cx: number, cy: number): void {
    if (!this.spiralArt) return;
    const f = spiralFrame(ticks);
    const scale = SHEETS.captain.scale;
    for (const [side, z] of [["behind", -0.5], ["front", 0.5]] as const) {
      const sprite = this.sprite(`spiral-${side}:${id}`);
      sprite.texture = this.spiralArt[side][f]!;
      sprite.anchor.set(SPIRAL.anchorX / SPIRAL.frameW, SPIRAL.anchorY / SPIRAL.frameH);
      sprite.position.set(cx, cy + 6);
      sprite.scale.set(scale);
      sprite.rotation = 0;
      sprite.alpha = 1;
      sprite.tint = 0xffffff;
      sprite.zIndex = cy + z;
    }
  }

  /** The player's sprite, shown this frame. */
  private sprite(id: string): Sprite {
    let sprite = this.sprites.get(id);
    if (!sprite) {
      sprite = new Sprite();
      this.sprites.set(id, sprite);
      this.people.addChild(sprite);
    }
    sprite.visible = true;
    return sprite;
  }

  /** Plays a just-killed player's death where they fell, once. */
  private drawDeath(id: string, player: number, tick: number, sheetColor = player): void {
    const seen = this.lastSeen.get(id);
    if (!seen) return;
    seen.deadAt ??= tick;
    const skin = this.skins.get(this.character(id));
    if (!skin && this.character(id) === "bomb") {
      const look = this.mascots && mascotDeath(tick - seen.deadAt);
      if (look) this.placeMascot(id, player, seen.cx, seen.cy, look);
      return;
    }
    const f = skin && deathFrame(skin.sheet, tick - seen.deadAt);
    if (f) this.placeSprite(skin, id, sheetColor, f, seen.cx, seen.cy, 0xffffff);
  }

  private frame(skin: Skin, player: number, x: number, y: number): Texture {
    const key = `${player}:${x}:${y}`;
    let tex = skin.frames.get(key);
    if (!tex) {
      tex = new Texture({ source: skin.sources.get(player).source, frame: new Rectangle(x, y, skin.sheet.frameW, skin.sheet.frameH) });
      skin.frames.set(key, tex);
    }
    return tex;
  }

  /**
   * Draws the match. `prev` holds player positions from the previous tick so
   * movement can be interpolated by `alpha` (0..1) between ticks.
   */
  /** Clears the stage until the next draw (leaving a match or the demo). */
  hide(): void {
    this.root.visible = false;
  }

  draw(s: PublicView, prev: Map<string, PlayerPos>, alpha: number): void {
    this.root.visible = true;
    const g = this.world.clear();
    const top = this.overlay.clear();
    for (const sprite of this.sprites.values()) sprite.visible = false;
    for (const sprite of this.truckSprites.values()) sprite.visible = false;
    for (const sprite of this.bombSprites) sprite.visible = false;
    let bombs = 0;
    const { width, height } = s.grid;

    // A blown-up block burns away as its own art, in place of the flame on its tile.
    const burning = new Map(this.tileArt ? s.flames.filter((f) => f.block).map((f) => [f.y * width + f.x, f.ttl]) : []);
    if (this.tileArt) this.drawTiles(s, burning);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const px = x * TILE_PX;
        const py = y * TILE_PX;
        const tile = getTile(s, x, y);
        if (this.tileArt) {
          if (tile !== Tile.Empty) continue;
          this.drawFloor(g, getFloor(s, x, y), px, py, s.tick);
          if (y > 0 && castsShadow(getTile(s, x, y - 1)) && !burning.has((y - 1) * width + x)) g.rect(px, py, TILE_PX, 3).fill({ color: 0x000000, alpha: 0.28 });
        } else if (tile === Tile.Wall) {
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

    if (this.itemArt) this.drawItems(s.items, s.tick, (x, y) => getTile(s, x, y) === Tile.Empty);
    else for (const item of s.items) {
      if (getTile(s, item.x, item.y) !== Tile.Empty) continue;
      const cx = item.x * TILE_PX + TILE_PX / 2;
      const cy = item.y * TILE_PX + TILE_PX / 2;
      g.roundRect(cx - 6, cy - 6, 12, 12, 2).fill(0xf2e6c9);
      g.circle(cx, cy, 4).fill(COLORS.items[item.kind]);
    }

    const flames = outsideBubbles(outsideBeams(s.flames, s.blasts), s.players).filter((f) => !burning.has(f.y * width + f.x));
    if (this.flameArt) this.drawFlames(flames);
    else {
      for (const f of flames) {
        g.rect(f.x * TILE_PX, f.y * TILE_PX, TILE_PX, TILE_PX).fill(COLORS.flame);
        g.rect(f.x * TILE_PX + 4, f.y * TILE_PX + 4, TILE_PX - 8, TILE_PX - 8).fill(COLORS.flameCore);
      }
    }
    const before = this.lastTiles;
    this.fx.observe(s.flames, (x, y) => before[y * width + x] === Tile.Block, s.tick);
    this.lastTiles = [...s.grid.tiles];

    for (const b of s.bombs) {
      if (b.heldBy) continue; // drawn over its holder's head below
      const pulse = Math.sin(((FUSE_TICKS - b.fuse) / 60) * Math.PI * 4) * 0.8;
      const moving = b.air?.dir ?? b.slide;
      const [dx, dy] = moving ? DIR_VECTORS[moving] : [0, 0];
      const t = b.air ? b.air.progress / AIR_TICKS_PER_TILE : b.offset / TILE;
      const lift = b.air ? airLift(b.air) : 0; // one high arc when punched or thrown, small hops when bouncing
      const cx = b.x * TILE_PX + TILE_PX / 2 + dx * t * TILE_PX;
      const cy = b.y * TILE_PX + TILE_PX / 2 + 1 + dy * t * TILE_PX - lift;
      if (this.bombArt) {
        this.placeBomb(bombs++, b, s.tick, cx, cy, cy + lift - TILE_PX / 2, top); // behind whoever stands on it
        continue;
      }
      g.circle(cx, cy, 6 + pulse).fill(COLORS.bomb);
      g.circle(cx + 3, cy - 6, 1.5).fill(COLORS.fuse);
    }

    const ring = perimeter(width, height);
    this.rasenUsed = 0;
    this.bubbleUsed = 0;
    s.players.forEach((p, seat) => {
      const i = this.colors.get(p.id) ?? seat;
      const color = COLORS.players[i % COLORS.players.length]!;
      if (!p.alive) {
        this.drawDeath(p.id, i, s.tick, skinColor(p, i));
        const t = p.cart && ring[p.cart.pos];
        if (!t) return;
        const cx = t.x * TILE_PX + TILE_PX / 2;
        const cy = t.y * TILE_PX + TILE_PX / 2;
        g.roundRect(cx - 7, cy - 1, 14, 7, 2).fill(COLORS.cart).stroke({ color: 0x000000, width: 1 });
        g.circle(cx, cy - 3, 4).fill(color).stroke({ color: 0x000000, width: 1 });
        return;
      }
      const { px: ux, py: uy } = between(prev.get(p.id) ?? p, p, alpha);
      const cx = (ux / TILE) * TILE_PX;
      const cy = (uy / TILE) * TILE_PX;
      this.lastSeen.set(p.id, { cx, cy, deadAt: null });
      // The pink panther tiptoeing: a puff as he slips away, then gone for his rivals (faint for himself and watchers).
      if (p.sneak > 0 && !this.sneaking.has(p.id) && !this.lite) this.fx.puff(cx, cy - 6, COLORS.sneakPuff);
      if (p.sneak > 0) this.sneaking.add(p.id);
      else this.sneaking.delete(p.id);
      const seen = sneakAlpha(p, this.viewer);
      if (seen === 0) return;
      if (p.invuln > 0 && Math.floor(s.tick / 4) % 2 === 0) return; // blink while invulnerable
      g.ellipse(cx, cy + 6, 5, 2).fill({ color: 0x000000, alpha: 0.3 * seen });
      if (p.mount) {
        g.ellipse(cx, cy + 3, 7, 4).fill(COLORS.mounts[p.mount]).stroke({ color: 0x000000, width: 1 });
      }
      const cursedFlash = p.curse && Math.floor(s.tick / 6) % 2 === 0;
      const held = s.bombs.find((b) => b.heldBy === p.id);
      const carrying = !!held;
      let headroom = 12;
      const moving = this.motion.moving(p.id, ux, uy);
      const ice = frozenLook(p.frozen, s.tick);
      const web = webbedLook(p.webbed, s.tick);
      const tint = ice ? ice.tint : cursedFlash ? COLORS.cursed : 0xffffff;
      const tick = ice || web ? 0 : s.tick; // frozen stiff, or wrapped up and struggling
      const sx = cx + (web?.shake ?? 0);
      const blast = s.blasts.find((b) => b.ownerId === p.id);
      const character = this.character(p.id);
      const skin = this.skins.get(character);
      if (skin) {
        const { sheet } = skin;
        const casting = castTicks(p, blast, s.bombs.find((b) => b.ownerId === p.id && b.mega));
        const shielding = bracing(p, moving);
        const f = playerFrame(sheet, { facing: p.facing, moving, carrying, stunned: p.stun > 0, casting, shielding, sneaking: p.sneak > 0, tick });
        this.placeSprite(skin, p.id, skinColor(p, i), f, sx, cy, tint);
        this.sprite(p.id).alpha = character === "optimus" && this.drawTruck(top, p, cx, cy, s.tick, seen) ? 0 : seen;
        headroom = sheet.bodyH * (sheet.scale ?? 1);
      } else if (character === "bomb" && this.mascots) {
        const look = mascotPose({ moving, stunned: p.stun > 0, facing: p.facing, tick });
        this.placeMascot(p.id, i, sx, cy, look, tint);
        headroom = MASCOT.bodyH * MASCOT.scale;
      } else {
        const body = cursedFlash ? COLORS.cursed : color;
        g.circle(cx, cy - 1, 6).fill(body).stroke({ color: 0x000000, width: 1 });
        g.rect(cx - 3, cy - 3, 2, 3).fill(0x000000);
        g.rect(cx + 1, cy - 3, 2, 3).fill(0x000000);
      }
      if (held && this.bombArt) this.placeBomb(bombs++, held, s.tick, cx, cy - headroom, cy + 0.5, top); // over its holder
      else if (carrying) {
        top.circle(cx, cy - headroom, 5).fill(COLORS.bomb);
        top.circle(cx + 3, cy - headroom - 5, 1.5).fill(COLORS.fuse);
      }
      if (ice?.block) {
        const b = iceBlock(cx, cy, headroom);
        top.roundRect(b.x, b.y, b.w, b.h, 3).fill({ color: COLORS.ice, alpha: 0.45 }).stroke({ color: 0xffffff, width: 1, alpha: 0.8 });
        top.moveTo(b.x + 3, b.y + 3).lineTo(b.x + 6, b.y + 6).stroke({ color: 0xffffff, width: 1, alpha: 0.9 });
      }
      if (web?.wraps) {
        const c = cocoon(sx, cy, headroom);
        top.roundRect(c.x, c.y, c.w, c.h, 5).fill({ color: COLORS.web, alpha: 0.3 }).stroke({ color: COLORS.webShade, width: 1, alpha: 0.9 });
        for (const [x0, y0, x1, y1] of c.back) top.moveTo(x0, y0).lineTo(x1, y1).stroke({ color: COLORS.webShade, width: 0.8, alpha: 0.8 });
        for (const [x0, y0, x1, y1] of c.strands) top.moveTo(x0, y0).lineTo(x1, y1).stroke({ color: COLORS.web, width: 1, alpha: 0.95 });
      }
      if (p.shield > 0) this.placeSpiral(p.id, SHIELD_TICKS - p.shield, cx, cy);
      // Thor's bolt, Pikachu's shock, Static's pull and the flash's dash leave their victims crackling while stunned.
      if (p.stun > 0 && s.blasts.some((b) => (b.kind === "lightning" || b.kind === "thunder" || b.kind === "magnet" || b.kind === "flash") && b.ownerId !== p.id) && !ice) {
        for (let k = 0; k < 3; k++) {
          const a = s.tick / 5 + (k * Math.PI * 2) / 3;
          top.circle(cx + Math.cos(a) * 6, cy - headroom + Math.sin(a) * 2, 1.2).fill(COLORS.bolt);
        }
      }
      // Penelope's kiss leaves its victim with hearts going round over their head.
      for (const h of charmHearts(p.charmed, s.tick)) drawHeart(top, cx + h.dx, cy - headroom + h.dy, h.size, 1);
      // A spark over a player whose special is ready.
      // Goku's ki gathering at his hip while the Kamehameha charges (the side view's sprite draws its own).
      if (p.charge > 0 && (p.facing === "up" || p.facing === "down")) {
        const r = 0.8 + 1.8 * (1 - p.charge / KAME_CHARGE) + Math.sin(s.tick / 2) * 0.3;
        const kx = cx + (p.facing === "down" ? -3 : 3);
        top.circle(kx, cy - 1, r + 1.5).fill({ color: COLORS.ki, alpha: 0.4 });
        top.circle(kx, cy - 1, r).fill({ color: 0xffffff, alpha: 0.9 });
      }
      // Naruto's Rasengan: spinning in his hand as he dashes, bursting where it strikes.
      const rasen = rasenganLook(p.rasengan, blast);
      if (rasen) {
        const dir = "burst" in rasen && blast ? blast.dir : p.facing;
        const [hx, hy] = boltOrigin(skin?.sheet, dir, cx, cy);
        const [dx, dy] = DIR_VECTORS[dir];
        const ahead = "burst" in rasen && blast?.length ? TILE_PX * 0.4 : 0;
        this.placeRasengan(top, rasen, hx + dx * ahead, hy + dy * ahead);
      }
      // The green lantern's bubble round him, his body showing through it.
      const bubble = bubbleLook(p.bubble, s.tick);
      if (bubble) this.placeBubble(top, bubble, cx, cy - 4);
      if (p.specialCooldown === 0 && !ice && !web) {
        const r = 1.2 + Math.sin(s.tick / 8) * 0.4;
        const spark = { thor: COLORS.bolt, goku: COLORS.ki, naruto: COLORS.ki, bomb: COLORS.fuse, spider: COLORS.web, pikachu: COLORS.bolt, static: COLORS.magnet, flash: COLORS.bolt, bugs: COLORS.dirt, lantern: COLORS.lantern }[character as string] ?? COLORS.ice;
        top.circle(cx + 6, cy - headroom, r + 1).fill({ color: spark, alpha: 0.5 });
        top.circle(cx + 6, cy - headroom, r).fill(0xffffff);
      }
    });

    this.kameUsed = 0;
    this.patronusUsed = 0;
    for (const b of s.blasts) this.drawBlast(top, b);
    for (let i = this.kameUsed; i < this.kameSprites.length; i++) this.kameSprites[i]!.visible = false;
    for (let i = this.rasenUsed; i < this.rasenSprites.length; i++) this.rasenSprites[i]!.visible = false;
    for (let i = this.patronusUsed; i < this.patronusSprites.length; i++) this.patronusSprites[i]!.visible = false;
    for (let i = this.bubbleUsed; i < this.bubbleSprites.length; i++) this.bubbleSprites[i]!.visible = false;
    this.drawParticles(top);
    const shake = this.fx.shake;
    this.root.position.set(Math.sin(s.tick * 2.3) * shake, Math.cos(s.tick * 3.1) * shake);

    this.banner.position.set((width * TILE_PX) / 2, (height * TILE_PX) / 2);
    this.clock.position.set((width * TILE_PX) / 2, 3);
    // sudden death: at the round's end, or sooner once only bots are left (pressureAt)
    const left = Math.max(0, Math.ceil(((s.pressureAt ?? ROUND_TICKS) - s.tick) / TICK_RATE));
    this.clock.text = left > 0 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : "SUDDEN DEATH!";
  }

  /** An ice beam from the caster to where it stopped, with shards along it and a burst at the end. */
  private drawBlast(g: Graphics, b: Blast): void {
    if (b.kind === "thunder") return this.drawThunder(g, b);
    if (b.length === 0 || b.kind === "rasengan") return; // the rasengan is drawn with its caster
    const [dx, dy] = DIR_VECTORS[b.dir];
    const center = (t: number) => t * TILE_PX + TILE_PX / 2;
    const x1 = center(b.x + dx * b.length);
    const y1 = center(b.y + dy * b.length);
    // The Kamehameha shows the moment it fires (its charge was the wind-up); ice and bolts wait for the thrust.
    if (b.kind === "kamehameha") {
      const at = this.lastSeen.get(b.ownerId);
      const [ox, oy] = boltOrigin(this.skins.get(this.character(b.ownerId))?.sheet, b.dir, at?.cx ?? center(b.x), at?.cy ?? center(b.y));
      return this.drawKamehameha(g, ox, oy, dx ? x1 : ox, dy ? y1 : oy, b.ttl);
    }
    if (b.kind === "spin") {
      const at = this.lastSeen.get(b.ownerId);
      return this.drawSpin(g, at?.cx ?? center(b.x), at?.cy ?? center(b.y), BLAST_TICKS - b.ttl);
    }
    // Harry's stag runs out from him from the first tick (whoever is in its way is stunned at once).
    if (b.kind === "patronus") {
      const at = this.lastSeen.get(b.ownerId);
      const ox = at?.cx ?? center(b.x);
      const oy = (at?.cy ?? center(b.y)) + 6;
      return this.drawPatronus(g, ox, oy, dx ? x1 : ox, dy ? y1 + 6 : oy, b.dir, b.length * PATRONUS_TICKS_PER_TILE, blastLife(b) - b.ttl);
    }
    // Penelope's kiss flies from the first tick (whoever it charms is stunned at once).
    if (b.kind === "kiss") {
      const at = this.lastSeen.get(b.ownerId);
      const [ox, oy] = boltOrigin(this.skins.get(this.character(b.ownerId))?.sheet, b.dir, at?.cx ?? center(b.x), at?.cy ?? center(b.y));
      for (const h of kissHearts(ox, oy, dx ? x1 : ox, dy ? y1 : oy, BLAST_TICKS - b.ttl)) drawHeart(g, h.x, h.y, h.size, h.alpha);
      return;
    }
    // The magnet's pull and the flash's dash land at once (the one caught, or he, is already there), so they show from the first tick.
    const alpha = beamAlpha(BLAST_TICKS - b.ttl + (b.kind === "magnet" || b.kind === "flash" || b.kind === "tunnel" ? BEAM_DELAY : 0));
    if (alpha <= 0) return;
    const x0 = center(b.x) + dx * 6;
    const y0 = center(b.y) + dy * 6;
    if (b.kind === "lightning") {
      // From the hammer of the caster as drawn, level with it all the way to where it stopped.
      const at = this.lastSeen.get(b.ownerId);
      const [ox, oy] = boltOrigin(this.skins.get(this.character(b.ownerId))?.sheet, b.dir, at?.cx ?? center(b.x), at?.cy ?? center(b.y));
      return this.drawBolt(g, ox, oy, dx ? x1 : ox, dy ? y1 : oy, b.ttl, alpha);
    }
    if (b.kind === "tunnel") return this.drawTunnel(g, center(b.x), center(b.y), x1, y1, BLAST_TICKS - b.ttl, alpha);
    if (b.kind === "flash") return this.drawSpeed(g, center(b.x), center(b.y), x1, y1, BLAST_TICKS - b.ttl, alpha);
    if (b.kind === "magnet") {
      const at = this.lastSeen.get(b.ownerId);
      const [ox, oy] = boltOrigin(this.skins.get(this.character(b.ownerId))?.sheet, b.dir, at?.cx ?? center(b.x), at?.cy ?? center(b.y));
      return this.drawMagnet(g, ox, oy, dx ? x1 : ox, dy ? y1 : oy, b.ttl, alpha);
    }
    if (b.kind === "web") {
      const at = this.lastSeen.get(b.ownerId);
      const [ox, oy] = boltOrigin(this.skins.get(this.character(b.ownerId))?.sheet, b.dir, at?.cx ?? center(b.x), at?.cy ?? center(b.y));
      return this.drawWeb(g, ox, oy, dx ? x1 : ox, dy ? y1 : oy, alpha);
    }
    g.moveTo(x0, y0).lineTo(x1, y1).stroke({ color: COLORS.ice, width: 6, alpha: alpha * 0.6, cap: "round" });
    g.moveTo(x0, y0).lineTo(x1, y1).stroke({ color: 0xffffff, width: 2, alpha, cap: "round" });
    for (let i = 1; i <= b.length; i++) {
      const sx = center(b.x + dx * i) + dy * (i % 2 ? 3 : -3);
      const sy = center(b.y + dy * i) + dx * (i % 2 ? 3 : -3);
      g.poly([sx, sy - 2.5, sx + 1.5, sy, sx, sy + 2.5, sx - 1.5, sy]).fill({ color: 0xffffff, alpha });
    }
    g.circle(x1, y1, 5).fill({ color: COLORS.ice, alpha: alpha * 0.5 });
  }

  /**
   * Goku's Kamehameha: a thick beam of light-blue ki with a white core, swelling in at once and thinning
   * out as it fades, a ball of ki at his hands and a bigger one where it stops.
   */
  private drawKamehameha(g: Graphics, x0: number, y0: number, x1: number, y1: number, ttl: number): void {
    const age = BLAST_TICKS - ttl;
    const w = Math.min(1, (age + 1) / 4) * Math.min(1, ttl / 12);
    if (this.kameArt) {
      // Swells in at once, thins out as it fades; the energy flows along it (a frame every 2 ticks).
      const frame = Math.floor(age / 2) % KAMEHAMEHA.frames;
      const order = { body: 0, head: 1, orb: 2 }; // the balls over the beam's ends
      for (const part of kameSegments(x0, y0, x1, y1, TILE_PX).sort((a, b) => order[a.kind] - order[b.kind])) {
        let sprite = this.kameSprites[this.kameUsed];
        if (!sprite) {
          sprite = new Sprite();
          sprite.anchor.set(0.5);
          this.kameSprites.push(sprite);
          this.beamLayer.addChild(sprite);
        }
        this.kameUsed++;
        const grow = part.kind === "body" ? 1 : 0.6 + 0.4 * w;
        sprite.texture = this.kameArt[part.kind][frame]!;
        sprite.position.set(part.x, part.y);
        sprite.rotation = part.rot;
        sprite.scale.set(KAMEHAMEHA.scale * grow, KAMEHAMEHA.scale * w);
        sprite.alpha = Math.min(1, ttl / 6);
        sprite.visible = true;
      }
      return;
    }
    const pulse = 1 + Math.sin(age / 1.5) * 0.08;
    for (const [width, color, a] of [[14, COLORS.ki, 0.35], [8, 0xbff4ff, 0.8], [3.5, 0xffffff, 1]] as const) {
      g.moveTo(x0, y0).lineTo(x1, y1).stroke({ color, width: width * w * pulse, alpha: a, cap: "round" });
    }
    g.circle(x1, y1, 9 * w * pulse).fill({ color: COLORS.ki, alpha: 0.45 });
    g.circle(x1, y1, 5 * w * pulse).fill({ color: 0xffffff, alpha: 0.95 });
    g.circle(x0, y0, 6 * w).fill({ color: COLORS.ki, alpha: 0.5 });
    g.circle(x0, y0, 3.5 * w).fill({ color: 0xffffff, alpha: 1 });
  }

  /** The spider's web: a taut strand from his hand to where it stopped, splatting into a little net there. */
  private drawWeb(g: Graphics, x0: number, y0: number, x1: number, y1: number, alpha: number): void {
    g.moveTo(x0, y0).lineTo(x1, y1).stroke({ color: COLORS.webShade, width: 2.5, alpha: alpha * 0.6, cap: "round" });
    g.moveTo(x0, y0).lineTo(x1, y1).stroke({ color: COLORS.web, width: 1.2, alpha, cap: "round" });
    const spokes = 8;
    for (let k = 0; k < spokes; k++) {
      const a = (k / spokes) * Math.PI * 2;
      g.moveTo(x1, y1).lineTo(x1 + Math.cos(a) * 6, y1 + Math.sin(a) * 6);
    }
    g.stroke({ color: COLORS.web, width: 0.8, alpha });
    for (const r of [2.5, 4.5]) {
      const ring = Array.from({ length: spokes }, (_, k) => [x1 + Math.cos((k / spokes) * Math.PI * 2) * r, y1 + Math.sin((k / spokes) * Math.PI * 2) * r]).flat();
      g.poly(ring).stroke({ color: COLORS.web, width: 0.6, alpha });
    }
  }

  /**
   * One arm of Pikachu's thunder shock: bolts crackling from his cheeks out to where the arm stopped; the
   * "up" arm (one per shock) also draws the burst of light around him.
   */
  private drawThunder(g: Graphics, b: Blast): void {
    const alpha = beamAlpha(BLAST_TICKS - b.ttl);
    if (alpha <= 0) return;
    const at = this.lastSeen.get(b.ownerId);
    const ox = at?.cx ?? b.x * TILE_PX + TILE_PX / 2;
    const oy = (at?.cy ?? b.y * TILE_PX + TILE_PX / 2) - 3;
    if (b.dir === "up") {
      const r = 9 + ((BLAST_TICKS - b.ttl) % 4);
      // A ring of light round him, thin enough to see him through it.
      g.circle(ox, oy, r + 3).stroke({ color: COLORS.bolt, width: 3, alpha: alpha * 0.45 });
      g.circle(ox, oy, r).fill({ color: COLORS.bolt, alpha: alpha * 0.12 });
    }
    if (b.length === 0) return;
    const [dx, dy] = DIR_VECTORS[b.dir];
    const reach = b.length * TILE_PX + TILE_PX * 0.3;
    this.drawBolt(g, ox + dx * 4, oy + dy * 4, ox + dx * reach, oy + dy * reach, b.ttl + "udlr".indexOf(b.dir[0]!) * 7, alpha);
  }

  /**
   * Static's magnet pull: two violet arcs crackling from his hand to where it caught, and rings of force
   * running back along them to him (`magnetWaves`).
   */
  private drawMagnet(g: Graphics, x0: number, y0: number, x1: number, y1: number, ttl: number, alpha: number): void {
    const seed = Math.floor(ttl / 2);
    for (const [k, width, color, a] of [[0, 5, COLORS.magnet, 0.4], [0, 1.5, 0xffffff, 1], [7, 1, COLORS.magnet, 0.9]] as const) {
      const pts = boltPoints(x0, y0, x1, y1, seed + k * 31);
      g.moveTo(pts[0]![0], pts[0]![1]);
      for (const [x, y] of pts.slice(1)) g.lineTo(x, y);
      g.stroke({ color, width, alpha: alpha * a, cap: "round", join: "round" });
    }
    for (const w of magnetWaves(x0, y0, x1, y1, BLAST_TICKS - ttl)) {
      g.circle(w.x, w.y, w.r).stroke({ color: COLORS.magnet, width: 1.5, alpha: alpha * 0.8 });
    }
    g.circle(x1, y1, 5).fill({ color: COLORS.magnet, alpha: alpha * 0.4 });
    g.circle(x0, y0, 2.5).fill({ color: 0xffffff, alpha });
  }

  /** Bugs' tunnel: a hole where he went under, a ridge of dirt mounds along the way, a hole where he popped out with clods flying. */
  private drawTunnel(g: Graphics, x0: number, y0: number, x1: number, y1: number, age: number, alpha: number): void {
    for (const [x, y] of [[x0, y0], [x1, y1]] as const) {
      g.ellipse(x, y + 5, 6, 3).fill({ color: COLORS.dirtShade, alpha });
      g.ellipse(x, y + 5, 4.5, 2).fill({ color: COLORS.hole, alpha });
    }
    for (const m of tunnelMounds(x0, y0, x1, y1, age)) {
      g.ellipse(m.x, m.y + 4, m.r + 1, m.r * 0.7 + 0.5).fill({ color: COLORS.dirtShade, alpha });
      g.ellipse(m.x, m.y + 3.5, m.r, m.r * 0.6).fill({ color: COLORS.dirt, alpha });
    }
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k - 2) * 0.55;
      const d = 3 + age * 0.9;
      g.circle(x1 + Math.cos(a) * d, y1 + 4 + Math.sin(a) * d + age * age * 0.03, 1.1).fill({ color: k % 2 ? COLORS.dirt : COLORS.dirtShade, alpha });
    }
  }

  /** Donatello's staff spin: his bo whirling round him with a blur trailing it, a whoosh ring swelling out. */
  private drawSpin(g: Graphics, x: number, y: number, age: number): void {
    const { angle, ring, alpha } = spinLook(age);
    if (alpha <= 0) return;
    const cy = y - 4; // round his waist, not his feet
    g.circle(x, cy, ring).stroke({ color: 0xffffff, width: 2, alpha: alpha * 0.55 });
    g.circle(x, cy, ring * 0.8).stroke({ color: COLORS.staffBlur, width: 1, alpha: alpha * 0.4 });
    for (let k = 3; k >= 0; k--) {
      const a = angle - k * 0.35;
      const dx = Math.cos(a) * 13;
      const dy = Math.sin(a) * 6.5; // the turn seen from above, squashed
      g.moveTo(x - dx, cy - dy).lineTo(x + dx, cy + dy).stroke({ color: k ? COLORS.staffBlur : COLORS.staff, width: k ? 2 : 2.5, alpha: alpha * (k ? 0.25 / k : 1), cap: "round" });
    }
  }

  /** The flash's dash: red and yellow speed lines from where he left to where he stopped, a bolt crackling along them. */
  private drawSpeed(g: Graphics, x0: number, y0: number, x1: number, y1: number, age: number, alpha: number): void {
    speedLines(x0, y0, x1, y1, age).forEach((l, k) => {
      g.moveTo(l.x0, l.y0).lineTo(l.x1, l.y1).stroke({ color: k % 2 ? COLORS.bolt : COLORS.speed, width: k === 2 ? 3 : 1.5, alpha, cap: "round" });
    });
    const pts = boltPoints(x0, y0, x1, y1, Math.floor(age / 2));
    g.moveTo(pts[0]![0], pts[0]![1]);
    for (const [x, y] of pts.slice(1)) g.lineTo(x, y);
    g.stroke({ color: 0xffffff, width: 1, alpha: alpha * 0.9, join: "round" });
    g.circle(x0, y0, 6 * alpha).fill({ color: COLORS.bolt, alpha: alpha * 0.35 }); // the puff he left behind
  }

  /** Thor's bolt: a yellow glow and a white core along a zigzag that re-forks every 3 ticks, flashing at the end. */
  private drawBolt(g: Graphics, x0: number, y0: number, x1: number, y1: number, ttl: number, alpha: number): void {
    const seed = Math.floor(ttl / 3);
    for (const [k, width, color, a] of [[0, 6, COLORS.bolt, 0.45], [0, 2, 0xffffff, 1], [1, 1, COLORS.bolt, 0.8]] as const) {
      const pts = boltPoints(x0, y0, x1, y1, seed + k * 101);
      g.moveTo(pts[0]![0], pts[0]![1]);
      for (const [x, y] of pts.slice(1)) g.lineTo(x, y);
      g.stroke({ color, width, alpha: alpha * a, cap: "round", join: "round" });
    }
    g.circle(x1, y1, 4 + (seed % 2)).fill({ color: COLORS.bolt, alpha: alpha * 0.5 });
    g.circle(x1, y1, 2).fill({ color: 0xffffff, alpha });
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

  /** The round clock over the arena (hidden for scripted scenes like the intro). */
  showClock(on: boolean): void {
    this.clock.visible = on;
  }
}

/** A heart `size` px wide centred on (x,y): two round lobes over a point, with a shine on the left lobe. */
function drawHeart(g: Graphics, x: number, y: number, size: number, alpha: number): void {
  if (alpha <= 0) return;
  const r = size / 4;
  g.circle(x - r, y - r * 0.6, r * 1.05).fill({ color: COLORS.heart, alpha });
  g.circle(x + r, y - r * 0.6, r * 1.05).fill({ color: COLORS.heart, alpha });
  g.poly([x - size / 2, y - r * 0.4, x + size / 2, y - r * 0.4, x, y + size / 2]).fill({ color: COLORS.heart, alpha });
  g.circle(x - r * 1.2, y - r, r * 0.35).fill({ color: COLORS.heartShine, alpha });
}
