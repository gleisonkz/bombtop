import { BLAST_TICKS, DIR_VECTORS, FUSE_TICKS, KAME_CHARGE, RASENGAN_TICKS, type Blast, type Bomb, type Player, type Flame, FLAME_TICKS, TICK_RATE, TILE, ItemKind, Tile, type BombType, type Facing } from "@bombtop/shared";
import type { MascotView, Mood } from "../ui/art";

type Rgb = readonly [number, number, number];

/** One animation: a row of the sheet and how many frames it has. */
export interface Strip {
  row: number;
  frames: number;
}

/** Where each animation sits on a character sheet (all frames are one fixed cell size). */
export interface SheetLayout {
  url: string;
  width: number;
  height: number;
  frameW: number;
  frameH: number;
  /** Cell pixel that sits on the player's position (between the feet). */
  anchorX: number;
  anchorY: number;
  /** Character height in pixels, to hold a bomb over its head. */
  bodyH: number;
  /** Where a bolt leaves the cast pose (sheet pixels from the anchor; `side` faces `side`). */
  muzzle?: Record<"down" | "side" | "up", readonly [number, number]>;
  /** Ticks each walk frame stays on screen. */
  ticksPerFrame: number;
  /** Ticks each idle frame stays on screen, when standing breathes slower than walking. */
  idleTicksPerFrame?: number;
  /** The sheet draws one side; the other one is mirrored. */
  side: "left" | "right";
  idle: Record<"down" | "up" | "side", Strip>;
  walk: Record<"down" | "up" | "side", Strip>;
  /** Arms-up rows for holding a bomb overhead, when the sheet has them. */
  carryIdle?: Record<"down" | "up" | "side", Strip>;
  carryWalk?: Record<"down" | "up" | "side", Strip>;
  /** Clothing colors, repainted in each player's color (base shade first). */
  clothes?: Rgb[];
  /** Or: a hue range (degrees) repainted in each player's color, for sheets without a fixed palette. */
  hues?: readonly [number, number];
  /** With `hues`: the body's base shade, which becomes exactly the player color (see shadeHues). */
  hueBase?: Rgb;
  /** Player colors the art already uses all over: those players keep the sheet's own colors instead. */
  keepFor?: readonly Rgb[];
  /** Hit reaction, shown facing the camera while stunned. */
  stun?: Strip;
  /** Played once when the player dies. */
  death?: Strip;
  /** A pose for the menus (lobby seats), facing the camera. */
  lobby?: Strip;
  /** Casting the special, once per use (CAST_TICKS_PER_FRAME each frame). */
  cast?: Record<"down" | "up" | "side", Strip>;
  /** Drawn size relative to the sheet (big sheets are shrunk to the tile). */
  scale?: number;
}

const strips = (down: number, side: number, up: number, frames: number) => ({
  down: { row: down, frames },
  side: { row: side, frames },
  up: { row: up, frames },
});

