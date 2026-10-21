import {
  RESULTS_TICKS,
  Bot,
  createMatch,
  matchResult,
  MAX_PLAYERS,
  publicView,
  STAGES,
  step,
  TICK_RATE,
  CHARACTERS,
  DEFAULT_CHARACTER,
  type BotLevel,
  type CharacterId,
  type LobbyInfo,
  type LobbyMember,
  type MatchResult,
  type MatchState,
  type PlayerInput,
  type Snapshot,
  type RoomPhase,
  type StageId,
} from "../index";
import { InputQueue } from "./input-queue";


/** Broadcast a snapshot every N simulation ticks (60/2 = 30 Hz). */
export const SNAPSHOT_EVERY = 2;

export interface TickOutput {
  snapshot?: Snapshot;
  result?: MatchResult & { over: true };
}

/** Names for computer players, by the character they play; each bot draws one not taken yet. */
export const BOT_NAMES: Record<CharacterId, readonly string[]> = {
  bomb: ["Pavio", "Faísca", "Pólvora", "Estopim", "Rastilho", "Fumaça"],
  ninja: ["Hanzo", "Kenji", "Ryu", "Kage", "Hayate", "Shiro", "Akira", "Yuki"],
  captain: ["Capitão Bravo", "Capitão Trovão", "Capitão Estrela", "Capitão Valente", "Capitão Águia", "Capitão Brasil", "Capitão Escudo", "Capitão Liberdade"],
  goku: ["Kakaroto", "Son", "Kaio", "Saiyajin", "Kame", "Nimbus", "Shenlong", "Genki"],
  naruto: ["Konoha", "Dattebayo", "Ichiraku", "Kurama", "Hokage", "Uzumaki", "Rasen", "Ramen"],
  thor: ["Thorvald", "Bjorn", "Ragnar", "Ulfric", "Sigurd", "Leif", "Eirik", "Halvar"],
};

export interface SessionOptions {
  /** Seed source for new matches (injectable for tests). */
  seed?: () => number;
  /** Random number in [0, 1) for bot names (injectable for tests). */
  random?: () => number;
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
  private inputs = new Map<string, InputQueue>();
  private bots = new Map<string, Bot>();
  private botSeq = 0;

  constructor(private readonly opts: SessionOptions = {}) {}

  /** The first person in the room (bots never host). */
  get hostId(): string | undefined {
    return this.members.find((m) => !m.bot)?.id;
  }

  join(id: string, name: string, character: CharacterId = DEFAULT_CHARACTER): boolean {
    if (this.phase !== "lobby" || this.members.length >= MAX_PLAYERS) return false;
    if (this.members.some((m) => m.id === id)) return true;
    this.members.push({ id, name, wins: 0, connected: true, character });
    return true;
  }

  /** In the lobby, a person (not a bot) changes their character. */
  setCharacter(id: string, character: CharacterId): boolean {
    const m = this.members.find((m) => m.id === id && !m.bot);
    if (this.phase !== "lobby" || !m) return false;
    m.character = character;
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

  /** Host only, in the lobby: seats a computer player of the given level. */
  addBot(requesterId: string, level: BotLevel): boolean {
    if (this.phase !== "lobby" || requesterId !== this.hostId || this.members.length >= MAX_PLAYERS) return false;
    const taken = new Set(this.members.map((m) => m.name));
    const character = CHARACTERS[this.botSeq % CHARACTERS.length]!; // bots take turns
    const free = BOT_NAMES[character].filter((n) => !taken.has(n));
    const name = free[Math.floor((this.opts.random ?? Math.random)() * free.length)] ?? `Bot ${this.botSeq + 1}`;
    this.members.push({ id: `bot-${++this.botSeq}`, name, wins: 0, connected: true, bot: level, character });
    return true;
  }

  /** Host only, in the lobby: frees a bot's seat. */
  removeBot(requesterId: string, botId: string): boolean {
    if (this.phase !== "lobby" || requesterId !== this.hostId) return false;
    if (!this.members.some((m) => m.id === botId && m.bot)) return false;
    this.members = this.members.filter((m) => m.id !== botId);
    return true;
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
      characters: Object.fromEntries(this.members.map((m) => [m.id, m.character])),
      stage: this.stage,
      ...(this.opts.blockDensity !== undefined && { blockDensity: this.opts.blockDensity }),
    });
    this.inputs.clear();
    this.bots = new Map(this.members.filter((m) => m.bot).map((m) => [m.id, new Bot(m.id, m.bot)]));
    this.phase = "playing";
    return true;
  }

  /** An input from a player; `clientTick` (when sent) lets the server hold it exactly as long as the client did. */
  setInput(id: string, input: PlayerInput, seq = 0, clientTick?: number): void {
    if (!this.match?.players.some((p) => p.id === id) || this.bots.has(id)) return;
    const queue = this.inputs.get(id) ?? new InputQueue();
    queue.push(input, seq, clientTick, this.match.tick);
    this.inputs.set(id, queue);
  }

  private snapshot(match: MatchState): Snapshot {
    const acks: Snapshot["acks"] = {};
    for (const [id, queue] of this.inputs) acks[id] = queue.ack;
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
    for (const [id, queue] of this.inputs) inputs[id] = queue.take(this.match.tick);
    for (const [id, bot] of this.bots) inputs[id] = bot.input(this.match);
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
