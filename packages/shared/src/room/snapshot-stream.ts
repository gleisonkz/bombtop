import { diff, type Patch, type Snapshot } from "../index";

/** A whole snapshot every this many (2 s at 30 Hz), so a client can never drift for long. */
export const KEYFRAME_EVERY = 60;

/**
 * Turns the match's snapshots into what goes on the wire: the whole snapshot
 * now and then, and in between only what changed since the previous one
 * (~10% of the size). The transport is ordered and reliable, so every client
 * holds the same previous snapshot the difference was made against.
 */
export class SnapshotStream {
  private prev: Snapshot | null = null;
  private count = 0;

  /** The last snapshot sent: a client joining now gets it whole, then follows the differences. */
  get last(): Snapshot | null {
    return this.prev;
  }

  next(snap: Snapshot): { full: Snapshot } | { delta: Patch } {
    const prev = this.prev;
    this.prev = snap;
    const keyframe = !prev || snap.tick < prev.tick || this.count++ % KEYFRAME_EVERY === KEYFRAME_EVERY - 1;
    if (keyframe) {
      this.count = 0;
      return { full: snap };
    }
    return { delta: diff(prev, snap) };
  }
}