/** Trial sheets (both CC0, see public/sprites/LICENSES.md). */
export const SHEETS = {
  foozle: {
    url: "sprites/foozle-legend.png",
    width: 1344,
    height: 4928,
    frameW: 64,
    frameH: 64,
    anchorX: 32,
    anchorY: 46,
    bodyH: 23,
    ticksPerFrame: 6,
    side: "right",
    idle: strips(0, 26, 51, 1),
    walk: strips(3, 29, 54, 8),
    carryIdle: strips(5, 31, 56, 1),
    carryWalk: strips(6, 32, 57, 8),
    clothes: [[82, 174, 35], [58, 123, 25], [4, 57, 31]],
  },
  james: {
    url: "sprites/james.png",
    width: 64,
    height: 128,
    frameW: 8,
    frameH: 16,
    anchorX: 4,
    anchorY: 15,
    bodyH: 17,
    ticksPerFrame: 8,
    side: "right",
    idle: { down: { row: 0, frames: 1 }, side: { row: 3, frames: 1 }, up: { row: 2, frames: 1 } },
    walk: strips(1, 3, 2, 4),
    clothes: [[235, 115, 201], [255, 173, 198]],
  },
  /** The ninja, made in PixelLab ("Ice ninja HD4"; scripts/build-character-sheet.py ninja lays out its frames). */
  ninja: {
    url: "sprites/ninja.png",
    width: 1620,
    height: 2988,
    frameW: 180,
    frameH: 166,
    anchorX: 90.5,
    anchorY: 151,
    bodyH: 142,
    ticksPerFrame: 7,
    idleTicksPerFrame: 15,
    side: "right",
    idle: strips(0, 1, 2, 4),
    walk: strips(3, 4, 5, 6),
    stun: { row: 6, frames: 6 },
    death: { row: 7, frames: 7 },
    /** The ice blast: hands gather a frost orb at one side, then both palms thrust it forward. */
    cast: strips(8, 9, 10, 9),
    carryIdle: strips(11, 12, 13, 4),
    carryWalk: strips(14, 15, 16, 6),
    lobby: { row: 17, frames: 8 },
    /** His blue helmet and suit and the ice on his armor. */
    hues: [185, 250],
    scale: 0.156,
  },
  /** Captain America, made in PixelLab (scripts/build-character-sheet.py captain lays out its frames). */
  captain: {
    url: "sprites/captain.png",
    width: 1116,
    height: 2484,
    frameW: 124,
    frameH: 138,
    anchorX: 61,
    anchorY: 135,
    bodyH: 124,
    ticksPerFrame: 7,
    idleTicksPerFrame: 15,
    side: "right",
    idle: strips(0, 1, 2, 4),
    walk: strips(3, 4, 5, 6),
    stun: { row: 6, frames: 6 },
    death: { row: 7, frames: 7 },
    /** The special: shield forward, he drops to one knee as it grows huge; the kneel holds while it is up. */
    cast: strips(8, 9, 10, 9),
    carryIdle: strips(11, 12, 13, 4),
    carryWalk: strips(14, 15, 16, 6),
    lobby: { row: 17, frames: 8 },
    /** The navy suit and helmet (the carried bomb's blue-black stays). */
    hues: [200, 232],
    hueBase: [35, 56, 92],
    /** White would melt his suit into his stars, stripes and shield: that player keeps the navy. */
    keepFor: [[245, 245, 245]],
    scale: 0.17,
  },
  /** Thor (fan art), made in PixelLab (scripts/build-character-sheet.py thor lays out its frames). */
  thor: {
    url: "sprites/thor.png",
    width: 1260,
    height: 2628,
    frameW: 140,
    frameH: 146,
    anchorX: 71,
    anchorY: 143,
    bodyH: 124,
    /** The hammer's face in the thrust (the back view hides it: over his head). */
    muzzle: { side: [69, -73.5], down: [1, -30], up: [0, -93] },
    ticksPerFrame: 7,
    idleTicksPerFrame: 15,
    side: "right",
    idle: strips(0, 1, 2, 4),
    walk: strips(3, 4, 5, 6),
    stun: { row: 6, frames: 6 },
    death: { row: 7, frames: 7 },
    /** The special: hammer swung overhead, then thrust forward as the bolt leaves it. */
    cast: strips(8, 9, 10, 9),
    carryIdle: strips(11, 12, 13, 4),
    carryWalk: strips(14, 15, 16, 6),
    lobby: { row: 17, frames: 8 },
    /** The navy armor (the silver helmet and chest discs sit just past it, at hue 229). */
    hues: [205, 226],
    hueBase: [47, 56, 73],
    /** White would melt his armor into his silver helmet and discs: that player keeps the navy. */
    keepFor: [[245, 245, 245]],
    scale: 0.17,
  },
  /** Goku (fan art), made in PixelLab (scripts/build-character-sheet.py goku lays out its frames). */
  goku: {
    url: "sprites/goku.png",
    width: 1314,
    height: 2862,
    frameW: 146,
    frameH: 159,
    anchorX: 71.5,
    anchorY: 153,
    bodyH: 148,
    ticksPerFrame: 7,
    idleTicksPerFrame: 15,
    side: "right",
    idle: strips(0, 1, 2, 4),
    walk: strips(3, 4, 5, 6),
    stun: { row: 6, frames: 6 },
    death: { row: 7, frames: 7 },
    /** The Kamehameha: hands cupped at his hip while it charges, thrust forward as the beam leaves. */
    cast: strips(8, 9, 10, 9),
    carryIdle: strips(11, 12, 13, 4),
    carryWalk: strips(14, 15, 16, 6),
    lobby: { row: 17, frames: 8 },
    /** His hands at the thrust (the back view hides them: over his shoulders). */
    muzzle: { side: [46.5, -67.5], down: [2.5, -34], up: [0, -97] },
    /** The blue undershirt, sash, wristbands and boots (his orange gi is too close to his skin to repaint). */
    hues: [205, 235],
    hueBase: [8, 59, 137],
    scale: 0.15,
  },
  /** Naruto (fan art), made in PixelLab (scripts/build-character-sheet.py naruto lays out its frames). */
  naruto: {
    url: "sprites/naruto.png",
    width: 1188,
    height: 2952,
    frameW: 132,
    frameH: 164,
    anchorX: 66.5,
    anchorY: 159,
    bodyH: 158,
    ticksPerFrame: 7,
    idleTicksPerFrame: 15,
    side: "right",
    idle: strips(0, 1, 2, 4),
    walk: strips(3, 4, 5, 6),
    stun: { row: 6, frames: 6 },
    death: { row: 7, frames: 7 },
    /** The Rasengan: dashing with his hand out, then the lunge as it strikes. */
    cast: strips(8, 9, 10, 9),
    carryIdle: strips(11, 12, 13, 4),
    carryWalk: strips(14, 15, 16, 6),
    lobby: { row: 17, frames: 8 },
    /** His hand in the lunge, where the Rasengan spins (the back view hides it: over his shoulders). */
    muzzle: { side: [49.5, -66.5], down: [0, -52.5], up: [0, -84.7] },
    /** The navy of his jacket, headband and sandals (his orange is too close to his skin to repaint). */
    hues: [205, 232],
    hueBase: [6, 42, 92],
    /** White would bleach his jacket: that player keeps the navy. */
    keepFor: [[245, 245, 245]],
    scale: 0.14,
  },
  bomber: {
    url: "sprites/bomber-atlas.png?v=20261025-hd-family-v1",
    width: 936,
    height: 2592,
    frameW: 104,
    frameH: 144,
    anchorX: 52,
    anchorY: 140,
    bodyH: 100,
    ticksPerFrame: 7,
    idleTicksPerFrame: 15,
    side: "right",
    idle: strips(0, 1, 2, 4),
    walk: strips(3, 4, 5, 6),
    stun: { row: 6, frames: 6 },
    /** He buckles, his visor goes dark, and he blows up. */
    death: { row: 7, frames: 7 },
    /** Planting the mega bomb: down on one knee with both hands pushed onto it, then up. */
    cast: strips(8, 9, 10, 9),
    carryIdle: strips(11, 12, 13, 4),
    carryWalk: strips(14, 15, 16, 6),
    lobby: { row: 17, frames: 8 },
    /** His armor plates (shoulders, vest, knees). */
    hues: [250, 290],
    hueBase: [106, 71, 145],
    /** White would bleach his armor into the steel round his head: that player keeps the violet. */
    keepFor: [[245, 245, 245]],
    scale: 0.22,
  },
} satisfies Record<string, SheetLayout>;

