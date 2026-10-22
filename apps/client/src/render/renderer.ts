import { Assets, Container, Graphics, Rectangle, Sprite, Text, Texture } from "pixi.js";
import { mascotSvg, PLAYER_COLORS, type MascotView, type Mood } from "../ui/art";
import { Fx } from "./fx";
import { BOMBS, FLAMES, RASENGAN, rasenganLook, between, ITEMS, MASCOT, TILES, castsShadow, itemCell, itemFrame, tileCell, MotionTracker, beamAlpha, boltOrigin, boltPoints, castTicks, KAMEHAMEHA, kameSegments, outsideBeams, type KamePiece, flameFrame, flamePiece, type FlamePiece, bombFrame, bombLook, deathFrame, frozenLook, iceBlock, mascotDeath, mascotPose, paintSheet, playerFrame, SHEETS, SPIRAL, spiralFrame, type FrameRect, type SheetLayout } from "./sprites";
import { AIR_TICKS_PER_TILE, BLAST_TICKS, DEFAULT_CHARACTER, DIR_VECTORS, FUSE_TICKS, KAME_CHARGE, ROUND_TICKS, TICK_RATE, ItemKind, TILE, Tile, Floor, getFloor, getTile, perimeter, SHIELD_TICKS, type Blast, type Bomb, type BombType, type CharacterId, type Facing, type PublicView } from "@bombtop/shared";

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
  ice: 0x7fd8ff,
  bolt: 0xffe45c,
  ki: 0x7fdcff,
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

/** A character sheet repainted once per player color. */
interface Skin {
  sheet: SheetLayout;
  sources: Texture[];
  frames: Map<string, Texture>;
}

