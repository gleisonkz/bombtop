import { Assets, Container, Graphics, Rectangle, Sprite, Text, Texture } from "pixi.js";
import { mascotSvg, PLAYER_COLORS, type MascotView, type Mood } from "../ui/art";
import { airLift } from "./air-arc";
import { Fx } from "./fx";
import { loadFlameArt, type FlameArt } from "./flame-art";
import { GroundEffects } from "./ground-effects";
import { ConveyorArt } from "./conveyor-art";
import { isolatedTextureRow, textureFromCanvas } from "./texture-cells";
import { scorePortraitCrop, scorePortraitScale, type ScorePortraitCrop } from "./score-portrait";
import { carriedBombPose } from "./carried-bomb";
import { avoidHeldBomb, buildHeadAnchors, headAnchor, type HeadAnchors } from "./head-anchor";
import { drawMegaSummon, MegaSummonEffects, type MegaSummonLook } from "./mega-summon";
import { WebEffects } from "./web-effects";
import { StunEffects } from "./stun-effects";
import { MENU_PATRONUS } from "./sprites";
import { EnergyPixelEffects } from "./energy-pixel-effects";
import { pixelStroke } from "./pixel-stroke";
import { staticPowerLook } from "./static-power";
import { loadPicanhaArt } from "./picanha-art";
import { battleClockText } from "./battle-clock";
import { picanhaOutline } from "./picanha-outline";
import { CompanionPixelEffects } from "./companion-pixel-effects";
import { AbilityPixelEffects } from "./ability-pixel-effects";
import { FLAME_TICKS, SNEAK_TICKS } from "@bombtop/shared";
import { scoreSlots } from "./score-bar";
import { paintTo, PerColor, skinColor } from "./per-color";
import { specialEffectColor, specialInk, specialTexture } from "./special-palette";
import { BOMBS, FLAMES, RASENGAN, rasenganLook, between, ITEMS, MASCOT, TILES, burnCell, castsShadow, itemCell, itemFrame, tileCell, MotionTracker, beamAlpha, BEAM_DELAY, boltOrigin, boltPoints, magnetWaves, speedLines, tunnelMounds, spinLook, kissHearts, charmHearts, sneakAlpha, patronusLook, PATRONUS, truckLook, TRUCK, ballLook, BALL, bubbleLook, BUBBLE, bracing, castTicks, KAMEHAMEHA, kameSegments, outsideBeams, outsideBubbles, type KamePiece, flameFrame, flamePiece, flameVariant, flameConnections, bombFrame, bombLook, deathFrame,  webbedLook, cocoon, mascotDeath, mascotPose, paintSheet, playerFrame, SHEETS, SPIRAL, spiralFrame, type FrameRect, type SheetLayout } from "./sprites";
import { AIR_TICKS_PER_TILE, BLAST_TICKS, blastLife, PATRONUS_TICKS_PER_TILE, DEFAULT_CHARACTER, DIR_VECTORS, FUSE_TICKS, KAME_CHARGE, TICK_RATE, ItemKind, TILE, Tile, Floor, getFloor, getTile, perimeter, SHIELD_TICKS, TRUCK_TICKS, type Blast, type Bomb, type BombType, type CharacterId, type Facing, type PublicView } from "@bombtop/shared";

/** Sprite size in art pixels; the stage is scaled up by an integer factor. */
export const TILE_PX = 16;

/** `headroom` reaches a little over the drawn head (room for a held bomb's fuse): a player's name sits this much lower. */
const TAG_DROP = 5;
/** Shared ground anchor for character feet and the extra-hit marker. */
const PLAYER_FEET_OFFSET = 6;

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
  /** The spark over a player whose special is ready, for characters without a color of their own. */
  spark: 0x7fd8ff,
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
    [ItemKind.BombPass]: 0x6bd7c4,
    [ItemKind.BlockPass]: 0x87b95e,
    [ItemKind.FireSuit]: 0xbfe9fc,
    [ItemKind.Heart]: 0xe84665,
    [ItemKind.Remote]: 0xe63946,
    [ItemKind.Pierce]: 0x48cae4,
    [ItemKind.Punch]: 0xf4a261,
    [ItemKind.Push]: 0xffb347,
    [ItemKind.Glove]: 0xffffff,
    [ItemKind.Skull]: 0x6a0dad,
    [ItemKind.FullFire]: 0xffd23f,
    [ItemKind.Egg]: 0xfff3e0,
    [ItemKind.Picanha]: 0xb03e2c,
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

interface SpecialPath {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color?: number | null;
}

/** A character sheet repainted in each player color it is drawn in. */
interface Skin {
  sheet: SheetLayout;
  heads: HeadAnchors;
  portrait: ScorePortraitCrop;
  sources: PerColor<Texture>;
  frames: Map<string, Texture>;
}