export type SheetName = keyof typeof SHEETS;

/** Bomb art (scripts/build-bombs-hd.py): one square cell per bomb type, side by side, on a 32-unit grid at 4 px per unit. */
export const BOMBS = {
  url: "sprites/bombs.png",
  stages: ["armed", "warning", "critical", "detonation-start"] as const,
  width: 384,
  size: 128,
  /** Cell pixel at the center of the bomb's body. */
  anchorX: 64,
  anchorY: 76,
  scale: 0.1,
  order: ["normal", "pierce", "remote"] satisfies BombType[],
  /** Cell pixel of the fuse spark (or the remote's light) and its glow color. */
  glow: {
    normal: { x: 100, y: 17, color: 0xffd23f },
    pierce: { x: 64, y: 20, color: 0xffd23f },
    remote: { x: 62, y: 10, color: 0xff3b3b },
  } satisfies Record<BombType, { x: number; y: number; color: number }>,
};

/** Left edge of a bomb type's cell. */
export const bombFrame = (type: BombType): number => BOMBS.order.indexOf(type) * BOMBS.size;

const SPARK = [1, 1, 0, 1, 0, 1, 1, 1, 0]; // irregular, like a burning fuse

/** How much bigger the bomb mascot's mega bomb is drawn. */
export const MEGA_SCALE = 1.6;

/**
 * How a bomb looks this tick: it breathes (squash and stretch), faster and
 * flashing red in its last second, while its spark (or remote light) flickers.
 * Timed by the remaining fuse, including remote bombs.
 */
export function bombLook({ fuse, tick, type, mega }: { fuse: number; tick: number; type: BombType; mega?: boolean | undefined }) {
  const urgent = fuse <= TICK_RATE;
  const stage = fuse <= Math.round(TICK_RATE * 0.3) ? "detonation-start" : urgent ? "critical" : fuse <= TICK_RATE * 2 ? "warning" : "armed";
  const breath = Math.sin((tick / TICK_RATE) * Math.PI * 2 * (urgent ? 5 : 2)) * 0.1;
  const size = mega ? MEGA_SCALE : 1;
  return {
    stage,
    sx: (1 + breath) * size,
    sy: (1 - breath) * size,
    tint: 0xffffff,
    flash: urgent && Math.floor((FUSE_TICKS - fuse) / 6) % 2 === 0,
    glow: type === "remote" ? Math.floor(tick / 20) % 2 === 0 : SPARK[Math.floor(tick / 3) % SPARK.length] === 1,
  };
}

