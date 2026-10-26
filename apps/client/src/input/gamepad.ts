import type { Direction, PlayerInput } from "@bombtop/shared";

/** The subset of the Gamepad API we read (standard mapping). */
export interface PadState {
  buttons: readonly { pressed: boolean }[];
  axes: readonly number[];
}

const DEAD_ZONE = 0.5;
const DPAD: [number, Exclude<Direction, null>][] = [
  [12, "up"],
  [13, "down"],
  [14, "left"],
  [15, "right"],
];
const BOMB_BUTTONS = [0]; // A / Cross
const ACTION_BUTTONS = [1, 2]; // B / Circle, X / Square
const SPECIAL_BUTTONS = [3]; // Y / Triangle
const BRACE_BUTTONS = [4];
const STOP_BUTTONS = [5];

/** The n-th connected gamepad from the browser, if any. */
export function gamepadAt(n: number): () => PadState | null {
  return () => {
    if (typeof navigator === "undefined" || !navigator.getGamepads) return null;
    return navigator.getGamepads().filter((p) => p?.connected)[n] ?? null;
  };
}

/** Polls a gamepad once per tick: d-pad or left stick to move, A = bomb, B/X = action, Y = special. */
export class GamepadInput {
  private bombHeld = false;
  private actionHeld = false;
  private specialHeld = false;

  constructor(private readonly read: () => PadState | null = gamepadAt(0)) {}

  sample(): PlayerInput {
    const pad = this.read();
    if (!pad) {
      this.bombHeld = this.actionHeld = this.specialHeld = false;
      return { dir: null, bomb: false, action: false };
    }
    const down = (ids: number[]) => ids.some((i) => pad.buttons[i]?.pressed);

    const bombNow = down(BOMB_BUTTONS);
    const actionNow = down(ACTION_BUTTONS);
    const specialNow = down(SPECIAL_BUTTONS);
    const input: PlayerInput = { dir: direction(pad), bomb: bombNow && !this.bombHeld, action: actionNow && !this.actionHeld };
    if (specialNow && !this.specialHeld) input.special = true;
    if (bombNow) input.hold = true;
    if (down(BRACE_BUTTONS)) input.brace = true;
    if (down(STOP_BUTTONS)) input.stopKick = true;
    this.bombHeld = bombNow;
    this.actionHeld = actionNow;
    this.specialHeld = specialNow;
    return input;
  }
}

/** The d-pad, or the left stick past a dead zone (its dominant axis). */
export function direction(pad: PadState): Direction {
  const dpad = DPAD.find(([i]) => pad.buttons[i]?.pressed);
  if (dpad) return dpad[1];
  const [x = 0, y = 0] = pad.axes;
  if (Math.max(Math.abs(x), Math.abs(y)) < DEAD_ZONE) return null;
  if (Math.abs(x) >= Math.abs(y)) return x > 0 ? "right" : "left";
  return y > 0 ? "down" : "up";
}
