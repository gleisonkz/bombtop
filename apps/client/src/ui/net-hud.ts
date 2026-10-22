import { debugOn } from "./dev-tools";
import { el, storage } from "./dom";

/** A second's worth of what the connection looked like on this screen. */
export class NetStats {
  ping: number | null = null;
  private elapsed = 0;
  private frames = 0;
  private late = 0;
  private delay = 0;
  private shown = { fps: 0, late: 0 };
  private lastArrival: number | null = null;
  private worstGap = 0;
  /** Since the last report: the longest frame (the device itself froze) and every frame drawn late. */
  private slowest = 0;
  private missed = 0;
  /** Since the last report: the most CPU time our own code spent on one frame. */
  private worstWork = 0;
  /** Since the last report: the biggest jump between two frames, in tiles, of our player and of the others. */
  private jumpMe = 0;
  private jumpOthers = 0;

  /** A snapshot arrived. */
  arrival(nowMs: number): void {
    if (this.lastArrival !== null) this.worstGap = Math.max(this.worstGap, nowMs - this.lastArrival);
    this.lastArrival = nowMs;
  }

  /** What goes to the server's log; starts the worst-gap window over. */
  report(ua: string): { ping?: number; delay: number; fps: number; late: number; gap: number; slow: number; missed: number; work: number; jumpMe: number; jumpOthers: number; ua: string } {
    const out = {
      ...(this.ping === null ? {} : { ping: this.ping }),
      delay: Math.round(this.delay),
      fps: this.shown.fps,
      late: this.shown.late,
      gap: Math.round(this.worstGap),
      slow: Math.round(this.slowest),
      missed: this.missed,
      work: Math.round(this.worstWork * 10),
      jumpMe: Math.round(this.jumpMe * 100),
      jumpOthers: Math.round(this.jumpOthers * 100),
      ua,
    };
    this.worstGap = this.slowest = this.missed = this.worstWork = this.jumpMe = this.jumpOthers = 0;
    return out;
  }

  /** One drawn frame: `late` when it was drawn past the newest snapshot. */
  frame(deltaMs: number, late: boolean, delayMs: number): void {
    this.frames++;
    if (late) this.late++;
    if (late) this.missed++;
    this.slowest = Math.max(this.slowest, deltaMs);
    this.delay = delayMs;
    this.elapsed += deltaMs;
    if (this.elapsed >= 1000 - 1e-6) {
      this.shown = { fps: this.frames, late: this.late };
      this.elapsed = this.frames = this.late = 0;
    }
  }

  /** CPU time our own code spent on a frame (ms): a slow frame with little work is the browser or device. */
  work(ms: number): void {
    this.worstWork = Math.max(this.worstWork, ms);
  }

  /** How far (in tiles) our player and the furthest-moving other player went since the last frame. */
  jumps(me: number, others: number): void {
    this.jumpMe = Math.max(this.jumpMe, me);
    this.jumpOthers = Math.max(this.jumpOthers, others);
  }

  summary(): string {
    const ping = this.ping === null ? "–" : Math.round(this.ping);
    return `ping ${ping} ms · atraso ${Math.round(this.delay)} ms · ${this.shown.fps} fps · ${this.shown.late} quadros sem snapshot`;
  }
}

/** Connection readout in a corner, for testing on phones: open the game with ?debug. */
export class NetHud {
  private readonly box = el("div", { class: "net-hud" });

  constructor(readonly stats = new NetStats()) {
    document.body.appendChild(this.box);
  }

  show(): void {
    this.box.textContent = this.stats.summary();
  }

  dispose(): void {
    this.box.remove();
  }
}

export const debugNet = (): boolean => debugOn(location.search, storage);
