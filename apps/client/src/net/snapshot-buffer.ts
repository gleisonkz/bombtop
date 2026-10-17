import type { PublicView } from "@bombtop/shared";

export interface Sample {
  from: PublicView;
  to: PublicView;
  /** 0..1 progress from `from` to `to`. */
  alpha: number;
}

interface Entry {
  snap: PublicView;
  at: number;
}

/**
 * Keeps recent server snapshots and renders slightly in the past (`delayMs`)
 * so there are usually two snapshots to interpolate between, hiding network
 * jitter.
 */
export class SnapshotBuffer {
  private entries: Entry[] = [];

  constructor(
    private readonly delayMs: number,
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
    if (last && snap.tick < last.snap.tick) this.entries = []; // a new match started
    this.entries.push({ snap, at: atMs });
    if (this.entries.length > this.capacity) this.entries.shift();
  }

  clear(): void {
    this.entries = [];
  }

  sample(nowMs: number): Sample | null {
    const first = this.entries[0];
    if (!first) return null;
    const t = nowMs - this.delayMs;

    for (let i = this.entries.length - 1; i > 0; i--) {
      const a = this.entries[i - 1]!;
      const b = this.entries[i]!;
      if (t >= a.at && t <= b.at) {
        return { from: a.snap, to: b.snap, alpha: (t - a.at) / Math.max(1, b.at - a.at) };
      }
    }
    const newest = this.entries.at(-1)!;
    const edge = t > newest.at ? newest : first;
    return { from: edge.snap, to: edge.snap, alpha: 0 };
  }
}
