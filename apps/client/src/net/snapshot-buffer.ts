import { TICK_RATE, type PublicView } from "@bombtop/shared";

export interface Sample {
  from: PublicView;
  to: PublicView;
  /** 0..1 progress from `from` to `to`. */
  alpha: number;
  /** How far render time is past the newest snapshot (the next one is late), in ms; 0 otherwise. */
  pastMs: number;
}

const TICK_MS = 1000 / TICK_RATE;
/**
 * How much the clock estimate gives up per snapshot (ms), so it follows slow
 * drift between our clock and the server's instead of holding one lucky arrival forever.
 */
const CREEP_MS = 0.05;

interface Entry {
  snap: PublicView;
  /** Server time of the snapshot (its tick), in ms. */
  at: number;
}

/**
 * Keeps recent server snapshots and renders slightly in the past (`delayMs`)
 * so there are usually two snapshots to interpolate between, hiding network
 * jitter. Snapshots are placed by server time (their tick) against our clock,
 * matched by the quickest arrival seen: a burst after a network hiccup lands
 * where each snapshot belongs instead of squeezing time.
 */
export class SnapshotBuffer {
  private entries: Entry[] = [];
  /** Our clock minus server time, for a snapshot that came as fast as any. */
  private offset: number | null = null;

  constructor(
    /** How far in the past to render; may change as the connection is measured. */
    public delayMs: number,
    private readonly capacity = 32,
  ) {}

  get size(): number {
    return this.entries.length;
  }

  get latest(): PublicView | undefined {
    return this.entries.at(-1)?.snap;
  }

  push(snap: PublicView, atMs: number): void {
    const last = this.entries.at(-1);
    if (last && snap.tick < last.snap.tick) this.clear(); // a new match started
    const at = snap.tick * TICK_MS;
    const offset = atMs - at;
    this.offset = this.offset === null ? offset : Math.min(offset, this.offset + CREEP_MS);
    this.entries.push({ snap, at });
    if (this.entries.length > this.capacity) this.entries.shift();
  }

  clear(): void {
    this.entries = [];
    this.offset = null;
  }

  sample(nowMs: number): Sample | null {
    const first = this.entries[0];
    if (!first) return null;
    const t = nowMs - this.offset! - this.delayMs;

    for (let i = this.entries.length - 1; i > 0; i--) {
      const a = this.entries[i - 1]!;
      const b = this.entries[i]!;
      if (t >= a.at && t <= b.at) {
        return { from: a.snap, to: b.snap, alpha: (t - a.at) / Math.max(1, b.at - a.at), pastMs: 0 };
      }
    }
    const newest = this.entries.at(-1)!;
    if (t > newest.at) {
      // The next snapshot is late: say by how much, so movement can be carried on.
      const before = this.entries.at(-2) ?? newest;
      return { from: before.snap, to: newest.snap, alpha: before === newest ? 0 : 1, pastMs: t - newest.at };
    }
    return { from: first.snap, to: first.snap, alpha: 0, pastMs: 0 };
  }
}