/** Loads a sheet and repaints its clothes in each player color. */
async function loadSkin(sheet: SheetLayout): Promise<Skin> {
  const base: Texture = await Assets.load(`${import.meta.env.BASE_URL}${sheet.url}`);
  const img = base.source.resource as CanvasImageSource;
  const sources = COLORS.players.map((color) => {
    const canvas = document.createElement("canvas");
    canvas.width = sheet.width;
    canvas.height = sheet.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, sheet.width, sheet.height);
    const rgb = [(color >> 16) & 255, (color >> 8) & 255, color & 255] as const;
    paintSheet(data.data, sheet, rgb);
    ctx.putImageData(data, 0, 0);
    const tex = Texture.from(canvas);
    tex.source.scaleMode = sheet.url === SHEETS.bomber.url ? "nearest" : (sheet.scale ?? 1) < 1 ? "linear" : "nearest";
    return tex;
  });
  return { sheet, sources, frames: new Map() };
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
  private rasenUsed = 0;
  private readonly itemLayer = new Container();
  private readonly tileLayer = new Container();
  private tileArt: Texture[] | null = null;
  private tileScale = TILES.scale;
  private readonly tileSprites: Sprite[] = [];
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

  constructor() {
    this.banner.anchor.set(0.5);
    this.clock.anchor.set(0.5, 0);
    this.people.sortableChildren = true; // lower players overlap the ones above them
    this.root.addChild(this.tileLayer, this.world, this.itemLayer, this.flameLayer, this.people, this.beamLayer, this.overlay, this.banner, this.clock);
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
  }

  /** Players who wear another seat's color than their own (the guides dress each character in theirs). */
  setColors(colors: Map<string, number>): void {
    this.colors = colors;
  }

  private colors = new Map<string, number>();

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

  private drawTiles(s: PublicView): void {
    const art = this.tileArt!;
    const { width, height } = s.grid;
    for (const sprite of this.tileSprites) sprite.visible = false;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        let sprite = this.tileSprites[i];
        if (!sprite) {
          sprite = new Sprite();
          this.tileSprites[i] = sprite;
          this.tileLayer.addChild(sprite);
        }
        sprite.texture = art[tileCell(getTile(s, x, y), x, y, width, height)]!;
        sprite.scale.set(this.tileScale);
        sprite.position.set(x * TILE_PX, y * TILE_PX);
        sprite.visible = true;
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
  private drawDeath(id: string, player: number, tick: number): void {
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
    if (f) this.placeSprite(skin, id, player, f, seen.cx, seen.cy, 0xffffff);
  }

  private frame(skin: Skin, player: number, x: number, y: number): Texture {
    const key = `${player}:${x}:${y}`;
    let tex = skin.frames.get(key);
    if (!tex) {
      tex = new Texture({ source: skin.sources[player]!.source, frame: new Rectangle(x, y, skin.sheet.frameW, skin.sheet.frameH) });
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
    for (const sprite of this.bombSprites) sprite.visible = false;
    let bombs = 0;
    const { width, height } = s.grid;

    if (this.tileArt) this.drawTiles(s);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const px = x * TILE_PX;
        const py = y * TILE_PX;
        const tile = getTile(s, x, y);
        if (this.tileArt) {
          if (tile !== Tile.Empty) continue;
          this.drawFloor(g, getFloor(s, x, y), px, py, s.tick);
          if (y > 0 && castsShadow(getTile(s, x, y - 1))) g.rect(px, py, TILE_PX, 3).fill({ color: 0x000000, alpha: 0.28 });
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

    const flames = outsideBeams(s.flames, s.blasts);
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
      const lift = b.air ? Math.sin(t * Math.PI) * 6 + 4 : 0; // hop arc while airborne
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
    s.players.forEach((p, seat) => {
      const i = this.colors.get(p.id) ?? seat;
      const color = COLORS.players[i % COLORS.players.length]!;
      if (!p.alive) {
        this.drawDeath(p.id, i, s.tick);
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
      if (p.invuln > 0 && Math.floor(s.tick / 4) % 2 === 0) return; // blink while invulnerable
      g.ellipse(cx, cy + 6, 5, 2).fill({ color: 0x000000, alpha: 0.3 });
      if (p.mount) {
        g.ellipse(cx, cy + 3, 7, 4).fill(COLORS.mounts[p.mount]).stroke({ color: 0x000000, width: 1 });
      }
      const cursedFlash = p.curse && Math.floor(s.tick / 6) % 2 === 0;
      const held = s.bombs.find((b) => b.heldBy === p.id);
      const carrying = !!held;
      let headroom = 12;
      const moving = this.motion.moving(p.id, ux, uy);
      const ice = frozenLook(p.frozen, s.tick);
      const tint = ice ? ice.tint : cursedFlash ? COLORS.cursed : 0xffffff;
      const tick = ice ? 0 : s.tick; // frozen stiff
      const blast = s.blasts.find((b) => b.ownerId === p.id);
      const character = this.character(p.id);
      const skin = this.skins.get(character);
      if (skin) {
        const { sheet } = skin;
        const casting = castTicks(p, blast, s.bombs.find((b) => b.ownerId === p.id && b.mega));
        const shielding = p.shield > 0 ? SHIELD_TICKS - p.shield : undefined;
        const f = playerFrame(sheet, { facing: p.facing, moving, carrying, stunned: p.stun > 0, casting, shielding, tick });
        this.placeSprite(skin, p.id, i, f, cx, cy, tint);
        headroom = sheet.bodyH * (sheet.scale ?? 1);
      } else if (character === "bomb" && this.mascots) {
        const look = mascotPose({ moving, stunned: p.stun > 0, facing: p.facing, tick });
        this.placeMascot(p.id, i, cx, cy, look, tint);
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
      if (p.shield > 0) this.placeSpiral(p.id, SHIELD_TICKS - p.shield, cx, cy);
      // Thor's bolt leaves its victim crackling while stunned.
      if (p.stun > 0 && s.blasts.some((b) => b.kind === "lightning" && b.ownerId !== p.id) && !ice) {
        for (let k = 0; k < 3; k++) {
          const a = s.tick / 5 + (k * Math.PI * 2) / 3;
          top.circle(cx + Math.cos(a) * 6, cy - headroom + Math.sin(a) * 2, 1.2).fill(COLORS.bolt);
        }
      }
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
      if (p.specialCooldown === 0 && !ice) {
        const r = 1.2 + Math.sin(s.tick / 8) * 0.4;
        const spark = { thor: COLORS.bolt, goku: COLORS.ki, naruto: COLORS.ki, bomb: COLORS.fuse }[character as string] ?? COLORS.ice;
        top.circle(cx + 6, cy - headroom, r + 1).fill({ color: spark, alpha: 0.5 });
        top.circle(cx + 6, cy - headroom, r).fill(0xffffff);
      }
    });

    this.kameUsed = 0;
    for (const b of s.blasts) this.drawBlast(top, b);
    for (let i = this.kameUsed; i < this.kameSprites.length; i++) this.kameSprites[i]!.visible = false;
    for (let i = this.rasenUsed; i < this.rasenSprites.length; i++) this.rasenSprites[i]!.visible = false;
    this.drawParticles(top);
    const shake = this.fx.shake;
    this.root.position.set(Math.sin(s.tick * 2.3) * shake, Math.cos(s.tick * 3.1) * shake);

    this.banner.position.set((width * TILE_PX) / 2, (height * TILE_PX) / 2);
    this.clock.position.set((width * TILE_PX) / 2, 3);
    const left = Math.max(0, Math.ceil((ROUND_TICKS - s.tick) / TICK_RATE));
    this.clock.text = left > 0 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : "SUDDEN DEATH!";
  }

  /** An ice beam from the caster to where it stopped, with shards along it and a burst at the end. */
  private drawBlast(g: Graphics, b: Blast): void {
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
    const alpha = beamAlpha(BLAST_TICKS - b.ttl);
    if (alpha <= 0) return;
    const x0 = center(b.x) + dx * 6;
    const y0 = center(b.y) + dy * 6;
    if (b.kind === "lightning") {
      // From the hammer of the caster as drawn, level with it all the way to where it stopped.
      const at = this.lastSeen.get(b.ownerId);
      const [ox, oy] = boltOrigin(this.skins.get(this.character(b.ownerId))?.sheet, b.dir, at?.cx ?? center(b.x), at?.cy ?? center(b.y));
      return this.drawBolt(g, ox, oy, dx ? x1 : ox, dy ? y1 : oy, b.ttl, alpha);
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
