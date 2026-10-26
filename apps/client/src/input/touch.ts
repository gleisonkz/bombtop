import type { Direction, PlayerInput } from "@bombtop/shared";

/** Maps a drag vector (pixels) to a direction using its dominant axis. */
export function dirFromVector(dx: number, dy: number, deadZone: number): Direction {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < deadZone) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

/** Ring radius (px): past it, the stick center is dragged along behind the finger. */
export const STICK_RADIUS = 40;
/** Minor/major axis ratio from which a push counts as diagonal (~22°). */
const DIAGONAL = 0.4;

type Steer = { dir: Direction; alt: Direction };

/**
 * Direction pair for a stick vector. A diagonal reached from a straight push
 * turns toward the new axis and keeps the old one as fallback (`alt`), so the
 * player keeps walking until the turn opens up; while the finger stays in the
 * diagonal the choice sticks instead of flickering.
 */
function steerFromVector(dx: number, dy: number, deadZone: number, prev: Steer): Steer {
  const major = dirFromVector(dx, dy, deadZone);
  if (!major) return { dir: null, alt: null };
  const horizontal = major === "left" || major === "right";
  const minorLen = Math.abs(horizontal ? dy : dx);
  const majorLen = Math.abs(horizontal ? dx : dy);
  if (minorLen < DIAGONAL * majorLen) return { dir: major, alt: null };

  const minor: Direction = horizontal ? (dy > 0 ? "down" : "up") : dx > 0 ? "right" : "left";
  const pair: Direction[] = [major, minor];
  if (pair.includes(prev.dir) && pair.includes(prev.alt)) return prev;
  if (prev.dir === major) return { dir: minor, alt: major };
  if (prev.dir === minor) return { dir: major, alt: minor };
  return { dir: major, alt: minor };
}

/** Virtual joystick (follows one finger from where it touched down) plus two tap buttons. */
export class TouchInput {
  private stick: ({ id: number; ox: number; oy: number; fixed?: true } & Steer) | null = null;
  private pending: { bomb: boolean; action: boolean; special?: true } = { bomb: false, action: false };
  private bombDown = false;
  private braceDown = false;
  private stopDown = false;

  constructor(private readonly deadZone = 12) {}

  /** Current stick center (it trails the finger), for drawing the ring. */
  get origin(): { x: number; y: number } | null {
    return this.stick ? { x: this.stick.ox, y: this.stick.oy } : null;
  }

  /** Direction being steered right now (for lighting the d-pad arrow). */
  get direction(): Direction {
    return this.stick?.dir ?? null;
  }

  stickStart(id: number, x: number, y: number): void {
    this.stick = { id, ox: x, oy: y, dir: null, alt: null };
  }

  /** A finger on the d-pad centered at (cx, cy): it steers from that fixed center (see stickMove/stickEnd). */
  padStart(id: number, cx: number, cy: number, x: number, y: number): void {
    this.stick = { id, ox: cx, oy: cy, fixed: true, dir: null, alt: null };
    this.stickMove(id, x, y);
  }

  stickMove(id: number, x: number, y: number): void {
    const st = this.stick;
    if (st?.id !== id) return;
    const dist = Math.hypot(x - st.ox, y - st.oy);
    if (!st.fixed && dist > STICK_RADIUS) {
      const k = STICK_RADIUS / dist;
      st.ox = x - (x - st.ox) * k;
      st.oy = y - (y - st.oy) * k;
    }
    Object.assign(st, steerFromVector(x - st.ox, y - st.oy, this.deadZone, st));
  }

  stickEnd(id: number): void {
    if (this.stick?.id === id) this.stick = null;
  }

  press(button: "bomb" | "action" | "special" | "brace" | "stop"): void {
    if (button === "brace") {
      this.braceDown = true;
      return;
    }
    if (button === "stop") {
      this.stopDown = true;
      return;
    }
    this.pending[button] = true;
    if (button === "bomb") this.bombDown = true;
  }

  /** A finger lifted off a button (only the bomb button cares: it lets go of a carried bomb). */
  release(button: "bomb" | "action" | "special" | "brace" | "stop"): void {
    if (button === "brace") this.braceDown = false;
    if (button === "stop") this.stopDown = false;
    if (button === "bomb") this.bombDown = false;
  }

  sample(): PlayerInput {
    const input: PlayerInput = { dir: this.stick?.dir ?? null, ...this.pending };
    if (this.stick?.alt) input.alt = this.stick.alt;
    if (this.bombDown) input.hold = true;
    if (this.braceDown) input.brace = true;
    if (this.stopDown) input.stopKick = true;
    this.pending = { bomb: false, action: false };
    return input;
  }

  reset(): void {
    this.stick = null;
    this.bombDown = false;
    this.braceDown = false;
    this.stopDown = false;
    this.pending = { bomb: false, action: false };
  }
}
