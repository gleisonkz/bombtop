import {
  createMatch,
  matchResult,
  MAX_PLAYERS,
  publicView,
  STAGES,
  step,
  TICK_RATE,
  type Direction,
  type MatchResult,
  type MatchState,
  type PlayerInput,
  type PublicView,
  type StageId,
} from "@bombtopia/shared";

/** Ticks the results screen stays up before returning to the lobby. */
export const RESULTS_TICKS = 4 * TICK_RATE;

/** Broadcast a snapshot every N simulation ticks (60/2 = 30 Hz). */
export const SNAPSHOT_EVERY = 2;

export type Phase = "lobby" | "playing" | "results";

export interface Member {
  id: string;
  name: string;
  wins: number;
}

export interface TickOutput {
  snapshot?: PublicView;
  result?: MatchResult & { over: true };
}

interface InputBuffer {
  dir: Direction;
  /** Button presses seen since the last tick (so quick taps are never lost). */
  bomb: boolean;
  action: boolean;
}

export interface SessionOptions {
  /** Seed source for new matches (injectable for tests). */
  seed?: () => number;
  blockDensity?: number;
}

/**
 * Transport-agnostic room logic: lobby, host, match lifecycle and input
 * buffering. The Colyseus room is a thin adapter around this.
 */
export class BattleSession {
  phase: Phase = "lobby";
  members: Member[] = [];
  match: MatchState | null = null;
  stage: StageId = STAGES[0]!;
  private round = 0;
  private resultsLeft = 0;
  private inputs = new Map<string, InputBuffer>();

  constructor(private readonly opts: SessionOptions = {}) {}

  get hostId(): string | undefined {
    return this.members[0]?.id;
  }

  join(id: string, name: string): boolean {
    if (this.phase !== "lobby" || this.members.length >= MAX_PLAYERS) return false;
    if (this.members.some((m) => m.id === id)) return true;
    this.members.push({ id, name, wins: 0 });
    return true;
  }

  leave(id: string): void {
    this.members = this.members.filter((m) => m.id !== id);
    this.inputs.delete(id);
    const p = this.match?.players.find((p) => p.id === id);
    if (p) {
      p.alive = false;
      p.cart = null;
    }
  }

  start(requesterId: string): boolean {
    if (this.phase !== "lobby" || requesterId !== this.hostId || this.members.length < 2) return false;
    this.stage = STAGES[this.round++ % STAGES.length]!;
    const seed = this.opts.seed?.() ?? Math.floor(Math.random() * 2 ** 32);
    this.match = createMatch({
      seed,
      playerIds: this.members.map((m) => m.id),
      stage: this.stage,
      ...(this.opts.blockDensity !== undefined && { blockDensity: this.opts.blockDensity }),
    });
    this.inputs.clear();
    this.phase = "playing";
    return true;
  }

  setInput(id: string, input: PlayerInput): void {
    if (!this.match?.players.some((p) => p.id === id)) return;
    const buf = this.inputs.get(id) ?? { dir: null, bomb: false, action: false };
    buf.dir = input.dir;
    buf.bomb ||= input.bomb;
    buf.action ||= !!input.action;
    this.inputs.set(id, buf);
  }

  tick(): TickOutput {
    if (this.phase === "results") {
      if (--this.resultsLeft <= 0) {
        this.phase = "lobby";
        this.match = null;
      }
      return {};
    }
    if (this.phase !== "playing" || !this.match) return {};

    const inputs: Record<string, PlayerInput> = {};
    for (const [id, buf] of this.inputs) {
      inputs[id] = { dir: buf.dir, bomb: buf.bomb, action: buf.action };
      buf.bomb = buf.action = false;
    }
    step(this.match, inputs);

    const result = matchResult(this.match);
    const out: TickOutput = {};
    if (result.over) {
      out.result = result;
      const winner = this.members.find((m) => m.id === result.winnerId);
      if (winner) winner.wins++;
      this.phase = "results";
      this.resultsLeft = RESULTS_TICKS;
    }
    if (result.over || this.match.tick % SNAPSHOT_EVERY === 0) out.snapshot = publicView(this.match);
    return out;
  }
}
