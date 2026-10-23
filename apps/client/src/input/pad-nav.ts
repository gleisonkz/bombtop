import type { Direction } from "@bombtop/shared";
import { direction, gamepadAt, type PadState } from "./gamepad";

/** What a controller asks of a menu screen. */
export type NavCommand = Exclude<Direction, null> | "confirm" | "back";

const CONFIRM = 0; // A / Cross
const BACK = 1; // B / Circle
/** A held direction repeats after this long, then every REPEAT_EVERY ms. */
const REPEAT_AFTER = 400;
const REPEAT_EVERY = 150;
/** After A or B, either one is dropped this long: no double join, and a cheap pad's contacts may bounce. */
const PRESS_COOLDOWN = 300;

/** Reads a controller for the menus: d-pad or stick to move (repeating while held), A to confirm, B to go back. */
export class PadNav {
  private dir: Direction = null;
  private nextAt = 0;
  /** When A or B count again. */
  private calmAt = 0;
  private held = new Set<number>();

  constructor(private readonly read: () => PadState | null = gamepadAt(0)) {}

  /** Takes whatever is down now as already handled (the press that brought the screen up is not a new one). */
  reset(): void {
    const pad = this.read();
    this.held = new Set(pad ? pressedButtons(pad) : []);
    this.dir = pad ? direction(pad) : null;
    this.nextAt = Infinity;
  }

  /** One poll at `now` (ms): the command it brings, if any. */
  sample(now: number): NavCommand | null {
    const pad = this.read();
    if (!pad) {
      this.held.clear();
      this.dir = null;
      return null;
    }
    const was = this.held;
    this.held = new Set(pressedButtons(pad));
    const pressed = (b: number) => this.held.has(b) && !was.has(b);
    const dir = direction(pad);
    const turned = dir !== this.dir;
    this.dir = dir;
    const press = pressed(CONFIRM) ? "confirm" : pressed(BACK) ? "back" : null;
    if (press && now >= this.calmAt) {
      this.calmAt = now + PRESS_COOLDOWN;
      return press;
    }
    if (!dir) return null;
    if (turned) {
      this.nextAt = now + REPEAT_AFTER;
      return dir;
    }
    if (now < this.nextAt) return null;
    this.nextAt = now + REPEAT_EVERY;
    return dir;
  }
}

function pressedButtons(pad: PadState): number[] {
  return pad.buttons.flatMap((b, i) => (b?.pressed ? [i] : []));
}
