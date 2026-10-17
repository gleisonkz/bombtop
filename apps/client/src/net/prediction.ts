import {
  cursedDirection,
  steer,
  type Direction,
  type MatchState,
  type Player,
  type PlayerInput,
  type Snapshot,
} from "@bombtop/shared";

interface Entry {
  seq: number;
  dir: Direction;
  alt: Direction;
  /** Client tick from which this input is held. */
  tick: number;
}

/**
 * Client-side prediction for the local player: the server's snapshot is the
 * truth, and the inputs it has not applied yet (per its ack) are replayed on
 * top of it, so the player reacts on the next frame instead of a round trip
 * later. Only movement is predicted; everything else waits for the server.
 */
export class Predictor {
  private log: Entry[] = [];
  private seq = 0;
  private tick = 0;

  constructor(private readonly me: string) {}

  /** Records this tick's input. Returns the sequence number to send it with, or null when nothing changed. */
  step(input: PlayerInput): number | null {
    const alt = input.alt ?? null;
    const last = this.log.at(-1);
    let sent: number | null = null;
    if (!last || last.dir !== input.dir || last.alt !== alt || input.bomb || input.action) {
      sent = ++this.seq;
      this.log.push({ seq: sent, dir: input.dir, alt, tick: this.tick });
    }
    this.tick++;
    return sent;
  }

  /** New match: the server starts from scratch, so drop the history (sequence numbers keep counting). */
  reset(): void {
    this.log = [];
  }

  /** The local player as it should look now, or null when it is not in the match. */
  predict(snap: Snapshot): Player | null {
    const found = snap.players.find((p) => p.id === this.me);
    if (!found) return null;
    const ack = snap.acks[this.me] ?? { seq: 0, ticks: 0 };
    // Inputs older than the acked one are already part of the snapshot.
    const keep = this.log.findIndex((e) => e.seq >= ack.seq);
    if (keep > 0) this.log = this.log.slice(keep);

    const p = structuredClone(found);
    if (!p.alive || p.stun > 0 || p.mount || p.jumpTicks > 0 || p.dashTicks > 0) return p;

    const state = { ...snap, players: [p], rng: 0 } as MatchState;
    this.log.forEach((e, i) => {
      let ticks = (this.log[i + 1]?.tick ?? this.tick) - e.tick;
      if (e.seq === ack.seq) ticks -= ack.ticks;
      for (; ticks > 0; ticks--) {
        const dir = cursedDirection(p, e.dir);
        const moved = steer(state, p, dir, cursedDirection(p, e.alt));
        if (moved) p.facing = moved;
      }
    });
    return p;
  }
}
