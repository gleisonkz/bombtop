const MIN_MS = 40;
/** Mobile data (4G) holds snapshots back 350-600 ms now and then: room for most of that. */
const MAX_MS = 250;
const START_MS = 100;
/** Weight of each new arrival in the running averages. */
const SMOOTH = 0.05;
/** Room kept for late snapshots: this many average deviations, plus a little. */
const JITTER_ROOM = 4;
const MARGIN_MS = 8;
/** Time-based decay preserves room between recurring mobile-network stalls. */
const LATENESS_DECAY_MS = 8000;
/** Largest change per snapshot: grows fast when the network worsens, shrinks slowly. */
const STEP_UP_MS = 10;
const STEP_DOWN_MS = 1;

/**
 * How far in the past to render server snapshots: as little as the connection
 * allows. Tracks the average gap between arrivals, how much it varies and the
 * decaying recent stall, and keeps just enough delay that a late
 * snapshot rarely leaves nothing to show.
 */
export class AdaptiveDelay {
  private last: number | null = null;
  private gap = 0;
  private jitter = 0;
  private samples = 0;
  private late = 0;
  ms = START_MS;

  observe(atMs: number): void {
    const last = this.last;
    this.last = atMs;
    if (last === null) return;
    const gap = atMs - last;
    if (this.samples++ === 0) this.gap = gap;
    this.jitter += (Math.abs(gap - this.gap) - this.jitter) * SMOOTH;
    const lateness = Math.max(0, gap - this.gap);
    this.gap += (gap - this.gap) * SMOOTH;
    const headroom = Math.max(0, MAX_MS - this.gap - MARGIN_MS);
    this.late = Math.min(headroom, Math.max(lateness, this.late * Math.exp(-gap / LATENESS_DECAY_MS)));
    const room = Math.max(JITTER_ROOM * this.jitter, this.late);
    const target = Math.min(MAX_MS, Math.max(MIN_MS, this.gap + room + MARGIN_MS));
    const step = target > this.ms ? Math.min(STEP_UP_MS, Math.max(0, gap), target - this.ms) : -Math.min(STEP_DOWN_MS, this.ms - target);
    this.ms += step;
  }
}
