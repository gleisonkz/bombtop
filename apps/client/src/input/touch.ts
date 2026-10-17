import type { Direction, PlayerInput } from "@bombtopia/shared";

/** Maps a drag vector (pixels) to a direction using its dominant axis. */
export function dirFromVector(dx: number, dy: number, deadZone: number): Direction {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < deadZone) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

/** Virtual joystick (follows one finger from where it touched down) plus two tap buttons. */
export class TouchInput {
  private stick: { id: number; ox: number; oy: number; dir: Direction } | null = null;
  private pending = { bomb: false, action: false };

  constructor(private readonly deadZone = 12) {}

  stickStart(id: number, x: number, y: number): void {
    this.stick = { id, ox: x, oy: y, dir: null };
  }

  stickMove(id: number, x: number, y: number): void {
    if (this.stick?.id !== id) return;
    this.stick.dir = dirFromVector(x - this.stick.ox, y - this.stick.oy, this.deadZone);
  }

  stickEnd(id: number): void {
    if (this.stick?.id === id) this.stick = null;
  }

  press(button: "bomb" | "action"): void {
    this.pending[button] = true;
  }

  sample(): PlayerInput {
    const input = { dir: this.stick?.dir ?? null, ...this.pending };
    this.pending = { bomb: false, action: false };
    return input;
  }

  reset(): void {
    this.stick = null;
    this.pending = { bomb: false, action: false };
  }
}
