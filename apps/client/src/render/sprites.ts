import { TICK_RATE, type BombType, type Facing } from "@bombtop/shared";
import type { Mood } from "../ui/art";

type Rgb = readonly [number, number, number];

/** One animation: a row of the sheet and how many frames it has. */
interface Strip {
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
  /** Ticks each walk frame stays on screen. */
  ticksPerFrame: number;
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
  /** Hit reaction, shown facing the camera while stunned. */
  stun?: Strip;
  /** Played once when the player dies. */
  death?: Strip;
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
  ninja: {
    url: "sprites/ninja.png",
    width: 448,
    height: 512,
    frameW: 64,
    frameH: 64,
    anchorX: 31,
    anchorY: 51,
    bodyH: 38,
    ticksPerFrame: 7,
    side: "right",
    idle: strips(0, 1, 2, 1),
    walk: strips(3, 4, 5, 6),
    stun: { row: 6, frames: 6 },
    death: { row: 7, frames: 7 },
    hues: [185, 250],
    scale: 0.55,
  },
} satisfies Record<string, SheetLayout>;

export type SheetName = keyof typeof SHEETS;

/** Bomb art: one square cell per bomb type, side by side. */
export const BOMBS = {
  url: "sprites/bombs.png",
  width: 96,
  size: 32,
  /** Cell pixel at the center of the bomb's body. */
  anchorX: 16,
  anchorY: 19,
  scale: 0.55,
  order: ["normal", "pierce", "remote"] satisfies BombType[],
  /** Cell pixel of the fuse spark (or the remote's light) and its glow color. */
  glow: {
    normal: { x: 25, y: 3, color: 0xffd23f },
    pierce: { x: 16, y: 5, color: 0xffd23f },
    remote: { x: 15.5, y: 2.5, color: 0xff3b3b },
  } satisfies Record<BombType, { x: number; y: number; color: number }>,
};

/** Left edge of a bomb type's cell. */
export const bombFrame = (type: BombType): number => BOMBS.order.indexOf(type) * BOMBS.size;

const SPARK = [1, 1, 0, 1, 0, 1, 1, 1, 0]; // irregular, like a burning fuse

/**
 * How a bomb looks this tick: it breathes (squash and stretch), faster and
 * flashing red in its last second, while its spark (or remote light) flickers.
 * Timed by the match clock, so a remote bomb on hold still breathes.
 */
export function bombLook({ fuse, tick, type }: { fuse: number; tick: number; type: BombType }) {
  const urgent = fuse <= TICK_RATE;
  const breath = Math.sin((tick / TICK_RATE) * Math.PI * 2 * (urgent ? 5 : 2)) * 0.1;
  return {
    sx: 1 + breath,
    sy: 1 - breath,
    tint: urgent && Math.floor(tick / 4) % 2 === 0 ? 0xff7070 : 0xffffff,
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

/**
 * How the mascot stands this tick: it breathes while idle, hops and waddles
 * while walking, wobbles wide-eyed while stunned, and turns to face left/right.
 */
export function mascotPose({ moving, stunned, facing, tick }: { moving: boolean; stunned: boolean; facing: Facing; tick: number }) {
  const t = (tick / TICK_RATE) * Math.PI * 2;
  const flip = facing === "left";
  if (stunned) return { sx: 1, sy: 1, dy: 0, rot: Math.sin(t * 4) * 0.3, flip, mood: "wow" as Mood };
  if (moving) return { sx: 1, sy: 1, dy: -Math.abs(Math.sin(t * 2)) * 2.5, rot: Math.sin(t * 2) * 0.15, flip, mood: "happy" as Mood };
  const breath = Math.sin(t * 1.5) * 0.04;
  return { sx: 1 + breath, sy: 1 - breath, dy: 0, rot: 0, flip, mood: "happy" as Mood };
}

/** The mascot `ticks` after dying: it floats up, squashed and fading; null once gone. */
export function mascotDeath(ticks: number) {
  if (ticks >= MASCOT.deathTicks) return null;
  const k = ticks / MASCOT.deathTicks;
  return { alpha: 1 - k * k, sx: 1 + k * 0.3, sy: 1 - k * 0.3, dy: -k * 10, mood: "sad" as Mood };
}

export interface FrameRect {
  x: number;
  y: number;
  flip: boolean;
}

/** The sheet cell to draw for a player this tick. */
export function playerFrame(
  sheet: SheetLayout,
  { facing, moving, carrying, stunned, tick }: { facing: Facing; moving: boolean; carrying: boolean; stunned?: boolean; tick: number },
): FrameRect {
  if (stunned && sheet.stun) return cell(sheet, sheet.stun, Math.floor(tick / sheet.ticksPerFrame) % sheet.stun.frames);
  const view = facing === "left" || facing === "right" ? "side" : facing;
  const set = carrying && sheet.carryIdle ? (moving ? sheet.carryWalk! : sheet.carryIdle) : moving ? sheet.walk : sheet.idle;
  const strip = set[view];
  const col = Math.floor(tick / sheet.ticksPerFrame) % strip.frames;
  return { x: col * sheet.frameW, y: strip.row * sheet.frameH, flip: view === "side" && facing !== sheet.side };
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
