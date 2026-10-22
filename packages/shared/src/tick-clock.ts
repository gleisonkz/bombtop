/**
 * The authoritative clock: how many simulation ticks to run now so the match
 * keeps real time. Unlike FixedStep (a frame's own simulation, where dropping
 * a backlog only slows the local view), the host is authoritative for every
 * phone, so owed ticks are all played, but a few per call: after a stall the
 * match catches up over the next calls instead of in one long freeze.
 * Time past `maxBehindMs` is dropped (a phone that slept doesn't fast-forward).
 */
export class TickClock {
  private owed = 0;
  private readonly maxPerCall: number;
  private readonly maxBehindMs: number;

  constructor(
    private readonly stepMs: number,
    private last: number,
    opts: { maxPerCall?: number; maxBehindMs?: number } = {},
  ) {
    this.maxPerCall = opts.maxPerCall ?? 4;
    this.maxBehindMs = opts.maxBehindMs ?? 500;
  }

  /** Ticks to run at time `now` (ms). */
  due(now: number): number {
    this.owed = Math.min(this.owed + Math.max(0, now - this.last), this.maxBehindMs);
    this.last = now;
    const ticks = Math.min(this.maxPerCall, Math.floor(this.owed / this.stepMs + 1e-9));
    this.owed -= ticks * this.stepMs;
    return ticks;
  }

  /** Time still owed after the last call (ms), for diagnostics. */
  get behind(): number {
    return this.owed;
  }
}
