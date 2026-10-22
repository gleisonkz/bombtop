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
  /** Bomb button down (a carried bomb is thrown when it is let go). */
  hold: boolean;
  /** Client tick from which this input is held. */
  tick: number;
}

const MAX_PREDICTION_TICKS = 12;

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

  /** Ticks recorded so far: the next input is made on this tick. */
  get clock(): number {
    return this.tick;
  }

  /** Records this tick's input. Returns the sequence number to send it with, or null when nothing changed. */
  step(input: PlayerInput): number | null {
    const alt = input.alt ?? null;
    const hold = !!input.hold;
    const last = this.log.at(-1);
    let sent: number | null = null;
    if (!last || last.dir !== input.dir || last.alt !== alt || last.hold !== hold || input.bomb || input.action || input.special) {
      sent = ++this.seq;
      this.log.push({ seq: sent, dir: input.dir, alt, hold, tick: this.tick });
    }
    this.tick++;
    return sent;
  }

  /** New match: the server starts from scratch, so drop the history (sequence numbers keep counting). */
  reset(): void {
    this.log = [];
  }

  reconcile(snap: Snapshot): void {
    const ack = snap.acks[this.me];
    if (!ack) return;
    const keep = this.log.findIndex((e) => e.seq >= ack.seq);
    if (keep > 0) this.log = this.log.slice(keep);
    const first = this.log[0];
    if (first?.seq === ack.seq) this.tick = Math.max(this.tick, first.tick + ack.ticks);
  }

  /** Ticks we run ahead of `snap`: the inputs the server has not applied yet. */
  lead(snap: Snapshot): number {
    const ack = snap.acks[this.me] ?? { seq: 0, ticks: 0 };
    const first = this.log.find((e) => e.seq >= ack.seq);
    if (!first) return 0;
    return Math.max(0, Math.min(MAX_PREDICTION_TICKS, this.tick - first.tick - (first.seq === ack.seq ? ack.ticks : 0)));
  }

  /** The local player as it should look now, or null when it is not in the match. */
  predict(snap: Snapshot): Player | null {
    const found = snap.players.find((p) => p.id === this.me);
    if (!found) return null;
    const ack = snap.acks[this.me] ?? { seq: 0, ticks: 0 };
    this.reconcile(snap);

    const p = structuredClone(found);
    if (!p.alive || p.stun > 0 || p.frozen > 0 || p.shield > 0 || p.charge > 0 || p.rasengan > 0 || p.mount || p.jumpTicks > 0 || p.dashTicks > 0) return p;

    const state = { ...snap, players: [p], rng: 0 } as MatchState;
    this.log.forEach((e, i) => {
      const start = Math.max(e.tick + (e.seq === ack.seq ? ack.ticks : 0), this.tick - MAX_PREDICTION_TICKS);
      let ticks = (this.log[i + 1]?.tick ?? this.tick) - start;
      for (; ticks > 0; ticks--) {
        const dir = cursedDirection(p, e.dir);
        const moved = steer(state, p, dir, cursedDirection(p, e.alt));
        if (moved) p.facing = moved;
      }
    });
    return p;
  }
}