/** The mascot (ui/art.ts SVG) as an arena character, rasterized at one pixel per SVG unit. */
export const MASCOT = {
  width: 100,
  height: 108,
  /** Between the feet. */
  anchorX: 48,
  anchorY: 104,
  /** Drawn size: the body comes out a bit under a tile wide. */
  scale: 0.21,
  /** Height to hold a bomb over, in SVG units. */
  bodyH: 100,
  deathTicks: 40,
  moods: ["happy", "wow", "sad"] satisfies Mood[],
};

/** Ticks per walk step: two steps cross a tile at base speed. */
export const MASCOT_STEP_TICKS = 8;

const VIEWS: Record<Facing, MascotView> = { down: "front", up: "back", left: "side", right: "side" };

/**
 * How the mascot stands this tick: it breathes while idle, steps its feet (bobbing
 * on the lifted steps) while walking, wobbles wide-eyed facing us while stunned, and
 * shows its face, back or side by where it is going (the side mirrored for left).
 */
export function mascotPose({ moving, stunned, facing, tick }: { moving: boolean; stunned: boolean; facing: Facing; tick: number }) {
  const t = (tick / TICK_RATE) * Math.PI * 2;
  const view = VIEWS[facing];
  const flip = facing === "left";
  if (stunned) return { sx: 1, sy: 1, dy: 0, rot: Math.sin(t * 4) * 0.3, flip: false, view: "front" as MascotView, step: 0, mood: "wow" as Mood };
  if (moving) {
    const step = Math.floor(tick / MASCOT_STEP_TICKS) % 4;
    const lifted = step % 2 === 1;
    return { sx: 1, sy: 1, dy: lifted ? -1.2 : 0, rot: lifted ? (step === 1 ? -0.04 : 0.04) : 0, flip, view, step, mood: "happy" as Mood };
  }
  const breath = Math.sin(t * 1.5) * 0.04;
  return { sx: 1 + breath, sy: 1 - breath, dy: 0, rot: 0, flip, view, step: 0, mood: "happy" as Mood };
}

/** The mascot `ticks` after dying: it floats up, squashed and fading; null once gone. */
export function mascotDeath(ticks: number) {
  if (ticks >= MASCOT.deathTicks) return null;
  const k = ticks / MASCOT.deathTicks;
  return { alpha: 1 - k * k, sx: 1 + k * 0.3, sy: 1 - k * 0.3, dy: -k * 10, mood: "sad" as Mood };
}

/** Explosion flames: rows of square cells per piece, one column per stage of the flame's life. */
export const FLAMES = {
  url: "sprites/flames.png?v=20261025-sculpted-flames-v5-connected",
  size: 128,
  frames: 5,
  variants: 4,
  rows: { center: 0, mid: 1, end: 5 },
  scale: 16 / 128,
  centerScale: 20 / 128,
};

export type FlamePiece = { kind: keyof typeof FLAMES.rows; rot: number };

export function flameConnections(burning: (x: number, y: number) => boolean, x: number, y: number): number {
  return Number(burning(x + 1, y)) | (Number(burning(x, y + 1)) << 1) | (Number(burning(x - 1, y)) << 2) | (Number(burning(x, y - 1)) << 3);
}

export function flameVariant(x: number, y: number): number {
  const value = x + 3 * y + Math.floor(x / 4) + 2 * Math.floor(y / 4);
  return ((value % FLAMES.variants) + FLAMES.variants) % FLAMES.variants;
}

/**
 * Which piece a flame tile shows, from its burning neighbours: the fireball where
 * arms meet (or a lone flame), arm segments between, and a tip at each arm's end.
 * Mid and end cells point right with the join on the left; `rot` turns them.
 */
export function flamePiece(burning: (x: number, y: number) => boolean, x: number, y: number): FlamePiece {
  const connections = flameConnections(burning, x, y);
  const [l, r, u, d] = [Boolean(connections & 4), Boolean(connections & 1), Boolean(connections & 8), Boolean(connections & 2)];
  const q = Math.PI / 2;
  if ((l || r) === (u || d)) return { kind: "center", rot: 0 };
  if (l && r) return { kind: "mid", rot: 0 };
  if (u && d) return { kind: "mid", rot: q };
  return { kind: "end", rot: l ? 0 : r ? 2 * q : u ? q : -q };
}

