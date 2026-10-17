/**
 * Fixed-timestep accumulator: converts variable frame times into a whole
 * number of simulation ticks, so the sim runs at the same rate on any display.
 */
export class FixedStep {
  private acc = 0;

  constructor(
    private readonly tickMs: number,
    private readonly maxTicksPerFrame = 5,
  ) {}

  /** Adds elapsed frame time and returns how many ticks to simulate now. */
  advance(dtMs: number): number {
    this.acc += Math.max(0, dtMs);
    // Epsilon absorbs float drift (e.g. 1.5T - T + 0.5T landing just under T).
    let ticks = Math.floor(this.acc / this.tickMs + 1e-9);
    if (ticks > this.maxTicksPerFrame) {
      ticks = this.maxTicksPerFrame;
      this.acc = 0;
    } else {
      this.acc -= ticks * this.tickMs;
    }
    return ticks;
  }

  /** Progress (0..1) toward the next tick, for render interpolation. */
  get alpha(): number {
    return this.acc / this.tickMs;
  }
}
