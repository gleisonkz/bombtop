import type { Direction, PlayerInput } from "@bombtop/shared";

export interface KeyBindings {
  up: string;
  down: string;
  left: string;
  right: string;
  bomb: string;
  action: string;
}

/**
 * Bindings use KeyboardEvent.code, so they follow physical key positions.
 * Buttons avoid letter keys: some browser extensions swallow them.
 */
export const WASD: KeyBindings = {
  up: "KeyW",
  down: "KeyS",
  left: "KeyA",
  right: "KeyD",
  bomb: "Space",
  action: "ShiftLeft",
};
export const ARROWS: KeyBindings = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  bomb: "Enter",
  action: "ShiftRight",
};

type Dir = Exclude<Direction, null>;
type Button = "bomb" | "action";
const DIRS: Dir[] = ["up", "down", "left", "right"];
const BUTTONS: Button[] = ["bomb", "action"];

/** A button that reports one press per physical press, even if released before sampling. */
class EdgeButton {
  private held = false;
  private pending = false;

  down(): void {
    if (!this.held) this.pending = true;
    this.held = true;
  }

  up(): void {
    this.held = false;
  }

  take(): boolean {
    const pressed = this.pending;
    this.pending = false;
    return pressed;
  }

  reset(): void {
    this.held = this.pending = false;
  }
}

/**
 * Turns key events into one PlayerInput per tick.
 * Direction: most recently pressed held key wins. Buttons: once per press.
 */
export class KeyboardInput {
  private held: Dir[] = [];
  private readonly buttons: Record<Button, EdgeButton> = { bomb: new EdgeButton(), action: new EdgeButton() };

  constructor(private readonly bindings: KeyBindings) {}

  /** Returns true when the key is bound (caller may preventDefault). */
  keyDown(code: string): boolean {
    const button = this.buttonFor(code);
    if (button) {
      this.buttons[button].down();
      return true;
    }
    const dir = this.dirFor(code);
    if (!dir) return false;
    if (!this.held.includes(dir)) this.held.push(dir);
    return true;
  }

  keyUp(code: string): boolean {
    const button = this.buttonFor(code);
    if (button) {
      this.buttons[button].up();
      return true;
    }
    const dir = this.dirFor(code);
    if (!dir) return false;
    this.held = this.held.filter((d) => d !== dir);
    return true;
  }

  sample(): PlayerInput {
    const dir = this.held.at(-1) ?? null;
    const input: PlayerInput = { dir, bomb: this.buttons.bomb.take(), action: this.buttons.action.take() };
    // Two perpendicular keys: walk along the earlier one until the newer one opens up.
    const horizontal = (d: Dir) => d === "left" || d === "right";
    const alt = this.held.findLast((d) => dir && horizontal(d) !== horizontal(dir));
    if (alt) input.alt = alt;
    return input;
  }

  reset(): void {
    this.held = [];
    for (const b of BUTTONS) this.buttons[b].reset();
  }

  private dirFor(code: string): Dir | undefined {
    return DIRS.find((d) => this.bindings[d] === code);
  }

  private buttonFor(code: string): Button | undefined {
    return BUTTONS.find((b) => this.bindings[b] === code);
  }
}

/** Combines several input sources: first held direction wins, buttons are OR-ed. */
export function mergeInputs(inputs: PlayerInput[]): PlayerInput {
  const steering = inputs.find((i) => i.dir);
  const merged: PlayerInput = {
    dir: steering?.dir ?? null,
    bomb: inputs.some((i) => i.bomb),
    action: inputs.some((i) => i.action),
  };
  if (steering?.alt) merged.alt = steering.alt;
  return merged;
}
