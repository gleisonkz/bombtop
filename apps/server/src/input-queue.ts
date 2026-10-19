import type { Direction, InputAck, PlayerInput } from "@bombtop/shared";

/** How long (server ticks) a late message keeps the delay raised. */
const WINDOW = 180;
/** Extra ticks of slack on top of the worst recent lateness. */
const MARGIN = 1;

interface Pending {
  input: PlayerInput;
  seq: number;
  due: number;
}

/**
 * One player's inputs on the server (a jitter buffer). The client stamps each
 * input with its own tick; the server applies it a short, adaptive delay
 * later, so each one is held for exactly as many ticks as the client held it.
 * That is what the client's prediction assumes, so network jitter no longer
 * pulls the predicted player back (no "teleports").
 */
export class InputQueue {
  private pending: Pending[] = [];
  private lags: { at: number; lag: number }[] = [];
  private offset: number | null = null;
  private dir: Direction = null;
  private alt: Direction = null;
  private bomb = false;
  private action = false;
  private special = false;
  private seq = 0;
  private ticks = 0;

  /** The latest input applied and for how many ticks, for the client's prediction. */
  get ack(): InputAck {
    return { seq: this.seq, ticks: this.ticks };
  }

  /** Current buffering delay, in ticks. */
  get delay(): number {
    return this.offset ?? 0;
  }

  /** An input arriving at server tick `now`, stamped with the client tick it was made on (untimed: apply at once). */
  push(input: PlayerInput, seq: number, clientTick: number | undefined, now: number): void {
    let due = now;
    if (clientTick !== undefined) {
      this.lags.push({ at: now, lag: now - clientTick });
      const target = this.target(now);
      if (this.offset === null || target > this.offset) this.offset = target;
      due = Math.max(now, clientTick + this.offset);
    }
    // Numbered inputs apply in the client's order: an old or repeated one is dropped.
    if (seq > 0 && (seq <= this.seq || this.pending.some((p) => p.seq === seq))) return;
    const at = seq > 0 ? this.pending.findIndex((p) => p.seq > seq) : -1;
    this.pending.splice(at < 0 ? this.pending.length : at, 0, { input, seq, due });
    for (let i = 1; i < this.pending.length; i++) this.pending[i]!.due = Math.max(this.pending[i]!.due, this.pending[i - 1]!.due);
  }

  /** The input to apply on server tick `now`. */
  take(now: number): PlayerInput {
    this.shrink(now);
    while (this.pending.length && this.pending[0]!.due <= now) {
      const { input, seq } = this.pending.shift()!;
      this.dir = input.dir;
      this.alt = input.alt ?? null;
      this.bomb ||= input.bomb;
      this.action ||= !!input.action;
      this.special ||= !!input.special;
      if (seq !== this.seq) this.ticks = 0;
      this.seq = seq;
    }
    const out: PlayerInput = { dir: this.dir, alt: this.alt, bomb: this.bomb, action: this.action };
    if (this.special) out.special = true;
    this.bomb = this.action = this.special = false;
    this.ticks++;
    return out;
  }

  private target(now: number): number {
    this.lags = this.lags.filter((l) => now - l.at < WINDOW);
    return Math.max(...this.lags.map((l) => l.lag)) + MARGIN;
  }

  /**
   * Once the network calms down, drop the extra delay — but only while the
   * player stands still, where waiting a few ticks less changes nothing.
   */
  private shrink(now: number): void {
    if (this.offset === null || this.dir !== null || !this.lags.length) return;
    const excess = this.offset - this.target(now);
    if (excess <= 0) return;
    const room = this.pending.length ? this.pending[0]!.due - now : excess;
    const cut = Math.min(excess, room);
    if (cut <= 0) return;
    this.offset -= cut;
    for (const p of this.pending) p.due -= cut;
  }
}
