const MIN_MS = 40;
const MAX_MS = 150;
const START_MS = 100;
/** Weight of each new arrival in the running averages. */
const SMOOTH = 0.05;
/** Room kept for late snapshots: this many average deviations, plus a little. */
const JITTER_ROOM = 4;
const MARGIN_MS = 8;
/** Largest change per snapshot: grows fast when the network worsens, shrinks slowly. */
const STEP_UP_MS = 10;
const STEP_DOWN_MS = 1;

/**
 * How far in the past to render server snapshots: as little as the connection
 * allows. Tracks the average gap between arrivals and how much it varies, and
 * keeps just enough delay that a late snapshot rarely leaves nothing to show.
 */
export class AdaptiveDelay {
  private last: number | null = null;
  private gap = 0;
  private jitter = 0;
  private samples = 0;
  ms = START_MS;

  observe(atMs: number): void {
    const last = this.last;
    this.last = atMs;
    if (last === null) return;
    const gap = atMs - last;
    if (this.samples++ === 0) this.gap = gap;
    this.jitter += (Math.abs(gap - this.gap) - this.jitter) * SMOOTH;
    this.gap += (gap - this.gap) * SMOOTH;
    const target = Math.min(MAX_MS, Math.max(MIN_MS, this.gap + JITTER_ROOM * this.jitter + MARGIN_MS));
    const step = target > this.ms ? Math.min(STEP_UP_MS, target - this.ms) : -Math.min(STEP_DOWN_MS, this.ms - target);
    this.ms += step;
  }
}
