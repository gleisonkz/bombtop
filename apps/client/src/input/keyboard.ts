import type { Direction, PlayerInput } from "@bombtopia/shared";

export interface KeyBindings {
  up: string;
  down: string;
  left: string;
  right: string;
  bomb: string;
}

/** Bindings use KeyboardEvent.code, so they follow physical key positions. */
export const WASD: KeyBindings = { up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD", bomb: "Space" };
export const ARROWS: KeyBindings = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  bomb: "Enter",
};

type Dir = Exclude<Direction, null>;
const DIRS: Dir[] = ["up", "down", "left", "right"];

/**
 * Turns key events into one PlayerInput per tick.
 * Direction: most recently pressed held key wins. Bomb: once per press.
 */
export class KeyboardInput {
  private held: Dir[] = [];
  private bombHeld = false;
  private bombPending = false;

  constructor(private readonly bindings: KeyBindings) {}

  /** Returns true when the key is bound (caller may preventDefault). */
  keyDown(code: string): boolean {
    if (code === this.bindings.bomb) {
      if (!this.bombHeld) this.bombPending = true;
      this.bombHeld = true;
      return true;
    }
    const dir = this.dirFor(code);
    if (!dir) return false;
    if (!this.held.includes(dir)) this.held.push(dir);
    return true;
  }

  keyUp(code: string): boolean {
    if (code === this.bindings.bomb) {
      this.bombHeld = false;
      return true;
    }
    const dir = this.dirFor(code);
    if (!dir) return false;
    this.held = this.held.filter((d) => d !== dir);
    return true;
  }

  sample(): PlayerInput {
    const bomb = this.bombPending;
    this.bombPending = false;
    return { dir: this.held.at(-1) ?? null, bomb };
  }

  reset(): void {
    this.held = [];
    this.bombHeld = false;
    this.bombPending = false;
  }

  private dirFor(code: string): Dir | undefined {
    return DIRS.find((d) => this.bindings[d] === code);
  }
}
