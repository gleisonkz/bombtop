import type { TouchInput } from "../input/touch";
import type { Renderer } from "../render/renderer";

/** Something the main loop can run: the local hot-seat game or an online match. */
export interface GameMode {
  /** Advance and draw one display frame. */
  frame(deltaMs: number, nowMs: number): void;
  /** Returns true when the key was used (caller prevents default). */
  keyDown(code: string): boolean;
  keyUp(code: string): void;
  /** Window lost focus: release every held key. */
  blur(): void;
  dispose(): void;
}

export interface ModeContext {
  renderer: Renderer;
  /** On-screen controls (idle on non-touch devices). */
  touch: TouchInput;
  /** Resizes the canvas to fit an arena of the given size in tiles. */
  fit(width: number, height: number): void;
  /** Return to the main menu, optionally showing a message. */
  exit(message?: string): void;
}