/** Loads a sheet; each player color is painted the first time a player in it is drawn. */
async function loadSkin(sheet: SheetLayout): Promise<Skin> {
  const base: Texture = await Assets.load(`${import.meta.env.BASE_URL}${sheet.url}`);
  const img = base.source.resource as CanvasImageSource;
  const alphaCanvas = document.createElement("canvas");
  alphaCanvas.width = sheet.width;
  alphaCanvas.height = sheet.height;
  const alphaContext = alphaCanvas.getContext("2d")!;
  alphaContext.drawImage(img, 0, 0);
  const pixels = alphaContext.getImageData(0, 0, sheet.width, sheet.height).data;
  const heads = buildHeadAnchors(pixels, sheet);
  const portrait = scorePortraitCrop({ sheet, pixels });
  alphaCanvas.width = alphaCanvas.height = 0;
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
    tex.source.scaleMode = (sheet.scale ?? 1) < 1 ? "linear" : "nearest";
    return tex;
  };
  const free = (tex: Texture): void => {
    const canvas = tex.source.resource as HTMLCanvasElement;
    tex.destroy(true);
    canvas.width = canvas.height = 0; // iOS keeps a canvas's pixels until it is shrunk
    frames.clear();
  };
  return { sheet, heads, portrait, sources: new PerColor(paint, free), frames };
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
  private readonly groundEffects = new GroundEffects();
  private readonly conveyors = new ConveyorArt();
  private readonly webCocoons = new WebEffects();
  private readonly stunEffects = new StunEffects();
  private readonly energyEffects = new EnergyPixelEffects();
  private readonly companionEffects = new CompanionPixelEffects();
  private readonly abilityEffects = new AbilityPixelEffects();
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
  private patronusLayout = PATRONUS;
  private readonly patronusSprites: Sprite[] = [];
  private patronusUsed = 0;
  /** Pelé's balls in flight. */
  private ballArt: Texture | null = null;
  private readonly ballSprites: Sprite[] = [];
  private ballUsed = 0;
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
  private flameArt: FlameArt | null = null;
  private readonly flameSprites: Sprite[] = [];
  private itemArt: Map<ItemKind, Texture[]> | null = null;
  private pixelPicanha = false;
  private readonly itemSprites: Sprite[] = [];
  private readonly fx = new Fx(TILE_PX);
  private readonly summonGround = new Graphics();
  private readonly summons = new MegaSummonEffects();
  private readonly reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
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

  /** The human players' names over their heads (setNames), one text each, over everything but the banner. */
  private readonly tagLayer = new Container();
  private readonly tags = new Map<string, Text>();
  private names = new Map<string, { text: string; me: boolean }>();

  /** Whose names to draw over their heads in the arena (name-tags.ts); empty in the menus' scenes. */
  setNames(names: Map<string, { text: string; me: boolean }>): void {
    this.names = names;
    for (const [id, tag] of this.tags) {
      if (names.has(id)) continue;
      tag.destroy();
      this.tags.delete(id);
    }
  }

  /** A player's name over their head (`top`: where their head ends), faded with them. */
  private placeTag(id: string, x: number, top: number, alpha: number): void {
    const name = this.names.get(id);
    if (!name) return;
    let tag = this.tags.get(id);
    if (!tag) {
      tag = new Text({
        text: "",
        resolution: this.lite ? 1.5 : 4,
        style: { fill: 0xffffff, fontFamily: "Lilita One, sans-serif", fontSize: 6, stroke: { color: 0x15152a, width: 1.5 } },
      });
      tag.anchor.set(0.5, 1);
      this.tags.set(id, tag);
      this.tagLayer.addChild(tag);
    }
    if (tag.text !== name.text) tag.text = name.text;
    tag.style.fill = name.me ? 0xffd23f : 0xffffff;
    tag.position.set(x, top - 1);
    tag.alpha = alpha;
    tag.visible = true;
  }

  /** The score bar on the top wall: each player's head and rounds won (setScore; none in the menus' scenes). */
  private readonly scoreLayer = new Container();
  private score: readonly { id: string; wins: number }[] | null = null;
  private readonly scoreHeads = new Map<string, Sprite>();
  private readonly scoreWins = new Map<string, Text>();
  private readonly scoreHp = new Map<string, Text>();
  /** Heads cut out of each character's first idle frame, by character and color. */
  private readonly heads = new WeakMap<Skin, Map<number, Texture>>();

  /** Rounds won so far, in seat order (null: no score bar). */
  setScore(rows: readonly { id: string; wins: number }[] | null): void {
    this.score = rows;
    for (const [id, head] of this.scoreHeads) {
      if (rows?.some((r) => r.id === id)) continue;
      head.destroy();
      this.scoreWins.get(id)!.destroy();
      this.scoreHp.get(id)?.destroy();
      this.scoreHeads.delete(id);
      this.scoreWins.delete(id);
      this.scoreHp.delete(id);
    }
  }

  /** Isolated portraits survive eviction of the much larger repainted character sheets. */
  private head(skin: Skin, color: number): Texture {
    let colors = this.heads.get(skin);
    if (!colors) { colors = new Map(); this.heads.set(skin, colors); }
    let tex = colors.get(color);
    if (!tex) {
      const crop = skin.portrait;
      const canvas = document.createElement("canvas");
      canvas.width = crop.width; canvas.height = crop.height;
      const ctx = canvas.getContext("2d")!;
      if (crop.outline) {
        ctx.beginPath();
        crop.outline.forEach(([x, y], index) => {
          if (index === 0) ctx.moveTo(x! - crop.x, y! - crop.y);
          else ctx.lineTo(x! - crop.x, y! - crop.y);
        });
        ctx.closePath(); ctx.clip();
      }
      ctx.drawImage(skin.sources.get(color).source.resource as CanvasImageSource, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
      tex = textureFromCanvas(canvas);
      colors.set(color, tex);
    }
    return tex;
  }

  private drawScore(s: PublicView): void {
    this.scoreLayer.visible = !!this.score;
    if (!this.score) return;
    const xs = scoreSlots(this.score.length, s.grid.width * TILE_PX);
    this.score.forEach(({ id, wins }, k) => {
      const i = s.players.findIndex((p) => p.id === id);
      const p = s.players[i];
      let head = this.scoreHeads.get(id);
      let text = this.scoreWins.get(id);
      let hp = this.scoreHp.get(id);
      if (!head || !text) {
        head = new Sprite();
        head.anchor.set(0.5, 1);
        text = new Text({
          text: "",
          resolution: this.lite ? 1.5 : 4,
          style: { fill: 0xffffff, fontFamily: "Lilita One, sans-serif", fontSize: 10, stroke: { color: 0x15152a, width: 2 } },
        });
        text.anchor.set(0, 0.5);
        hp = new Text({
          text: "",
          resolution: this.lite ? 1.5 : 4,
          style: { fill: 0xff7777, fontFamily: "Lilita One, sans-serif", fontSize: 8, stroke: { color: 0x15152a, width: 2 } },
        });
        hp.anchor.set(0, 0.5);
        this.scoreHeads.set(id, head);
        this.scoreWins.set(id, text);
        this.scoreHp.set(id, hp);
        this.scoreLayer.addChild(head, text, hp);
      }
      const character = this.character(id);
      const skin = this.skins.get(character);
      head.visible = !!skin && !!p;
      if (skin && p) {
        head.texture = this.head(skin, skinColor(p, i));
        head.scale.set(scorePortraitScale({ width: head.texture.width, height: head.texture.height, box: skin.portrait.box }));
      }
      const extraWidth = Math.max(0, head.texture.width * head.scale.x - 13);
      head.position.set(xs[k]! - 5 - extraWidth / 2, skin?.portrait.bottom ?? TILE_PX - 1.5);
      text.text = String(wins);
      text.position.set(xs[k]! + 3, TILE_PX / 2);
      if (hp) {
        hp.text = p?.hitPoints === undefined ? "" : `♥${p.hitPoints}`;
        hp.visible = p?.hitPoints !== undefined;
        hp.position.set(xs[k]! + 3, TILE_PX / 2 + 7);
        hp.alpha = p?.alive ? 1 : 0.4;
      }
      // out of this round: faded
      head.alpha = text.alpha = p?.alive ? 1 : 0.4;
    });
  }

  /** `lite`: weak screens (smart TVs): text drawn at less detail, no particles. */
  constructor(private readonly lite = false, private readonly options: { previewSpecialColors?: boolean } = {}) {
    if (lite) this.banner.resolution = this.clock.resolution = 1.5;
    this.banner.anchor.set(0.5);
    this.clock.anchor.set(0.5, 0);
    this.people.sortableChildren = true; // lower players overlap the ones above them
    this.root.addChild(this.tileLayer, this.conveyors.root, this.world, this.groundEffects.root, this.companionEffects.ground, this.summonGround, this.burnLayer, this.itemLayer, this.flameLayer, this.energyEffects.behind, this.people, this.beamLayer, this.overlay, this.energyEffects.root, this.companionEffects.root, this.abilityEffects.root, this.webCocoons.root, this.stunEffects.root, this.scoreLayer, this.tagLayer, this.banner, this.clock);
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

  private specialColor(id: string, state: PublicView): number | null {
    if (!this.options.previewSpecialColors) return null;
    const seat = state.players.findIndex((player) => player.id === id);
    return specialEffectColor(state.players[seat], this.colors.get(id) ?? seat, COLORS.players);
  }

  private itemOwnerColor(id: string | undefined, state: PublicView): number | null {
    if (id === undefined) return null;
    const seat = this.colors.get(id) ?? state.players.findIndex(player => player.id === id);
    return seat < 0 ? null : COLORS.players[seat] ?? COLORS.players[0]!;
  }

  /** Draws bombs with the bomb art instead of shapes. */
  async useSpiralArt(): Promise<void> {
    const base: Texture = await Assets.load(`${import.meta.env.BASE_URL}${SPIRAL.url}`);
    base.source.scaleMode = "nearest";
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

  async usePatronusArt(context: "game" | "menu" = "game"): Promise<void> {
    const layout = context === "menu" ? MENU_PATRONUS : PATRONUS;
    const base: Texture = await Assets.load(`${import.meta.env.BASE_URL}${layout.url}`);
    base.source.scaleMode = context === "menu" ? "linear" : "nearest";
    const { size, frames, rows } = layout;
    const row = (r: number) => Array.from({ length: frames }, (_, f) => new Texture({ source: base.source, frame: new Rectangle(f * size, r * size, size, size) }));
    this.patronusArt = { side: row(rows.side), down: row(rows.down), up: row(rows.up) };
    this.patronusLayout = layout;
  }

  async useBallArt(): Promise<void> {
    const tex: Texture = await Assets.load(`${import.meta.env.BASE_URL}${BALL.url}`);
    tex.source.scaleMode = "nearest";
    this.ballArt = tex;
  }

  /** Pelé's ball flying from his feet to where it stopped (its shadow on the ground under it), then rebounding. */
  private drawBall(g: Graphics, b: Blast, color: number | null = null): void {
    const [dx, dy] = DIR_VECTORS[b.dir];
    const center = (t: number) => t * TILE_PX + TILE_PX / 2;
    const at = this.lastSeen.get(b.ownerId);
    const ox = (at?.cx ?? center(b.x)) + dx * 5;
    const oy = (at?.cy ?? center(b.y)) + 4 + dy * 4;
    const x1 = center(b.x + dx * b.length) - dx * 4;
    const y1 = center(b.y + dy * b.length) + 4 - dy * 4;
    const look = ballLook(ox, oy, dx ? x1 : ox, dy ? y1 : oy, b.length, BLAST_TICKS - b.ttl);
    if (!look) return;
    const age = BLAST_TICKS - b.ttl;
    if (age < 12) this.abilityEffects.draw("kick", { x: ox, y: oy, tick: age, size: 18, alpha: look.alpha, color });
    g.ellipse(look.x, look.y + 2, 3, 1.2).fill({ color: 0x000000, alpha: 0.3 * look.alpha });
    if (!this.ballArt) {
      g.circle(look.x, look.y - look.lift, 3).fill({ color: 0xffffff, alpha: look.alpha }).stroke({ color: 0x000000, width: 0.8 });
      return;
    }
    let sprite = this.ballSprites[this.ballUsed];
    if (!sprite) {
      sprite = new Sprite(this.ballArt);
      sprite.anchor.set(0.5);
      this.ballSprites.push(sprite);
      this.beamLayer.addChild(sprite);
    }
    this.ballUsed++;
    sprite.texture = this.ballArt;
    sprite.scale.set(BALL.scale);
    sprite.rotation = look.spin;
    sprite.alpha = look.alpha;
    sprite.position.set(look.x, look.y - look.lift);
    sprite.visible = true;
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
  private drawTruck(g: Graphics, p: Pick<PublicView["players"][number], "id" | "truck" | "facing">, cx: number, cy: number, tick: number, alpha: number, color: number | null = null): boolean {
    if (p.truck > 0) {
      const [dx, dy] = DIR_VECTORS[p.facing];
      this.abilityEffects.draw("exhaust", { x: cx - dx * 6, y: cy - 14 - dy * 4, tick, size: 14, alpha, rotation: Math.atan2(-dy, -dx), color });
    }
    if (p.truck > TRUCK_TICKS) {
      const t = 1 - (p.truck - TRUCK_TICKS) / 12;
      g.circle(cx, cy - 6, 6 + t * 6).fill({ color: specialInk(COLORS.energon, color), alpha: 0.12 + 0.2 * t });
      g.circle(cx, cy - 6, 3 + t * 3).fill({ color: 0xffffff, alpha: 0.15 * t });
      if (!this.shifting.has(p.id) && !this.lite) this.fx.transform(cx, cy - 8, color);
      this.shifting.add(p.id);
    } else this.shifting.delete(p.id);
    const look = truckLook(p, tick);
    if (!look) {
      if (this.driving.has(p.id) && !this.lite) this.fx.transform(cx, cy - 6, color);
      this.driving.delete(p.id);
      return false;
    }
    if (!this.driving.has(p.id) && !this.lite) this.fx.transform(cx, cy - 6, color);
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
      g.roundRect(cx - 10, cy - 12, 20, 14, 3).fill({ color: specialInk(COLORS.truck, color), alpha }).stroke({ color: 0x000000, width: 1 });
      return true;
    }
    let sprite = this.truckSprites.get(p.id);
    if (!sprite) {
      sprite = new Sprite();
      sprite.anchor.set(TRUCK.anchorX / TRUCK.w, TRUCK.anchorY / TRUCK.h);
      this.truckSprites.set(p.id, sprite);
      this.people.addChild(sprite);
    }
    sprite.texture = specialTexture(this.truckArt[look.view][look.frame]!, color);
    sprite.scale.set(look.flip ? -TRUCK.scale : TRUCK.scale, TRUCK.scale);
    sprite.position.set(cx, cy + PLAYER_FEET_OFFSET);
    sprite.zIndex = cy;
    sprite.alpha = alpha;
    sprite.visible = true;
    return true;
  }

  /** Harry's stag galloping along his patronus (its feet on the path), glowing, with sparkles trailing it. */
  private drawPatronus(g: Graphics, pose: SpecialPath & { dir: Facing; run: number; age: number }): void {
    const { x0, y0, x1, y1, dir, run, age, color } = pose;
    const look = patronusLook(x0, y0, x1, y1, dir, run, age);
    if (!look) return;
    for (const spark of look.sparkles) g.rect(Math.round(spark.x), Math.round(spark.y - 4), 0.5, 0.5).fill({ color: specialInk(COLORS.patronus, color), alpha: spark.alpha });
    if (!this.patronusArt) {
      g.ellipse(look.x, look.y - 7, 8, 5).fill({ color: 0xffffff, alpha: look.alpha });
      return;
    }
    let sprite = this.patronusSprites[this.patronusUsed];
    if (!sprite) {
      sprite = new Sprite();
      sprite.blendMode = "normal";
      this.patronusSprites.push(sprite);
      this.beamLayer.addChild(sprite);
    }
    this.patronusUsed++;
    const layout = this.patronusLayout;
    sprite.texture = specialTexture(this.patronusArt[look.view][look.frame]!, color);
    sprite.anchor.set(layout.anchorX / layout.size, layout.anchorY / layout.size);
    sprite.scale.set(look.flip ? -layout.scale : layout.scale, layout.scale);
    sprite.alpha = look.alpha;
    sprite.position.set(look.x, look.y);
    sprite.visible = true;
  }

  /** The green lantern's bubble round (x,y), from the art once loaded (else a plain green ring). */
  private placeBubble(g: Graphics, look: { row: number; frame: number; alpha: number }, x: number, y: number, color: number | null = null): void {
    const phase = look.frame * BUBBLE.ticks;
    const opening = look.row === BUBBLE.rows.form ? 0.65 + look.frame / BUBBLE.frames.form * 0.35 : 1;
    const closing = look.row === BUBBLE.rows.pop ? 1 - look.frame / BUBBLE.frames.pop : 1;
    if (this.abilityEffects.draw("lantern", { x, y, tick: phase, size: 37 * opening, alpha: look.alpha * closing, color })) return;
    if (!this.bubbleArt) {
      g.circle(x, y, 13).fill({ color: specialInk(COLORS.lantern, color), alpha: 0.15 * look.alpha }).stroke({ color: specialInk(COLORS.lantern, color), width: 1.5, alpha: look.alpha });
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
    sprite.texture = specialTexture(this.bubbleArt[look.row]![look.frame]!, color);
    sprite.scale.set(BUBBLE.scale);
    sprite.alpha = look.alpha;
    sprite.position.set(x, y);
    sprite.visible = true;
  }

  /** The Rasengan's ball or burst at (x,y), from the art once loaded (else a plain glowing ball). */
  private placeRasengan(g: Graphics, look: { orb: number } | { burst: number }, x: number, y: number, color: number | null = null): void {
    const burst = "burst" in look;
    const frame = burst ? look.burst : look.orb;
    if (this.abilityEffects.draw("chakra", { x, y, tick: frame * 5, size: burst ? 18 + frame * 2 : 13, alpha: burst ? Math.max(0, 1 - frame / RASENGAN.frames) : 1, color })) return;
    if (!this.rasenArt) {
      const r = "orb" in look ? 3 : 3 + look.burst * 1.5;
      g.circle(x, y, r + 1.5).fill({ color: specialInk(COLORS.ki, color), alpha: 0.45 });
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
    sprite.texture = specialTexture("orb" in look ? this.rasenArt.orb[look.orb]! : this.rasenArt.burst[look.burst]!, color);
    sprite.scale.set("orb" in look ? RASENGAN.orbScale : RASENGAN.burstScale);
    sprite.position.set(x, y);
    sprite.visible = true;
  }

  async useFlameArt(): Promise<void> {
    if (this.flameArt) return;
    this.flameArt = await loadFlameArt();
  }

  /** Draws the arena (grass, blocks, walls) with the tile art instead of flat colors. */
  async useTileArt(layout: typeof TILES = TILES): Promise<void> {
    const [base]: [Texture, void, void, void, void, void, void, void] = await Promise.all([
      Assets.load(`${import.meta.env.BASE_URL}${layout.url}`),
      this.conveyors.load(),
      this.groundEffects.load(),
      this.webCocoons.load().catch((e) => console.error("web cocoon art", e)),
      this.stunEffects.load().catch((e) => console.error("stun art", e)),
      this.energyEffects.load().catch((e) => console.error("pixel energy art", e)),
      this.companionEffects.load(),
      this.abilityEffects.load().catch((e) => console.error("pixel ability art", e)),
    ]);
    base.source.scaleMode = "linear"; // drawn smaller than the art
    const count = base.width / layout.size;
    this.tileScale = layout.scale;
    this.tileArt = isolatedTextureRow(base.source.resource as CanvasImageSource, 0, layout.size, count);
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
        const ignition = ttl !== undefined && burnCell(ttl) === TILES.cells.burn[0];
        let tile = getTile(s, x, y);
        if (ttl !== undefined) tile = ignition ? Tile.Block : Tile.Empty;
        sprite.texture = art[tileCell(tile, x, y, width, height)]!;
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
        // Bring the first heat/cracks in over the intact bitmap instead of swapping blocks on impact.
        burn.alpha = ignition ? Math.max(0, Math.min(1, (FLAME_TICKS - ttl) / (FLAME_TICKS / TILES.cells.burn.length))) : 1;
        burn.visible = true;
      }
    }
  }

  /** Draws power-ups as plates with icons (and a glint now and then) instead of dots. */
  async useItemArt(): Promise<void> {
    const [base, picanha] = await Promise.all([
      Assets.load<Texture>(`${import.meta.env.BASE_URL}${ITEMS.url}`),
      loadPicanhaArt().catch(() => null),
    ]);
    base.source.scaleMode = "linear"; // drawn at under a third of its size
    this.itemArt = new Map(
      ITEMS.order.map((kind) => [
        kind,
        Array.from({ length: ITEMS.frames }, (_, f) => new Texture({ source: base.source, frame: new Rectangle(itemCell(kind), f * ITEMS.size, ITEMS.size, ITEMS.size) })),
      ]),
    );
    this.pixelPicanha = picanha !== null;
    if (picanha) this.itemArt.set(ItemKind.Picanha, picanha);
  }

  private drawItems(items: PublicView["items"], tick: number, visible: (x: number, y: number) => boolean, ownerColor: (id: string | undefined) => number | null): void {
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
      const picanha = item.kind === ItemKind.Picanha && this.pixelPicanha;
      const frame = picanha ? Math.floor(tick / 10) % 4 : itemFrame(tick, item.x, item.y);
      const texture = art.get(item.kind)![frame]!;
      sprite.texture = item.kind === ItemKind.Picanha ? picanhaOutline(texture, ownerColor(item.owner)) : texture;
      sprite.scale.set(picanha ? 14 / 64 : ITEMS.scale);
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
      sprite.scale.set(piece.kind === "center" ? FLAMES.centerScale : FLAMES.scale);
      let frames = art.end;
      if (piece.kind === "mid") frames = art.mid[flameVariant(f.x, f.y)]!;
      if (piece.kind === "center") frames = art.center[flameConnections(burning, f.x, f.y)]!;
      sprite.texture = frames[flameFrame(f.ttl)]!;
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
    const variants = BOMBS.stages.flatMap((stage) => [stage, `${stage}-white`]);
    const load = async (url: string): Promise<Texture> => {
      const base: Texture = await Assets.load(`${import.meta.env.BASE_URL}${url}`);
      base.source.scaleMode = "linear";
      return base;
    };
    const [stages, megaStages] = await Promise.all([
      Promise.all(variants.map(async (variant) => ({ variant, base: await load(`sprites/bombs/${variant}.png`) }))),
      Promise.all(variants.map(async (variant) => ({ variant, base: await load(BOMBS.mega.url.replaceAll("armed.png", `${variant}.png`)) }))),
    ]);
    this.bombArt = new Map(stages.flatMap(({ variant, base }) => BOMBS.order.map((type) => [
      `${variant}:${type}`,
      new Texture({ source: base.source, frame: new Rectangle(bombFrame(type), 0, BOMBS.size, BOMBS.size) }),
    ] as const)));
    for (const { variant, base } of megaStages) this.bombArt.set(`mega:${variant}`, base);
  }

  /** Places the `n`th bomb sprite of this frame, centered on (cx, cy), with its spark on `glow`. */
  private placeBomb(n: number, b: Bomb, tick: number, cx: number, cy: number, z: number, { glow, summon, carryScale = 1, color = null }: { glow: Graphics; summon?: MegaSummonLook | null; carryScale?: number; color?: number | null }): void {
    let sprite = this.bombSprites[n];
    if (!sprite) {
      sprite = new Sprite();
      this.bombSprites.push(sprite);
      this.people.addChild(sprite);
    }
    const look = bombLook({ fuse: b.fuse, tick, type: b.type, mega: b.mega, carrying: !!b.heldBy });
    const art = b.mega ? BOMBS.mega : BOMBS;
    const scale = art.scale * (summon?.scale ?? 1) * carryScale;
    const bombY = cy + (summon?.rise ?? 0);
    const flash = look.flash && (!b.mega || !this.reducedMotion?.matches);
    const variant = `${look.stage}${flash ? "-white" : ""}`;
    const key = b.mega ? `mega:${variant}` : `${variant}:${b.type}`;
    sprite.texture = specialTexture(this.bombArt!.get(key)!, b.mega && !flash ? color : null);
    sprite.anchor.set(art.anchorX / art.size, art.anchorY / art.size);
    sprite.position.set(cx, bombY);
    sprite.scale.set(scale * look.sx, scale * look.sy);
    sprite.tint = look.tint;
    sprite.alpha = summon?.alpha ?? 1;
    sprite.zIndex = z;
    sprite.visible = true;
    if (!look.glow) return;
    const spark = b.mega ? BOMBS.mega.glow : BOMBS.glow[b.type];
    const gx = cx + (spark.x - art.anchorX) * scale * look.sx;
    const gy = bombY + (spark.y - art.anchorY) * scale * look.sy;
    glow.circle(gx, gy, 2.4).fill({ color: b.mega ? specialInk(spark.color, color) : spark.color, alpha: 0.35 });
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
    sprite.position.set(cx, cy + PLAYER_FEET_OFFSET + look.dy);
    sprite.scale.set(scale * look.sx * (look.flip ? -1 : 1), scale * look.sy);
    sprite.rotation = look.rot ?? 0;
    sprite.alpha = look.alpha ?? 1;
    sprite.tint = tint;
    sprite.zIndex = cy;
  }

  /** The spiral of light round a captain with his shield up: half behind him, half in front. */
  private placeSpiral(id: string, ticks: number, cx: number, cy: number, color: number | null = null): void {
    if (!this.spiralArt) return;
    const f = spiralFrame(ticks);
    const scale = SPIRAL.scale;
    for (const [side, z] of [["behind", -0.5], ["front", 0.5]] as const) {
      const sprite = this.sprite(`spiral-${side}:${id}`);
      sprite.texture = specialTexture(this.spiralArt[side][f]!, color);
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
    this.summons.reset();
  }

  draw(s: PublicView, prev: Map<string, PlayerPos>, alpha: number): void {
    this.conveyors.beginFrame();
    this.groundEffects.beginFrame();
    this.webCocoons.beginFrame();
    this.stunEffects.beginFrame();
    this.energyEffects.beginFrame();
    this.companionEffects.beginFrame();
    this.abilityEffects.beginFrame();
    this.root.visible = true;
    const g = this.world.clear();
    const top = this.overlay.clear();
    this.summonGround.clear();
    this.summons.observe(s, !this.lite && !this.reducedMotion?.matches);
    let summonShake = 0;
    for (const sprite of this.sprites.values()) sprite.visible = false;
    for (const sprite of this.truckSprites.values()) sprite.visible = false;
    for (const tag of this.tags.values()) tag.visible = false;
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

    if (this.itemArt) this.drawItems(s.items, s.tick, (x, y) => getTile(s, x, y) === Tile.Empty, (id) => this.itemOwnerColor(id, s));
    else for (const item of s.items) {
      if (getTile(s, item.x, item.y) !== Tile.Empty) continue;
      const cx = item.x * TILE_PX + TILE_PX / 2;
      const cy = item.y * TILE_PX + TILE_PX / 2;
      g.roundRect(cx - 6, cy - 6, 12, 12, 2).fill(0xf2e6c9);
      g.circle(cx, cy, 4).fill(COLORS.items[item.kind]);
      if (item.kind === ItemKind.Picanha) {
        const color = this.itemOwnerColor(item.owner, s);
        if (color !== null) g.circle(cx, cy, 5).stroke({ color, width: 1.5 });
      }
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
      const summon = this.summons.get(b);
      const color = b.mega ? this.specialColor(b.ownerId, s) : null;
      if (summon) {
        drawMegaSummon({ ground: this.summonGround, overlay: top, cx, cy, look: summon, color });
        summonShake = Math.max(summonShake, summon.shake);
      }
      if (this.bombArt) {
        this.placeBomb(bombs++, b, s.tick, cx, cy, cy + lift - TILE_PX / 2, { glow: top, summon, color }); // behind whoever stands on it
        continue;
      }
      g.circle(cx, cy, 6 + pulse).fill(b.mega && color !== null ? specialInk(0x985bdb, color) : COLORS.bomb);
      g.circle(cx + 3, cy - 6, 1.5).fill(b.mega ? specialInk(COLORS.fuse, color) : COLORS.fuse);
    }

    const ring = perimeter(width, height);
    this.rasenUsed = 0;
    this.bubbleUsed = 0;
    s.players.forEach((p, seat) => {
      const i = this.colors.get(p.id) ?? seat;
      const effectColor = this.specialColor(p.id, s);
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
      const sneakAge = SNEAK_TICKS - p.sneak;
      const pixelPuff = p.sneak > 0 && sneakAge < 24 && !this.lite && this.companionEffects.draw("smoke", { x: cx, y: cy - 6, tick: sneakAge, alpha: 1 - sneakAge / 24, color: effectColor });
      if (p.sneak > 0 && !this.sneaking.has(p.id) && !this.lite && !pixelPuff) this.fx.puff(cx, cy - 6, specialInk(COLORS.sneakPuff, effectColor));
      if (p.sneak > 0) this.sneaking.add(p.id);
      else this.sneaking.delete(p.id);
      const seen = sneakAlpha(p, this.viewer);
      if (seen === 0) return;
      if (p.invuln > 0 && Math.floor(s.tick / 4) % 2 === 0) return; // blink while invulnerable
      g.ellipse(cx, cy + 6, 5, 2).fill({ color: 0x000000, alpha: 0.3 * seen });
      if (p.mount && !this.groundEffects.draw("protection", cx, cy + PLAYER_FEET_OFFSET, s.tick)) {
        g.ellipse(cx, cy + PLAYER_FEET_OFFSET, 7, 4).fill(COLORS.mounts[p.mount]).stroke({ color: 0x000000, width: 1 });
      }
      const cursedFlash = p.curse && Math.floor(s.tick / 6) % 2 === 0;
      const held = s.bombs.find((b) => b.heldBy === p.id);
      const carrying = !!held;
      let headroom = 12;
      let stunHead = { x: cx, headY: cy - 7 };
      const moving = this.motion.moving(p.id, ux, uy) && p.stun === 0;
      const web = webbedLook(p.webbed, s.tick);
      const tint = cursedFlash ? COLORS.cursed : 0xffffff;
      const tick = web ? 0 : s.tick; // wrapped up and struggling
      const sx = cx + (web?.shake ?? 0);
      const blast = s.blasts.find((b) => b.ownerId === p.id);
      const character = this.character(p.id);
      const skin = this.skins.get(character);
      let carried = { x: sx, y: cy - headroom, scale: 1, front: false };
      if (skin) {
        const { sheet } = skin;
        const casting = p.stun > 0 ? undefined : castTicks(p, blast, s.bombs.find((b) => b.ownerId === p.id && b.mega));
        const shielding = bracing(p, moving);
        const f = playerFrame(sheet, { facing: p.facing, moving, carrying, stunned: p.stun > 0, casting, shielding, sneaking: p.sneak > 0, tick });
        this.placeSprite(skin, p.id, skinColor(p, i), f, sx, cy, tint);
        this.sprite(p.id).alpha = character === "optimus" && this.drawTruck(top, p, cx, cy, s.tick, seen, effectColor) ? 0 : seen;
        headroom = sheet.bodyH * (sheet.scale ?? 1);
        const view = p.facing === "left" || p.facing === "right" ? "side" : p.facing;
        stunHead = headAnchor({ sheet, anchors: skin.heads, frame: f, x: sx, feetY: cy + PLAYER_FEET_OFFSET,
          headRow: carrying ? sheet.idle[view].row : undefined });
        if (held) carried = carriedBombPose({ sheet, frame: f, cx: sx, feetY: cy + PLAYER_FEET_OFFSET, bomb: held, tick: s.tick });
      } else if (character === "bomb" && this.mascots) {
        const look = mascotPose({ moving, stunned: p.stun > 0, facing: p.facing, tick });
        this.placeMascot(p.id, i, sx, cy, look, tint);
        headroom = MASCOT.bodyH * MASCOT.scale;
        stunHead = { x: sx, headY: cy + PLAYER_FEET_OFFSET - headroom };
        carried.y = cy - headroom;
      } else {
        const body = cursedFlash ? COLORS.cursed : color;
        g.circle(cx, cy - 1, 6).fill(body).stroke({ color: 0x000000, width: 1 });
        g.rect(cx - 3, cy - 3, 2, 3).fill(0x000000);
        g.rect(cx + 1, cy - 3, 2, 3).fill(0x000000);
      }
      // Palms and face stay in front of the carried body; the socket follows the actual pose.
      if (held && this.bombArt) this.placeBomb(bombs++, held, s.tick, carried.x, carried.y, cy + (carried.front ? 0.5 : -0.5), { glow: top, carryScale: carried.scale, color: this.specialColor(held.ownerId, s) });
      else if (held) {
        const heldColor = held.mega ? this.specialColor(held.ownerId, s) : null;
        const look = bombLook({ fuse: held.fuse, tick: s.tick, type: held.type, mega: held.mega, carrying: true });
        const radius = held.mega ? 175 * BOMBS.mega.scale : 42 * BOMBS.scale;
        top.ellipse(carried.x, carried.y, radius * carried.scale * look.sx, radius * carried.scale * look.sy).fill(heldColor === null ? COLORS.bomb : specialInk(0x985bdb, heldColor));
        top.circle(carried.x + 3, carried.y - 5 * carried.scale, 1.5).fill(held.mega ? specialInk(COLORS.fuse, heldColor) : COLORS.fuse);
      }
      const silk = web && this.webCocoons.draw({ x: sx, feet: cy + 6, bodyH: headroom, remaining: p.webbed, tick: s.tick });
      if (web?.wraps && !silk) {
        const c = cocoon(sx, cy, headroom);
        top.roundRect(c.x, c.y, c.w, c.h, 5).fill({ color: COLORS.web, alpha: 0.3 }).stroke({ color: COLORS.webShade, width: 1, alpha: 0.9 });
        for (const [x0, y0, x1, y1] of c.back) top.moveTo(x0, y0).lineTo(x1, y1).stroke({ color: COLORS.webShade, width: 0.8, alpha: 0.8 });
        for (const [x0, y0, x1, y1] of c.strands) top.moveTo(x0, y0).lineTo(x1, y1).stroke({ color: COLORS.web, width: 1, alpha: 0.95 });
      }
      // the sprite stands 6 px below the tile's center (placeSprite); kept on the stage over the top row
      const over = p.stun > 0 ? stunHead.headY - 19 : cy + 6 - headroom - (carrying ? 9 : 0) + TAG_DROP;
      // on the top row the score bar holds the wall: the name goes under their feet instead
      this.placeTag(p.id, cx, this.score && over < TILE_PX + 7 ? cy + 15 : Math.max(7, over), seen);
      if (p.shield > 0) this.placeSpiral(p.id, SHIELD_TICKS - p.shield, cx, cy, effectColor);
      if (held && p.stun > 0) {
        const look = bombLook({ fuse: held.fuse, tick: s.tick, type: held.type, mega: held.mega, carrying: true });
        const radius = held.mega ? 175 * BOMBS.mega.scale : 42 * BOMBS.scale;
        stunHead = avoidHeldBomb(stunHead, { x: carried.x, y: carried.y,
          rx: radius * carried.scale * look.sx, ry: radius * carried.scale * look.sy });
      }
      this.stunEffects.draw({ ...stunHead, remaining: p.stun, tick: s.tick, alpha: seen });
      const electricalCharge = character === "static" ? staticPowerLook(p.specialCooldown) : null;
      if (electricalCharge) this.energyEffects.magnetAura({ x: cx, y: cy - headroom * 0.4, tick: electricalCharge.age, alpha: electricalCharge.alpha * seen, color: effectColor });
      // Penelope's kiss leaves its victim with hearts going round over their head.
      for (const h of charmHearts(p.charmed, s.tick)) this.drawPixelHeart(top, { x: cx + h.dx, y: cy - headroom + h.dy, size: h.size, alpha: 1, tick: s.tick });
      // A spark over a player whose special is ready.
      // Goku's ki gathering at his hip while the Kamehameha charges (the side view's sprite draws its own).
      if (p.charge > 0 && (p.facing === "up" || p.facing === "down")) {
        const r = 0.8 + 1.8 * (1 - p.charge / KAME_CHARGE) + Math.sin(s.tick / 2) * 0.3;
        const kx = cx + (p.facing === "down" ? -3 : 3);
        if (!this.abilityEffects.draw("ki", { x: kx, y: cy - 1, tick: s.tick, size: (r + 2) * 3, color: effectColor })) {
          top.circle(kx, cy - 1, r + 1.5).fill({ color: specialInk(COLORS.ki, effectColor), alpha: 0.4 });
          top.circle(kx, cy - 1, r).fill({ color: 0xffffff, alpha: 0.9 });
        }
      }
      // Naruto's Rasengan: spinning in his hand as he dashes, bursting where it strikes.
      const rasen = rasenganLook(p.rasengan, blast);
      if (rasen) {
        const dir = "burst" in rasen && blast ? blast.dir : p.facing;
        const [hx, hy] = boltOrigin(skin?.sheet, dir, cx, cy);
        const [dx, dy] = DIR_VECTORS[dir];
        const ahead = "burst" in rasen && blast?.length ? TILE_PX * 0.4 : 0;
        this.placeRasengan(top, rasen, hx + dx * ahead, hy + dy * ahead, effectColor);
      }
      // The green lantern's bubble round him, his body showing through it.
      const bubble = bubbleLook(p.bubble, s.tick);
      if (bubble) this.placeBubble(top, bubble, cx, cy - 4, effectColor);
      if (p.specialCooldown === 0 && !web && p.stun === 0) {
        const r = 1.2 + Math.sin(s.tick / 8) * 0.4;
        const spark = { thor: COLORS.bolt, goku: COLORS.ki, naruto: COLORS.ki, bomb: COLORS.fuse, spider: COLORS.web, pikachu: COLORS.bolt, static: COLORS.magnet, flash: COLORS.bolt, bugs: COLORS.dirt, lantern: COLORS.lantern }[character as string] ?? COLORS.spark;
        top.circle(cx + 6, cy - headroom, r + 1).fill({ color: specialInk(spark, effectColor), alpha: 0.5 });
        top.circle(cx + 6, cy - headroom, r).fill(0xffffff);
      }
    });

    this.kameUsed = 0;
    this.patronusUsed = 0;
    this.ballUsed = 0;
    for (const b of s.blasts) this.drawBlast(top, b, s);
    for (let i = this.ballUsed; i < this.ballSprites.length; i++) this.ballSprites[i]!.visible = false;
    for (let i = this.kameUsed; i < this.kameSprites.length; i++) this.kameSprites[i]!.visible = false;
    for (let i = this.rasenUsed; i < this.rasenSprites.length; i++) this.rasenSprites[i]!.visible = false;
    for (let i = this.patronusUsed; i < this.patronusSprites.length; i++) this.patronusSprites[i]!.visible = false;
    for (let i = this.bubbleUsed; i < this.bubbleSprites.length; i++) this.bubbleSprites[i]!.visible = false;
    this.drawParticles(top);
    const shake = this.fx.shake + summonShake;
    this.root.position.set(Math.sin(s.tick * 2.3) * shake, Math.cos(s.tick * 3.1) * shake);

    this.banner.position.set((width * TILE_PX) / 2, (height * TILE_PX) / 2);
    this.clock.position.set((width * TILE_PX) / 2, 3);
    this.drawScore(s);
    this.clock.text = battleClockText(s);
  }

  /** A special's blast, from the caster to where it stopped. */
  private drawBlast(g: Graphics, b: Blast, state: PublicView): void {
    const color = this.specialColor(b.ownerId, state);
    if (b.kind === "thunder") return this.drawThunder(g, b, color);
    if (b.kind === "ball") return this.drawBall(g, b, color);
    // the rasengan is drawn with its caster, as optimus's truck stands in for him
    if (b.length === 0 || b.kind === "rasengan" || b.kind === "truck") return;
    const [dx, dy] = DIR_VECTORS[b.dir];
    const center = (t: number) => t * TILE_PX + TILE_PX / 2;
    const x1 = center(b.x + dx * b.length);
    const y1 = center(b.y + dy * b.length);
    // The Kamehameha shows the moment it fires (its charge was the wind-up); bolts wait for the thrust.
    if (b.kind === "kamehameha") {
      const at = this.lastSeen.get(b.ownerId);
      const [ox, oy] = boltOrigin(this.skins.get(this.character(b.ownerId))?.sheet, b.dir, at?.cx ?? center(b.x), at?.cy ?? center(b.y));
      return this.drawKamehameha(g, { x0: ox, y0: oy, x1: dx ? x1 : ox, y1: dy ? y1 : oy, color }, b.ttl);
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
      return this.drawPatronus(g, { x0: ox, y0: oy, x1: dx ? x1 : ox, y1: dy ? y1 + 6 : oy, dir: b.dir, run: b.length * PATRONUS_TICKS_PER_TILE, age: blastLife(b) - b.ttl, color });
    }
    // Penelope's kiss flies from the first tick (whoever it charms is stunned at once).
    if (b.kind === "kiss") {
      const at = this.lastSeen.get(b.ownerId);
      const [ox, oy] = boltOrigin(this.skins.get(this.character(b.ownerId))?.sheet, b.dir, at?.cx ?? center(b.x), at?.cy ?? center(b.y));
      for (const h of kissHearts(ox, oy, dx ? x1 : ox, dy ? y1 : oy, BLAST_TICKS - b.ttl)) this.drawPixelHeart(g, { x: h.x, y: h.y, size: h.size, alpha: h.alpha, tick: BLAST_TICKS - b.ttl, color });
      return;
    }
    // The magnet's pull and the flash's dash land at once (the one caught, or he, is already there), so they show from the first tick.
    let alpha = Math.min(1, b.ttl / 8);
    if (b.kind !== "magnet") alpha = beamAlpha(BLAST_TICKS - b.ttl + (b.kind === "flash" || b.kind === "tunnel" ? BEAM_DELAY : 0));
    if (alpha <= 0) return;
    if (b.kind === "lightning") {
      // From the hammer of the caster as drawn, level with it all the way to where it stopped.
      const at = this.lastSeen.get(b.ownerId);
      const [ox, oy] = boltOrigin(this.skins.get(this.character(b.ownerId))?.sheet, b.dir, at?.cx ?? center(b.x), at?.cy ?? center(b.y));
      return this.drawBolt(g, { x0: ox, y0: oy, x1: dx ? x1 : ox, y1: dy ? y1 : oy, color }, b.ttl, alpha);
    }
    if (b.kind === "tunnel") return this.drawTunnel(this.world, {
      x0: center(b.x), y0: center(b.y), x1, y1, age: BLAST_TICKS - b.ttl, alpha, color,
    }, (x, y) => getTile(state, Math.floor(x / TILE_PX), Math.floor(y / TILE_PX)) === Tile.Empty);
    if (b.kind === "flash") return this.drawSpeed(g, { x0: center(b.x), y0: center(b.y), x1, y1, color }, BLAST_TICKS - b.ttl, alpha);
    if (b.kind === "magnet") {
      const at = this.lastSeen.get(b.ownerId);
      const [ox, oy] = boltOrigin(this.skins.get(this.character(b.ownerId))?.sheet, b.dir, at?.cx ?? center(b.x), at?.cy ?? center(b.y));
      return this.drawMagnet(g, { x0: ox, y0: oy, x1: dx ? x1 : ox, y1: dy ? y1 : oy, color }, b.ttl, alpha);
    }
    if (b.kind === "web") {
      const at = this.lastSeen.get(b.ownerId);
      const [ox, oy] = boltOrigin(this.skins.get(this.character(b.ownerId))?.sheet, b.dir, at?.cx ?? center(b.x), at?.cy ?? center(b.y));
      const endX = dx ? x1 : ox;
      const endY = dy ? y1 : oy;
      if (!this.webCocoons.drawShot(g, { x0: ox, y0: oy, x1: endX, y1: endY, age: BLAST_TICKS - b.ttl, alpha, color })) {
        this.drawWeb(g, { x0: ox, y0: oy, x1: endX, y1: endY, color }, alpha);
      }
      return;
    }
  }

  /**
   * Goku's Kamehameha: a thick beam of light-blue ki with a white core, swelling in at once and thinning
   * out as it fades, a ball of ki at his hands and a bigger one where it stops.
   */
  private drawKamehameha(g: Graphics, path: SpecialPath, ttl: number): void {
    const { x0, y0, x1, y1, color } = path;
    const age = BLAST_TICKS - ttl;
    const w = Math.min(1, (age + 1) / 4) * Math.min(1, ttl / 12);
    if (this.energyEffects.draw("ki", { x0, y0, x1, y1, tick: age, alpha: Math.min(1, ttl / 6), power: w, color })) {
      this.abilityEffects.draw("ki", { x: x0, y: y0, tick: age, size: 14 * w, color });
      return;
    }
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
        sprite.texture = specialTexture(this.kameArt[part.kind][frame]!, color);
        sprite.position.set(part.x, part.y);
        sprite.rotation = part.rot;
        sprite.scale.set(KAMEHAMEHA.scale * grow, KAMEHAMEHA.scale * w);
        sprite.alpha = Math.min(1, ttl / 6);
        sprite.visible = true;
      }
      return;
    }
    const pulse = 1 + Math.sin(age / 1.5) * 0.08;
    for (const [width, ink, a] of [[14, COLORS.ki, 0.35], [8, 0xbff4ff, 0.8], [3.5, 0xffffff, 1]] as const) {
      g.moveTo(x0, y0).lineTo(x1, y1).stroke({ color: specialInk(ink, color), width: width * w * pulse, alpha: a, cap: "round" });
    }
    g.circle(x1, y1, 9 * w * pulse).fill({ color: specialInk(COLORS.ki, color), alpha: 0.45 });
    g.circle(x1, y1, 5 * w * pulse).fill({ color: 0xffffff, alpha: 0.95 });
    g.circle(x0, y0, 6 * w).fill({ color: specialInk(COLORS.ki, color), alpha: 0.5 });
    g.circle(x0, y0, 3.5 * w).fill({ color: 0xffffff, alpha: 1 });
  }

  /** The spider's web: a taut strand from his hand to where it stopped, splatting into a little net there. */
  private drawWeb(g: Graphics, path: SpecialPath, alpha: number): void {
    const { x0, y0, x1, y1, color } = path;
    g.moveTo(x0, y0).lineTo(x1, y1).stroke({ color: specialInk(COLORS.webShade, color), width: 2.5, alpha: alpha * 0.6, cap: "round" });
    g.moveTo(x0, y0).lineTo(x1, y1).stroke({ color: specialInk(COLORS.web, color), width: 1.2, alpha, cap: "round" });
    const spokes = 8;
    for (let k = 0; k < spokes; k++) {
      const a = (k / spokes) * Math.PI * 2;
      g.moveTo(x1, y1).lineTo(x1 + Math.cos(a) * 6, y1 + Math.sin(a) * 6);
    }
    g.stroke({ color: specialInk(COLORS.web, color), width: 0.8, alpha });
    for (const r of [2.5, 4.5]) {
      const ring = Array.from({ length: spokes }, (_, k) => [x1 + Math.cos((k / spokes) * Math.PI * 2) * r, y1 + Math.sin((k / spokes) * Math.PI * 2) * r]).flat();
      g.poly(ring).stroke({ color: specialInk(COLORS.web, color), width: 0.6, alpha });
    }
  }

  /**
   * One arm of Pikachu's thunder shock: bolts crackling from his cheeks out to where the arm stopped; the
   * "up" arm (one per shock) also draws the burst of light around him.
   */
  private drawThunder(g: Graphics, b: Blast, color: number | null = null): void {
    const alpha = beamAlpha(BLAST_TICKS - b.ttl);
    if (alpha <= 0) return;
    const at = this.lastSeen.get(b.ownerId);
    const ox = at?.cx ?? b.x * TILE_PX + TILE_PX / 2;
    const oy = (at?.cy ?? b.y * TILE_PX + TILE_PX / 2) - 3;
    if (b.dir === "up") {
      const r = 9 + ((BLAST_TICKS - b.ttl) % 4);
      // A ring of light round him, thin enough to see him through it.
      if (!this.energyEffects.aura({ x: ox, y: oy, tick: BLAST_TICKS - b.ttl, alpha, color })) {
        g.circle(ox, oy, r + 3).stroke({ color: specialInk(COLORS.bolt, color), width: 3, alpha: alpha * 0.45 });
        g.circle(ox, oy, r).fill({ color: specialInk(COLORS.bolt, color), alpha: alpha * 0.12 });
      }
    }
    if (b.length === 0) return;
    const [dx, dy] = DIR_VECTORS[b.dir];
    const reach = b.length * TILE_PX + TILE_PX * 0.3;
    const path = { x0: ox + dx * 4, y0: oy + dy * 4, x1: ox + dx * reach, y1: oy + dy * reach, tick: BLAST_TICKS - b.ttl, alpha, color };
    if (!this.energyEffects.draw("shock", path)) this.drawBolt(g, path, b.ttl, alpha);
  }

  /**
   * Static's magnet pull: two violet arcs crackling from his hand to where it caught, and rings of force
   * running back along them to him (`magnetWaves`).
   */
  private drawMagnet(g: Graphics, path: SpecialPath, ttl: number, alpha: number): void {
    const { x0, y0, x1, y1, color } = path;
    if (this.energyEffects.draw("magnet", { x0, y0, x1, y1, tick: BLAST_TICKS - ttl, alpha, color })) return;
    const seed = Math.floor(ttl / 2);
    for (const [k, width, ink, a] of [[0, 5, COLORS.magnet, 0.4], [0, 1.5, 0xffffff, 1], [7, 1, COLORS.magnet, 0.9]] as const) {
      const pts = boltPoints(x0, y0, x1, y1, seed + k * 31);
      g.moveTo(pts[0]![0], pts[0]![1]);
      for (const [x, y] of pts.slice(1)) g.lineTo(x, y);
      g.stroke({ color: specialInk(ink, color), width, alpha: alpha * a, cap: "round", join: "round" });
    }
    for (const w of magnetWaves(x0, y0, x1, y1, BLAST_TICKS - ttl)) {
      g.circle(w.x, w.y, w.r).stroke({ color: specialInk(COLORS.magnet, color), width: 1.5, alpha: alpha * 0.8 });
    }
    g.circle(x1, y1, 5).fill({ color: specialInk(COLORS.magnet, color), alpha: alpha * 0.4 });
    g.circle(x0, y0, 2.5).fill({ color: 0xffffff, alpha });
  }

  /** Bugs' tunnel: a hole where he went under, a ridge of dirt mounds along the way, a hole where he popped out with clods flying. */
  private drawTunnel(g: Graphics, pose: SpecialPath & { age: number; alpha: number }, open: (x: number, y: number) => boolean): void {
    const { x0, y0, x1, y1, age, alpha, color } = pose;
    const mounds = tunnelMounds(x0, y0, x1, y1, age).filter(m => open(m.x, m.y));
    if (this.companionEffects.draw("tunnel", { x: x0, y: y0 + 1, tick: age, size: 18, alpha, color })) {
      if (open(x1, y1)) this.companionEffects.draw("tunnel", { x: x1, y: y1 + 1, tick: age + 6, size: 18, alpha, color });
      for (const m of mounds) this.companionEffects.draw("mound", { x: m.x, y: m.y + 1, tick: age, size: (m.r + 1) * 2.5, alpha, color });
      return;
    }
    for (const [x, y] of [[x0, y0], [x1, y1]] as const) {
      if (!open(x, y)) continue;
      g.ellipse(x, y + 1, 5, 2).fill({ color: specialInk(COLORS.dirtShade, color), alpha });
      g.ellipse(x, y + 1, 4, 1.5).fill({ color: COLORS.hole, alpha });
    }
    for (const m of mounds) {
      g.ellipse(m.x, m.y + 4, m.r + 1, m.r * 0.7 + 0.5).fill({ color: specialInk(COLORS.dirtShade, color), alpha });
      g.ellipse(m.x, m.y + 3.5, m.r, m.r * 0.6).fill({ color: specialInk(COLORS.dirt, color), alpha });
    }
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k - 2) * 0.55;
      const d = 3 + age * 0.9;
      g.circle(x1 + Math.cos(a) * d, y1 + 4 + Math.sin(a) * d + age * age * 0.03, 1.1).fill({ color: specialInk(k % 2 ? COLORS.dirt : COLORS.dirtShade, color), alpha });
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
      pixelStroke(g, { x0: x - dx, y0: cy - dy, x1: x + dx, y1: cy + dy, color: k ? COLORS.staffBlur : 0x50301e, width: k ? 2 : 3, alpha: alpha * (k ? 0.25 / k : 1) });
      if (k === 0) {
        pixelStroke(g, { x0: x - dx, y0: cy - dy - 0.5, x1: x + dx, y1: cy + dy - 0.5, color: COLORS.staff, width: 1.5, alpha });
        pixelStroke(g, { x0: x - dx * 0.9, y0: cy - dy * 0.9 - 1, x1: x + dx * 0.9, y1: cy + dy * 0.9 - 1, color: 0xe7c381, width: 0.5, alpha });
      }
    }
  }

  /** The flash's dash: red and yellow speed lines from where he left to where he stopped, a bolt crackling along them. */
  private drawSpeed(g: Graphics, path: SpecialPath, age: number, alpha: number): void {
    const { x0, y0, x1, y1, color } = path;
    this.energyEffects.draw("shock", { x0, y0, x1, y1, tick: age, alpha, power: 0.7, color });
    const length = Math.hypot(x1 - x0, y1 - y0);
    const rotation = Math.atan2(y1 - y0, x1 - x0);
    if (this.companionEffects.draw("speed", { x: x0, y: y0, tick: age, size: 22, rotation, alpha, color })) {
      for (let step = 8; step < length; step += 12) {
        const t = step / length;
        this.companionEffects.draw("speed", { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, tick: age + step, size: 22, rotation, alpha, color });
      }
      return;
    }
    speedLines(x0, y0, x1, y1, age).forEach((l, k) => {
      g.moveTo(l.x0, l.y0).lineTo(l.x1, l.y1).stroke({ color: specialInk(k % 2 ? COLORS.bolt : COLORS.speed, color), width: k === 2 ? 3 : 1.5, alpha, cap: "round" });
    });
    const pts = boltPoints(x0, y0, x1, y1, Math.floor(age / 2));
    g.moveTo(pts[0]![0], pts[0]![1]);
    for (const [x, y] of pts.slice(1)) g.lineTo(x, y);
    g.stroke({ color: 0xffffff, width: 1, alpha: alpha * 0.9, join: "round" });
    g.circle(x0, y0, 6 * alpha).fill({ color: specialInk(COLORS.bolt, color), alpha: alpha * 0.35 }); // the puff he left behind
  }

  /** Thor's bolt: a yellow glow and a white core along a zigzag that re-forks every 3 ticks, flashing at the end. */
  private drawBolt(g: Graphics, path: SpecialPath, ttl: number, alpha: number): void {
    const { x0, y0, x1, y1, color } = path;
    if (this.energyEffects.draw("lightning", { x0, y0, x1, y1, tick: BLAST_TICKS - ttl, alpha, color })) return;
    const seed = Math.floor(ttl / 3);
    for (const [k, width, ink, a] of [[0, 6, COLORS.bolt, 0.45], [0, 2, 0xffffff, 1], [1, 1, COLORS.bolt, 0.8]] as const) {
      const pts = boltPoints(x0, y0, x1, y1, seed + k * 101);
      g.moveTo(pts[0]![0], pts[0]![1]);
      for (const [x, y] of pts.slice(1)) g.lineTo(x, y);
      g.stroke({ color: specialInk(ink, color), width, alpha: alpha * a, cap: "round", join: "round" });
    }
    g.circle(x1, y1, 4 + (seed % 2)).fill({ color: specialInk(COLORS.bolt, color), alpha: alpha * 0.5 });
    g.circle(x1, y1, 2).fill({ color: 0xffffff, alpha });
  }

  private drawPixelHeart(g: Graphics, pose: { x: number; y: number; size: number; alpha: number; tick: number; color?: number | null }): void {
    if (!this.companionEffects.draw("heart", { ...pose, size: pose.size * 1.5 })) drawHeart(g, pose.x, pose.y, pose.size, pose.alpha, pose.color);
  }

  private drawFloor(g: Graphics, floor: Floor, px: number, py: number, tick: number): void {
    if (floor === Floor.Warp) {
      if (this.groundEffects.draw("warp", px + TILE_PX / 2, py + TILE_PX / 2, tick)) return;
      const pulse = 1 + Math.sin(tick / 8) * 0.6;
      g.circle(px + TILE_PX / 2, py + TILE_PX / 2, 6).fill(COLORS.warp);
      g.circle(px + TILE_PX / 2, py + TILE_PX / 2, 3 + pulse).fill(COLORS.warpCore);
      return;
    }
    const belt = BELT_DIRS[floor];
    if (!belt) return;
    if (this.tileArt && this.conveyors.draw(floor, px, py, tick)) return;
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
function drawHeart(g: Graphics, x: number, y: number, size: number, alpha: number, color?: number | null): void {
  if (alpha <= 0) return;
  const r = size / 4;
  g.circle(x - r, y - r * 0.6, r * 1.05).fill({ color: specialInk(COLORS.heart, color), alpha });
  g.circle(x + r, y - r * 0.6, r * 1.05).fill({ color: specialInk(COLORS.heart, color), alpha });
  g.poly([x - size / 2, y - r * 0.4, x + size / 2, y - r * 0.4, x, y + size / 2]).fill({ color: specialInk(COLORS.heart, color), alpha });
  g.circle(x - r * 1.2, y - r, r * 0.35).fill({ color: specialInk(COLORS.heartShine, color), alpha });
}