/** Column of a flame `ttl` ticks from going out: flare, burn, die down. */
export function flameFrame(ttl: number): number {
  const age = 1 - ttl / FLAME_TICKS;
  return Math.min(FLAMES.frames - 1, Math.max(0, Math.floor(age * FLAMES.frames)));
}

/** Arena art (scripts/build-tiles.py): one row of square cells. Grass has plain, flower and pebble variants per shade. */
export const TILES = {
  url: "sprites/tiles.png",
  size: 128,
  /** Drawn size: one cell per tile. */
  scale: 0.125,
  cells: { grassA: [0, 1, 2], grassB: [3, 4, 5], block: 6, pillar: 7, border: 8 },
};

/** Which cell a tile shows. Grass variants are picked by a hash of the position, so they stay put. */
export function tileCell(tile: Tile, x: number, y: number, width: number, height: number): number {
  const { cells } = TILES;
  if (tile === Tile.Block) return cells.block;
  if (tile === Tile.Wall) return x === 0 || y === 0 || x === width - 1 || y === height - 1 ? cells.border : cells.pillar;
  const shade = (x + y) % 2 === 0 ? cells.grassA : cells.grassB;
  const hash = ((x * 73856093) ^ (y * 19349663)) >>> 0;
  const roll = hash % 100;
  return shade[roll < 72 ? 0 : roll < 86 ? 1 : 2]!;
}

/** Walls and blocks stand up from the floor and shade the tile below them. */
export const castsShadow = (tile: Tile): boolean => tile === Tile.Wall || tile === Tile.Block;

/** Power-up art (scripts/build-items.py): one column per item, rows = plain, then a glint sweeping across. */
export const ITEMS = {
  url: "sprites/items.png",
  size: 192,
  frames: 4,
  /** Drawn a little smaller than a tile, so the floor shows around it. */
  scale: 0.0725,
  order: [
    ItemKind.Bomb,
    ItemKind.Fire,
    ItemKind.FullFire,
    ItemKind.Speed,
    ItemKind.Kick,
    ItemKind.Remote,
    ItemKind.Pierce,
    ItemKind.Punch,
    ItemKind.Glove,
    ItemKind.Skull,
    ItemKind.Egg,
  ] satisfies ItemKind[],
};

/** Left edge of an item's column. */
export const itemCell = (kind: ItemKind): number => ITEMS.order.indexOf(kind) * ITEMS.size;

const GLINT_EVERY = 3 * TICK_RATE;
const GLINT_TICKS_PER_FRAME = 4;

/** Row an item shows: plain most of the time, with a glint every few seconds, staggered by tile. */
export function itemFrame(tick: number, x: number, y: number): number {
  const t = (tick + x * 23 + y * 41) % GLINT_EVERY;
  const f = Math.floor(t / GLINT_TICKS_PER_FRAME) + 1;
  return f < ITEMS.frames ? f : 0;
}

/** Ticks each cast frame stays on screen: the cast lasts as long as its blast. */
export const CAST_TICKS_PER_FRAME = 4;

/** Ticks into the cast when the hands thrust forward and the beam shows. */
export const BEAM_DELAY = 20;

/** Opacity of a blast's beam `ticks` after the cast began. */
export function beamAlpha(ticks: number): number {
  if (ticks < BEAM_DELAY) return 0;
  return 1 - ((ticks - BEAM_DELAY) / (BLAST_TICKS - BEAM_DELAY)) * 0.8;
}

/** Ticks before a blast in which its cast already ran (Goku's charge, Naruto's dash). */
const WINDUP: Partial<Record<Blast["kind"], number>> = { kamehameha: KAME_CHARGE, rasengan: RASENGAN_TICKS };

/**
 * Ticks into a player's cast animation: Goku's runs from the start of his Kamehameha's charge (the
 * beam leaves on the thrust frame, KAME_CHARGE in), Naruto's from the start of his Rasengan dash (it
 * strikes on the lunge frame), the bomb mascot's from when his mega bomb lands, the others' from their
 * blast; undefined when not casting.
 */
export function castTicks(
  p: Pick<Player, "charge" | "rasengan">,
  blast: Pick<Blast, "ttl" | "kind"> | undefined,
  mega?: Pick<Bomb, "fuse">,
): number | undefined {
  if (p.charge > 0) return KAME_CHARGE - p.charge;
  if (mega) return FUSE_TICKS - mega.fuse;
  if (p.rasengan > 0) return RASENGAN_TICKS - p.rasengan;
  if (!blast) return undefined;
  return (WINDUP[blast.kind] ?? 0) + BLAST_TICKS - blast.ttl;
}

