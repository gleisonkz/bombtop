import type { Direction, InputAck, PlayerInput } from "../index";

/** How long (server ticks) a late message keeps the delay raised. */
const WINDOW = 180;
/** Extra ticks of slack on top of the worst recent lateness. */
const MARGIN = 1;
/** Recover at most one tick of buffering per six server ticks. */
const RECOVERY_INTERVAL = 6;

interface Pending {
  input: PlayerInput;
  seq: number;
  due: number;
}

/**
 * One player's inputs on the server (a jitter buffer). The client stamps each
 * input with its own tick; the server applies it a short, adaptive delay
 * later, preserving client durations except during bounded delay recovery
 * or when overdue transitions must be spread across simulation ticks.
 * Steady timing matches client prediction; recovery can cause small corrections.
 */
export class InputQueue {
  private pending: Pending[] = [];
  private lags: { at: number; lag: number }[] = [];
  private offset: number | null = null;
  private lastRecovery: number | null = null;
  private dir: Direction = null;
  private alt: Direction = null;
  private bomb = false;
  private hold = false;
  private brace = false;
  private stopKick = false;
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

  /** An input arriving at server tick `now`, stamped with its client tick (untimed: eligible at once). */
  push(input: PlayerInput, seq: number, clientTick: number | undefined, now: number): void {
    // Reject old or repeated inputs before they can affect the lag estimate.
    if (seq > 0 && (seq <= this.seq || this.pending.some((p) => p.seq === seq))) return;
    let due = now;
    if (clientTick !== undefined) {
      this.lags.push({ at: now, lag: now - clientTick });
      const target = this.target(now);
      if (this.offset === null || target > this.offset) this.offset = target;
      due = Math.max(now, clientTick + this.offset);
    }
    const at = seq > 0 ? this.pending.findIndex((p) => p.seq > seq) : -1;
    this.pending.splice(at < 0 ? this.pending.length : at, 0, { input, seq, due });
    for (let i = 1; i < this.pending.length; i++) this.pending[i]!.due = Math.max(this.pending[i]!.due, this.pending[i - 1]!.due);
  }

  /** The input to apply on server tick `now`. */
  take(now: number): PlayerInput {
    this.shrink(now);
    this.catchUpMovement(now);
    if (this.pending.length && this.pending[0]!.due <= now) {
      const { input, seq } = this.pending.shift()!;
      this.dir = input.dir;
      this.alt = input.alt ?? null;
      this.hold = !!input.hold;
      this.brace = !!input.brace;
      this.stopKick = !!input.stopKick;
      this.bomb ||= input.bomb;
      this.action ||= !!input.action;
      this.special ||= !!input.special;
      if (seq !== this.seq) this.ticks = 0;
      this.seq = seq;
    }
    const out: PlayerInput = { dir: this.dir, alt: this.alt, bomb: this.bomb, action: this.action };
    if (this.special) out.special = true;
    if (this.hold) out.hold = true;
    if (this.brace) out.brace = true;
    if (this.stopKick) out.stopKick = true;
    this.bomb = this.action = this.special = false;
    this.ticks++;
    return out;
  }

  private target(now: number): number {
    this.lags = this.lags.filter((l) => now - l.at < WINDOW);
    if (!this.lags.length) return this.offset ?? 0;
    return Math.max(...this.lags.map((l) => l.lag)) + MARGIN;
  }

  private catchUpMovement(now: number): void {
    const first = this.pending[0];
    const next = this.pending[1];
    if (!first || !next || first.due >= now || next.due > now) return;
    const input = first.input;
    if (input.bomb || input.action || input.special || next.input.bomb || next.input.action || next.input.special) return;
    if (!!input.hold !== this.hold || !!next.input.hold !== this.hold) return;
    if (!!input.brace !== this.brace || !!next.input.brace !== this.brace) return;
    if (!!input.stopKick !== this.stopKick || !!next.input.stopKick !== this.stopKick) return;
    this.pending.shift();
  }

  /**
   * Recover gradually even during movement. Shift all due times equally to
   * preserve order. Only overdue movement may coalesce; action/hold edges
   * retain separate simulation ticks.
   */
  private shrink(now: number): void {
    if (this.offset === null) return;
    const excess = this.offset - this.target(now);
    if (excess <= 0) return;
    if (this.lastRecovery !== null && now - this.lastRecovery < RECOVERY_INTERVAL) return;
    const cut = Math.min(excess, 1);
    this.lastRecovery = now;
    this.offset -= cut;
    for (const p of this.pending) p.due -= cut;
  }
}
