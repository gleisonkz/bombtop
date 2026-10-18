import type { Facing } from "@bombtop/shared";

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
  clothes: Rgb[];
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
} satisfies Record<string, SheetLayout>;

export type SheetName = keyof typeof SHEETS;

export interface FrameRect {
  x: number;
  y: number;
  flip: boolean;
}

/** The sheet cell to draw for a player this tick. */
export function playerFrame(
  sheet: SheetLayout,
  { facing, moving, carrying, tick }: { facing: Facing; moving: boolean; carrying: boolean; tick: number },
): FrameRect {
  const view = facing === "left" || facing === "right" ? "side" : facing;
  const set = carrying && sheet.carryIdle ? (moving ? sheet.carryWalk! : sheet.carryIdle) : moving ? sheet.walk : sheet.idle;
  const strip = set[view];
  const col = Math.floor(tick / sheet.ticksPerFrame) % strip.frames;
  return { x: col * sheet.frameW, y: strip.row * sheet.frameH, flip: view === "side" && facing !== sheet.side };
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