/**
 * Goku's Kamehameha art (scripts/build-kamehameha.py): the ball of ki at his hands, the beam (tiles
 * seamlessly), and its head; FRAMES looping frames each, pointing right. Drawn one cell per tile.
 */
export const KAMEHAMEHA = {
  url: "sprites/kamehameha.png",
  size: 128,
  frames: 8,
  rows: { orb: 0, body: 1, head: 2 },
  scale: 0.125,
  /** The head's ball sits this far (in tiles) right of its cell's center. */
  headBall: 0.05,
};

export type KamePiece = { kind: keyof typeof KAMEHAMEHA.rows; x: number; y: number; rot: number };

/** Where the Kamehameha's pieces go for a beam from (x0,y0) to (x1,y1), `tile` pixels a tile. */
export function kameSegments(x0: number, y0: number, x1: number, y1: number, tile = 16): KamePiece[] {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const ux = len ? (x1 - x0) / len : 1;
  const uy = len ? (y1 - y0) / len : 0;
  const rot = Math.atan2(uy, ux);
  const parts: KamePiece[] = [{ kind: "orb", x: x0, y: y0, rot }];
  let t = tile / 2;
  for (; t <= len - tile / 2 + 1e-6; t += tile) parts.push({ kind: "body", x: x0 + ux * t, y: y0 + uy * t, rot });
  // a last piece flush with the head, so no gap is left before it
  if (len > tile && t - tile < len - tile / 2 - 1e-6) parts.push({ kind: "body", x: x1 - ux * (tile / 2), y: y1 - uy * (tile / 2), rot });
  const back = KAMEHAMEHA.headBall * tile;
  parts.push({ kind: "head", x: x1 - ux * back, y: y1 - uy * back, rot });
  return parts;
}

/**
 * Naruto's Rasengan art (scripts/build-rasengan.py): the spinning ball of chakra in his hand (looping)
 * and the burst where it strikes (played once).
 */
export const RASENGAN = {
  url: "sprites/rasengan.png",
  size: 128,
  frames: 8,
  rows: { orb: 0, burst: 1 },
  orbScale: 0.085,
  burstScale: 0.2,
  /** Ticks each burst frame stays on screen. */
  burstTicks: 2,
};

/**
 * What of Naruto's Rasengan shows, given his dash ticks left and his latest blast: the ball spinning
 * in his hand (a frame a tick) all through the dash, then the burst where it struck; null for nothing.
 */
export function rasenganLook(rasengan: number, blast: Pick<Blast, "ttl" | "kind"> | undefined): { orb: number } | { burst: number } | null {
  if (rasengan > 0) return { orb: (RASENGAN_TICKS - rasengan) % RASENGAN.frames };
  if (blast?.kind !== "rasengan") return null;
  const frame = Math.floor((BLAST_TICKS - blast.ttl) / RASENGAN.burstTicks);
  return frame < RASENGAN.frames ? { burst: frame } : null;
}

/** Flames without the Kamehameha's own fire along its beam (the beam is drawn over those tiles instead). */
export function outsideBeams<F extends Pick<Flame, "x" | "y" | "ownerId">>(flames: F[], blasts: readonly Blast[]): F[] {
  const beams = blasts.filter((b) => b.kind === "kamehameha");
  if (!beams.length) return flames;
  return flames.filter(
    (f) =>
      !beams.some((b) => {
        if (f.ownerId !== b.ownerId) return false;
        const [dx, dy] = DIR_VECTORS[b.dir];
        const i = dx ? (f.x - b.x) * dx : (f.y - b.y) * dy;
        return i >= 1 && i <= b.length && (dx ? f.y === b.y : f.x === b.x);
      }),
  );
}

/**
 * Where a bolt cast toward `dir` by a player standing at (cx,cy) starts: the sheet's muzzle (Thor's
 * hammer) placed like the sprite (anchor at cy + 6, mirrored when facing away from `side`), or else
 * 6 px in front of the tile's center.
 */
export function boltOrigin(sheet: SheetLayout | undefined, dir: Facing, cx: number, cy: number): [number, number] {
  const [dx, dy] = DIR_VECTORS[dir];
  if (!sheet?.muzzle) return [cx + dx * 6, cy + dy * 6];
  const view = dir === "left" || dir === "right" ? "side" : dir;
  const [mx, my] = sheet.muzzle[view];
  const flip = view === "side" && dir !== sheet.side ? -1 : 1;
  const s = sheet.scale ?? 1;
  return [cx + mx * s * flip, cy + 6 + my * s];
}

/**
 * Thor's lightning bolt from (x0,y0) to (x1,y1): a zigzag every ~6 px, at most 4 px off the
 * straight line. The same `seed` draws the same bolt; a new one every few ticks makes it crackle.
 */
