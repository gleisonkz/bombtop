import {
  createMatch,
  matchResult,
  MAX_PLAYERS,
  publicView,
  STAGES,
  step,
  TICK_RATE,
  type Direction,
  type LobbyInfo,
  type LobbyMember,
  type MatchResult,
  type MatchState,
  type PlayerInput,
  type Snapshot,
  type RoomPhase,
  type StageId,
} from "@bombtop/shared";

/** Ticks the results screen stays up before returning to the lobby. */
export const RESULTS_TICKS = 4 * TICK_RATE;

/** Broadcast a snapshot every N simulation ticks (60/2 = 30 Hz). */
export const SNAPSHOT_EVERY = 2;

export interface TickOutput {
  snapshot?: Snapshot;
  result?: MatchResult & { over: true };
}

interface InputBuffer {
  dir: Direction;
  alt: Direction;
  /** Sequence number of the latest input message, and ticks it has been applied. */
  seq: number;
  ticks: number;
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
  phase: RoomPhase = "lobby";
  members: LobbyMember[] = [];
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
    this.members.push({ id, name, wins: 0, connected: true });
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

  setConnected(id: string, connected: boolean): void {
    const m = this.members.find((m) => m.id === id);
    if (m) m.connected = connected;
  }

  lobbyInfo(code: string): LobbyInfo {
    return {
      phase: this.phase,
      hostId: this.hostId ?? null,
      members: this.members.map((m) => ({ ...m })),
      // In the lobby, show what is coming next; otherwise what is being played.
      stage: this.phase === "lobby" ? this.nextStage : this.stage,
      code,
    };
  }

  private get nextStage(): StageId {
    return STAGES[this.round % STAGES.length]!;
  }

  start(requesterId: string): boolean {
    if (this.phase !== "lobby" || requesterId !== this.hostId || this.members.length < 2) return false;
    this.stage = this.nextStage;
    this.round++;
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

  setInput(id: string, input: PlayerInput, seq = 0): void {
    if (!this.match?.players.some((p) => p.id === id)) return;
    const buf = this.inputs.get(id) ?? { dir: null, alt: null, bomb: false, action: false, seq: 0, ticks: 0 };
    if (seq !== buf.seq) buf.ticks = 0;
    buf.seq = seq;
    buf.dir = input.dir;
    buf.alt = input.alt ?? null;
    buf.bomb ||= input.bomb;
    buf.action ||= !!input.action;
    this.inputs.set(id, buf);
  }

  private snapshot(match: MatchState): Snapshot {
    const acks: Snapshot["acks"] = {};
    for (const [id, buf] of this.inputs) acks[id] = { seq: buf.seq, ticks: buf.ticks };
    return { ...publicView(match), acks };
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
      inputs[id] = { dir: buf.dir, alt: buf.alt, bomb: buf.bomb, action: buf.action };
      buf.bomb = buf.action = false;
      buf.ticks++;
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
    if (result.over || this.match.tick % SNAPSHOT_EVERY === 0) out.snapshot = this.snapshot(this.match);
    return out;
  }
}
