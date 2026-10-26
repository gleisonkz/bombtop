import type { CharacterId } from "@bombtop/shared";
import type { Sound } from "../audio/sound";
import type { TouchInput } from "../input/touch";
import type { Renderer } from "../render/renderer";

/** Something the main loop can run: an online match. */
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
  sound: Sound;
  /** On-screen controls (idle on non-touch devices). */
  touch: TouchInput;
  /** Ticks our own special still recharges (0 = ready) and whose it is (none: watching), for the touch button and the side HUD. */
  specialCooldown?(ticks: number, character?: CharacterId): void;
  /**
   * Resizes the canvas to fit an arena of the given size in tiles, or only the window of it
   * that starts at tile (x, y) (0, 0 = the whole arena).
   */
  fit(width: number, height: number, x?: number, y?: number): void;
  /** Return to the main menu, optionally showing a message. */
  exit(message?: string): void;
}
