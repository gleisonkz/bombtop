import { el } from "./dom";

/** A second's worth of what the connection looked like on this screen. */
export class NetStats {
  ping: number | null = null;
  private elapsed = 0;
  private frames = 0;
  private late = 0;
  private delay = 0;
  private shown = { fps: 0, late: 0 };

  /** One drawn frame: `late` when it was drawn past the newest snapshot. */
  frame(deltaMs: number, late: boolean, delayMs: number): void {
    this.frames++;
    if (late) this.late++;
    this.delay = delayMs;
    this.elapsed += deltaMs;
    if (this.elapsed >= 1000 - 1e-6) {
      this.shown = { fps: this.frames, late: this.late };
      this.elapsed = this.frames = this.late = 0;
    }
  }

  summary(): string {
    const ping = this.ping === null ? "–" : Math.round(this.ping);
    return `ping ${ping} ms · atraso ${Math.round(this.delay)} ms · ${this.shown.fps} fps · ${this.shown.late} quadros sem snapshot`;
  }
}

/** Connection readout in a corner, for testing on phones: open the game with ?debug. */
export class NetHud {
  readonly stats = new NetStats();
  private readonly box = el("div", { class: "net-hud" });

  constructor() {
    document.body.appendChild(this.box);
  }

  show(): void {
    this.box.textContent = this.stats.summary();
  }

  dispose(): void {
    this.box.remove();
  }
}

export const debugNet = (): boolean => new URLSearchParams(location.search).has("debug");