export function boltPoints(x0: number, y0: number, x1: number, y1: number, seed: number): [number, number][] {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(2, Math.round(len / 6));
  const nx = len ? -(y1 - y0) / len : 0;
  const ny = len ? (x1 - x0) / len : 0;
  const pts: [number, number][] = [[x0, y0]];
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const r = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
    const off = ((r - Math.floor(r)) * 2 - 1) * 4;
    pts.push([x0 + (x1 - x0) * t + nx * off, y0 + (y1 - y0) * t + ny * off]);
  }
  pts.push([x1, y1]);
  return pts;
}

/**
 * The spiral of light round the captain while his shield is up (PixelLab VFX "Captain shield spiral",
 * laid out by scripts/build-captain-spiral.py): one row drawn behind him, one in front. The anchor is
 * the point between his feet, like the character sheets', and it is drawn at the captain's scale.
 */
export const SPIRAL = {
  url: "sprites/captain-spiral.png",
  width: 1608,
  height: 336,
  frameW: 134,
  frameH: 168,
  anchorX: 80,
  anchorY: 138,
  frames: 12,
  fps: 12,
  ticksPerFrame: 5,
  rows: { behind: 0, front: 1 },
} as const;

/** The spiral's frame `ticks` after the shield went up (it loops). */
export function spiralFrame(ticks: number): number {
  return Math.floor(ticks / SPIRAL.ticksPerFrame) % SPIRAL.frames;
}

/**
 * How a frozen player looks: tinted icy inside a block of ice, which flickers
 * in its last second as it melts. Null when not frozen.
 */
export function frozenLook(frozen: number, tick: number): { tint: number; block: boolean } | null {
  if (frozen <= 0) return null;
  const melting = frozen <= TICK_RATE;
  return { tint: 0x9fdcff, block: !melting || Math.floor(tick / 4) % 2 === 0 };
}

/** Where players' feet stand, below the tile center. */
export const FEET_DY = 6;

/** The ice block around a frozen player whose drawn body is `bodyH` tall: just over the head to just under the feet. */
export function iceBlock(cx: number, cy: number, bodyH: number): { x: number; y: number; w: number; h: number } {
  const w = 14;
  const top = cy + FEET_DY - bodyH - 2;
  return { x: cx - w / 2, y: top, w, h: bodyH + 4 };
}

export interface FrameRect {
  x: number;
  y: number;
  flip: boolean;
}

/** The sheet cell to draw for a player this tick. */
export function playerFrame(
  sheet: SheetLayout,
  {
    facing,
    moving,
    carrying,
    stunned,
    casting,
    shielding,
    tick,
  }: { facing: Facing; moving: boolean; carrying: boolean; stunned?: boolean; casting?: number | undefined; shielding?: number | undefined; tick: number },
): FrameRect {
  if (stunned && sheet.stun) return cell(sheet, sheet.stun, Math.floor(tick / sheet.ticksPerFrame) % sheet.stun.frames);
  const view = facing === "left" || facing === "right" ? "side" : facing;
  const flip = view === "side" && facing !== sheet.side;
  if (sheet.cast && shielding !== undefined) {
    const strip = sheet.cast[view];
    return { ...cell(sheet, strip, Math.min(Math.floor(shielding / CAST_TICKS_PER_FRAME), strip.frames - 1)), flip };
  }
  const castCol = casting === undefined ? -1 : Math.floor(casting / CAST_TICKS_PER_FRAME);
  if (sheet.cast && castCol >= 0 && castCol < sheet.cast[view].frames) return { ...cell(sheet, sheet.cast[view], castCol), flip };
  const set = carrying && sheet.carryIdle ? (moving ? sheet.carryWalk! : sheet.carryIdle) : moving ? sheet.walk : sheet.idle;
  const strip = set[view];
  const per = !moving && sheet.idleTicksPerFrame ? sheet.idleTicksPerFrame : sheet.ticksPerFrame;
  const col = Math.floor(tick / per) % strip.frames;
  return { x: col * sheet.frameW, y: strip.row * sheet.frameH, flip };
}

const cell = (sheet: SheetLayout, strip: Strip, col: number): FrameRect => ({
  x: col * sheet.frameW,
  y: strip.row * sheet.frameH,
  flip: false,
});

/** The death frame `ticks` after dying, or null once it has played (or the sheet has none). */
export function deathFrame(sheet: SheetLayout, ticks: number): FrameRect | null {
  const strip = sheet.death;
  if (!strip) return null;
  const col = Math.floor(ticks / sheet.ticksPerFrame);
  return col < strip.frames ? cell(sheet, strip, col) : null;
}

/** Repaints a sheet's clothes (by palette or by hue) in a player's color, in place. */
export function paintSheet(px: Uint8ClampedArray, sheet: SheetLayout, to: Rgb): void {
  if (sheet.keepFor?.some((c) => c.every((v, i) => v === to[i]))) return;
  if (sheet.clothes) recolor(px, sheet.clothes, to);
  if (sheet.hues && sheet.hueBase) shadeHues(px, sheet.hues, sheet.hueBase, to);
  else if (sheet.hues) paintHues(px, sheet.hues, to);
}

const luma = ([r, g, b]: Rgb) => 0.299 * r + 0.587 * g + 0.114 * b;

/**
 * Repaints pixels of the `from` colors in `to`, in place. The first color maps to
 * `to` exactly; the others keep their brightness relative to it (shading survives).
 */
export function recolor(px: Uint8ClampedArray, from: readonly Rgb[], to: Rgb): void {
  const base = luma(from[0]!);
  const shades = from.map((c) => ({ c, k: luma(c) / base }));
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    const hit = shades.find(({ c }) => c[0] === px[i] && c[1] === px[i + 1] && c[2] === px[i + 2]);
    if (!hit) continue;
    for (let ch = 0; ch < 3; ch++) px[i + ch] = to[ch]! * hit.k;
  }
}

/**
 * Repaints pixels whose hue lies in `range` (degrees) in `to`, by brightness relative to
 * `base`: the base shade becomes `to` exactly, darker shades darker, lighter ones toward white.
 * For smooth (anti-aliased, gradient) art, where exact palette matching can't work.
 */
export function shadeHues(px: Uint8ClampedArray, range: readonly [number, number], base: Rgb, to: Rgb): void {
  const ref = luma(base);
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    const c: Rgb = [px[i]!, px[i + 1]!, px[i + 2]!];
    const [h, s] = toHsl(c);
    if (s < 0.2 || h < range[0] || h > range[1]) continue;
    const k = luma(c) / ref;
    for (let ch = 0; ch < 3; ch++) {
      const v = to[ch]!;
      px[i + ch] = k <= 1 ? v * k : v + (255 - v) * Math.min(1, (k - 1) * 0.8);
    }
  }
}

/**
 * Tells, frame by frame, whether each player is walking. A player counts as
 * walking for `hold` frames after its drawn position last changed, so frames
 * between two snapshots don't flash the idle pose.
 */
export class MotionTracker {
  private readonly seen = new Map<string, { x: number; y: number; left: number }>();

  constructor(private readonly hold = 8) {}

  moving(id: string, x: number, y: number): boolean {
    const last = this.seen.get(id);
    if (!last) {
      this.seen.set(id, { x, y, left: 0 });
      return false;
    }
    if (last.x !== x || last.y !== y) {
      Object.assign(last, { x, y, left: this.hold });
      return true;
    }
    if (last.left === 0) return false;
    last.left--;
    return true;
  }
}

function toHsl([r, g, b]: Rgb): [number, number, number] {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === rr ? ((gg - bb) / d + 6) % 6 : max === gg ? (bb - rr) / d + 2 : (rr - gg) / d + 4;
  return [h * 60, s, l];
}

function fromHsl(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/**
 * Repaints pixels whose hue lies in `range` (degrees) in the hue and saturation of
 * `to`, in place, shifting lightness toward it so shading survives.
 */
export function paintHues(px: Uint8ClampedArray, range: readonly [number, number], to: Rgb): void {
  const [th, ts, tl] = toHsl(to);
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    const [h, s, l] = toHsl([px[i]!, px[i + 1]!, px[i + 2]!]);
    if (s < 0.2 || h < range[0] || h > range[1]) continue;
    const lit = Math.min(1, Math.max(0, l + (tl - 0.5) * 0.6));
    const [r, g, b] = fromHsl(th, s * ts, lit);
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
  }
}

interface Pos {
  px: number;
  py: number;
}

/**
 * Where to draw a player `alpha` of the way from one snapshot to the next. Past 1
 * (the next snapshot is late) a walk carries on; a jump of a tile or more between
 * snapshots is a teleport and stays where it landed.
 */
export function between(from: Pos, to: Pos, alpha: number): Pos {
  const jumped = Math.abs(to.px - from.px) + Math.abs(to.py - from.py) >= TILE;
  const a = alpha > 1 && jumped ? 1 : alpha;
  return { px: from.px + (to.px - from.px) * a, py: from.py + (to.py - from.py) * a };
}
