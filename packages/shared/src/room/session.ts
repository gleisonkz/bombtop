import {
  RESULTS_TICKS,
  WINS_TO_WIN,
  BOTS_ONLY_HURRY,
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
  firstPickers,
  type BotLevel,
  type BattleTimeMinutes,
  type BattleMode,
  type BattleTeam,
  type ManiacConfig,
  normalizeManiac,
  BOT_PERSONAS,
  type CharacterId,
  type LobbyInfo,
  type LobbyMember,
  type MatchState,
  type PlayerInput,
  type ResultMessage,
  type Snapshot,
  type RoomPhase,
  type StageId,
} from "../index";
import { InputQueue } from "./input-queue";
import { DEFAULT_STAGE_ROTATION, validateStageRotation } from "../stage-rotation";


/** Broadcast a snapshot every N simulation ticks (60/2 = 30 Hz). */
export const SNAPSHOT_EVERY = 2;

export interface TickOutput {
  snapshot?: Snapshot;
  result?: ResultMessage;
}

/** Names for computer players, by the character they play; each bot draws one not taken yet. */
export const BOT_NAMES: Record<CharacterId, readonly string[]> = {
  bomb: ["Pavio", "Faísca", "Pólvora", "Estopim", "Rastilho", "Fumaça"],
  captain: ["Capitão Bravo", "Capitão Trovão", "Capitão Estrela", "Capitão Valente", "Capitão Águia", "Capitão Brasil", "Capitão Escudo", "Capitão Liberdade"],
  goku: ["Kakaroto", "Son", "Kaio", "Saiyajin", "Kame", "Nimbus", "Shenlong", "Genki"],
  naruto: ["Konoha", "Dattebayo", "Ichiraku", "Kurama", "Hokage", "Uzumaki", "Rasen", "Ramen"],
  thor: ["Thorvald", "Bjorn", "Ragnar", "Ulfric", "Sigurd", "Leif", "Eirik", "Halvar"],
  spider: ["Aranha", "Teia", "Parker", "Queens", "Tarântula", "Viúva", "Tecelão", "Escalador"],
  pikachu: ["Pika", "Faísca", "Choquinho", "Volt", "Trovão", "Bochecha", "Raiozinho", "Amarelinho"],
  flash: ["Barry", "Velocista", "Relâmpago", "Corisco", "Ligeirinho", "Turbo", "Raio Rubro", "Wally"],
  lantern: ["Hal", "Lanterna", "Anel", "Esmeralda", "Oa", "Guardião", "Facho", "Brilho Verde"],
  penelope: ["Penélope", "Penny", "Charmosa", "Pit", "Rosinha", "Diva", "Piloto", "Lady"],
  lula: ["Lula", "Luiz Inácio", "Barba", "Companheiro", "Presidente", "Sapo Barbudo", "Lulinha", "Petista"],
  pele: ["Pelé", "Rei", "Edson", "Dico", "Camisa 10", "Craque", "Santista", "Tricampeão"],
  optimus: ["Optimus", "Prime", "Autobot", "Comboio", "Líder", "Matriz", "Cybertron", "Orion"],
  harry: ["Harry", "Potter", "Eleito", "Bruxo", "Grifinório", "Apanhador", "Cicatriz", "Patrono"],
  panther: ["Pantera", "Rosa", "Pink", "Sorrateira", "Felino", "Na Ponta", "Tiptoe", "Pinky"],
  donatello: ["Donnie", "Don", "Bastão", "Gênio", "Casco", "Roxo", "Inventor", "Bo"],
  bugs: ["Pernalonga", "Orelhudo", "Coelhão", "Doutor", "Cenourinha", "Toca", "Dentuço", "Pé-de-Coelho"],
  static: ["Virgil", "Choque", "Estática", "Faísca", "Dakota", "Gerador", "Curto", "Voltagem"],
};

export interface SessionOptions {
  /** Seed source for new matches (injectable for tests). */
  seed?: () => number;
  /** Random number in [0, 1) for bot names (injectable for tests). */
  random?: () => number;
  blockDensity?: number;
  winsToWin?: number;
  timeMinutes?: BattleTimeMinutes;
  suddenDeath?: boolean;
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
  private winsToWin: number;
  private timeMinutes: BattleTimeMinutes;
  private suddenDeath: boolean;
  private battleMode: BattleMode = "single";
  private maniacSettings: ManiacConfig = { items: {}, hitPoints: {} };
  private stageRotation = DEFAULT_STAGE_ROTATION.map((entry) => ({ ...entry }));
  private round = 0;
  private resultsLeft = 0;
  /** The last round's winner won the match: after its results, back to the lobby. */
  private setOver = false;
  private inputs = new Map<string, InputQueue>();
  private bots = new Map<string, Bot>();
  private botSeq = 0;
  /** When each member picked their character (a running count): the first on a character wears its original colors. */
  private pickedAt = new Map<string, number>();
  private picks = 0;

  constructor(private readonly opts: SessionOptions = {}) {
    this.winsToWin = opts.winsToWin ?? WINS_TO_WIN;
    this.timeMinutes = opts.timeMinutes ?? null;
    this.suddenDeath = opts.suddenDeath ?? true;
  }

  /** The first person in the room (bots never host). */
  get hostId(): string | undefined {
    return this.members.find((m) => !m.bot)?.id;
  }

  join(id: string, name: string, character: CharacterId = DEFAULT_CHARACTER): boolean {
    if (this.phase !== "lobby" || this.members.length >= MAX_PLAYERS) return false;
    if (this.members.some((m) => m.id === id)) return true;
    this.members.push({ id, name, wins: 0, connected: true, character, team: this.members.length % 2 === 0 ? "red" : "blue" });
    this.pickedAt.set(id, ++this.picks);
    return true;
  }

  /** In the lobby, a person (not a bot) changes their character. */
  setCharacter(id: string, character: CharacterId): boolean {
    const m = this.members.find((m) => m.id === id && !m.bot);
    if (this.phase !== "lobby" || !m) return false;
    if (m.character !== character) this.pickedAt.set(id, ++this.picks);
    m.character = character;
    return true;
  }

  setTeam(requesterId: string, memberId: string, team: unknown): boolean {
    if (this.phase !== "lobby" || this.battleMode !== "tag" || (team !== "red" && team !== "blue")) return false;
    const member = this.members.find((m) => m.id === memberId);
    if (!member || (requesterId !== memberId && requesterId !== this.hostId)) return false;
    if (member.bot && requesterId !== this.hostId) return false;
    member.team = team;
    return true;
  }

  /** Members wearing their character's original colors: the first, in pick order, on each character. */
  private ownColors(): Set<string> {
    const at = (id: string) => this.pickedAt.get(id) ?? 0;
    return firstPickers([...this.members].sort((a, b) => at(a.id) - at(b.id)));
  }

  leave(id: string): void {
    this.members = this.members.filter((m) => m.id !== id);
    this.pickedAt.delete(id);
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
    const random = this.opts.random ?? Math.random;
    // a character drawn at random, one nobody in the room plays yet (any, once all are taken)
    const playing = new Set(this.members.map((m) => m.character));
    const free = CHARACTERS.filter((c) => !playing.has(c));
    const pool = free.length ? free : CHARACTERS;
    const character = pool[Math.floor(random() * pool.length)]!;
    const name = this.botName(character) ?? `Bot ${this.botSeq + 1}`;
    // A personality no other bot in the room has (there are as many as bot seats).
    const used = new Set(this.members.map((m) => m.persona));
    const personas = BOT_PERSONAS.filter((p) => !used.has(p));
    const persona = personas[Math.floor(random() * personas.length)] ?? BOT_PERSONAS[0]!;
    const id = `bot-${++this.botSeq}`;
    this.members.push({ id, name, wins: 0, connected: true, bot: level, character, persona, team: this.members.length % 2 === 0 ? "red" : "blue" });
    this.pickedAt.set(id, ++this.picks);
    return true;
  }

  /** Host only, in the lobby: a bot plays another character, under a name of that character's (same level and personality). */
  setBotCharacter(requesterId: string, botId: string, character: CharacterId): boolean {
    const m = this.members.find((m) => m.id === botId && m.bot);
    if (this.phase !== "lobby" || requesterId !== this.hostId || !m) return false;
    if (m.character === character) return true;
    m.character = character;
    m.name = this.botName(character, m.id) ?? m.name;
    this.pickedAt.set(botId, ++this.picks);
    return true;
  }

  /** A name of the character's that no one else in the room has (`self` may keep its own), at random. */
  private botName(character: CharacterId, self?: string): string | undefined {
    const taken = new Set(this.members.filter((m) => m.id !== self).map((m) => m.name));
    const free = BOT_NAMES[character].filter((n) => !taken.has(n));
    return free[Math.floor((this.opts.random ?? Math.random)() * free.length)];
  }

  /** Host only, in the lobby: frees a bot's seat. */
  removeBot(requesterId: string, botId: string): boolean {
    if (this.phase !== "lobby" || requesterId !== this.hostId) return false;
    if (!this.members.some((m) => m.id === botId && m.bot)) return false;
    this.members = this.members.filter((m) => m.id !== botId);
    this.pickedAt.delete(botId);
    return true;
  }

  setConnected(id: string, connected: boolean): void {
    const m = this.members.find((m) => m.id === id);
    if (m) m.connected = connected;
    // A dropped player stops (their key's release may never come), and a page that
    // comes back counts its inputs from 1 again: start their queue afresh.
    this.inputs.delete(id);
  }

  lobbyInfo(code: string): LobbyInfo {
    const own = this.ownColors();
    const maniac = this.battleMode === "maniac";
    return {
      phase: this.phase,
      hostId: this.hostId ?? null,
      members: this.members.map(({ team, ...member }) => ({
        ...member,
        ...(this.battleMode === "tag" && { team }),
        ...(own.has(member.id) && { ownColors: true as const }),
      })),
      // In the lobby, show what is coming next; otherwise what is being played.
      stage: maniac ? "classic" : this.phase === "lobby" ? this.nextStage : this.stage,
      winsToWin: maniac ? 3 : this.winsToWin,
      timeMinutes: maniac ? 3 : this.timeMinutes,
      suddenDeath: maniac ? false : this.suddenDeath,
      stageRotation: maniac ? [{ stage: "classic" }] : this.stageRotation.map((entry) => ({ ...entry })),
      battleMode: this.battleMode,
      maniac: this.currentManiac(),
      code,
    };
  }

  private get nextStage(): StageId {
    return this.battleMode === "maniac" ? "classic" : this.stageRotation[this.round % this.stageRotation.length]!.stage;
  }

  private currentManiac(): ManiacConfig {
    const ids = this.members.map((member) => member.id);
    const hitPoints = Object.fromEntries(ids.map((id) => [id, this.maniacSettings.hitPoints[id] ?? 1]));
    return normalizeManiac({ items: this.maniacSettings.items, hitPoints }, ids)!;
  }

  setWinsToWin(requesterId: string, winsToWin: unknown): boolean {
    return this.setRules(requesterId, { winsToWin });
  }

  setTimeMinutes(requesterId: string, timeMinutes: unknown): boolean {
    return this.setRules(requesterId, { timeMinutes });
  }

  setSuddenDeath(requesterId: string, suddenDeath: unknown): boolean {
    return this.setRules(requesterId, { suddenDeath });
  }

  setRules(requesterId: string, raw: unknown): boolean {
    if (this.phase !== "lobby" || requesterId !== this.hostId) return false;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
    const rules = raw as Record<string, unknown>;
    const hasWins = Object.hasOwn(rules, "winsToWin");
    const hasRotation = Object.hasOwn(rules, "stageRotation");
    const hasTime = Object.hasOwn(rules, "timeMinutes");
    const hasSuddenDeath = Object.hasOwn(rules, "suddenDeath");
    const hasMode = Object.hasOwn(rules, "battleMode");
    const hasManiac = Object.hasOwn(rules, "maniac");
    if (!hasWins && !hasRotation && !hasTime && !hasSuddenDeath && !hasMode && !hasManiac) return false;
    const battleMode = hasMode ? rules.battleMode : this.battleMode;
    if (battleMode !== "single" && battleMode !== "tag" && battleMode !== "maniac") return false;
    if (battleMode === "maniac" && (hasWins || hasRotation || hasTime || hasSuddenDeath)) return false;
    const wins = hasWins ? rules.winsToWin : this.winsToWin;
    if (typeof wins !== "number" || !Number.isSafeInteger(wins) || wins < 1 || wins > 5) return false;
    const rotation = hasRotation ? validateStageRotation(rules.stageRotation) : this.stageRotation;
    if (!rotation) return false;
    const timeMinutes = hasTime ? rules.timeMinutes : this.timeMinutes;
    if (timeMinutes !== null && timeMinutes !== 1 && timeMinutes !== 2 && timeMinutes !== 3 && timeMinutes !== 5) return false;
    const suddenDeath = hasSuddenDeath ? rules.suddenDeath : this.suddenDeath;
    if (typeof suddenDeath !== "boolean") return false;
    const maniac = hasManiac ? normalizeManiac(rules.maniac, this.members.map((member) => member.id)) : this.currentManiac();
    if (!maniac) return false;
    this.winsToWin = wins;
    this.stageRotation = rotation;
    this.timeMinutes = timeMinutes as BattleTimeMinutes;
    this.suddenDeath = suddenDeath;
    this.battleMode = battleMode;
    this.maniacSettings = maniac;
    this.round = 0;
    return true;
  }

  /** The host starts a match from the lobby: rounds until someone has won WINS_TO_WIN of them. */
  start(requesterId: string): boolean {
    if (this.phase !== "lobby" || requesterId !== this.hostId || this.members.length < 2) return false;
    if (this.battleMode === "tag" && new Set(this.members.map((member) => member.team)).size !== 2) return false;
    for (const m of this.members) m.wins = 0;
    this.round = 0;
    this.startRound();
    return true;
  }

  private startRound(): void {
    this.setOver = false;
    this.stage = this.nextStage;
    this.round++;
    const seed = this.opts.seed?.() ?? Math.floor(Math.random() * 2 ** 32);
    const maniac = this.battleMode === "maniac" ? this.currentManiac() : null;
    this.match = createMatch({
      seed,
      playerIds: this.members.map((m) => m.id),
      characters: Object.fromEntries(this.members.map((m) => [m.id, m.character])),
      ownColors: this.ownColors(),
      stage: this.stage,
      timeLimitMinutes: maniac ? 3 : this.timeMinutes,
      suddenDeath: maniac ? false : this.suddenDeath,
      revenge: !!maniac,
      ...(maniac && { maniacItems: maniac.items, startingHitPoints: maniac.hitPoints }),
      ...(this.opts.blockDensity !== undefined && { blockDensity: this.opts.blockDensity }),
    });
    this.inputs.clear();
    // Each bot gets its own dice for this match, from the match's seed: replays stay the same, matches don't.
    this.bots = new Map(this.members.filter((m) => m.bot).map((m) => [m.id, new Bot(m.id, m.bot, m.persona, seed ^ hashId(m.id))]));
    this.phase = "playing";
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
        if (this.setOver || this.members.length < 2 || this.hostId === undefined) {
          this.phase = "lobby";
          this.round = 0;
          this.match = null;
        } else this.startRound();
      }
      return {};
    }
    if (this.phase !== "playing" || !this.match) return {};

    const inputs: Record<string, PlayerInput> = {};
    for (const [id, queue] of this.inputs) inputs[id] = queue.take(this.match.tick);
    // once the humans are out, the bots go all out (botHeat): nobody waits out a long bots-only standoff
    const humansAlive = this.match.players.some((p) => p.alive && !this.bots.has(p.id));
    if (!humansAlive && this.match.pressureAt > this.match.tick + BOTS_ONLY_HURRY) this.match.pressureAt = this.match.tick + BOTS_ONLY_HURRY;
    for (const [id, bot] of this.bots) inputs[id] = bot.input(this.match, humansAlive);
    step(this.match, inputs);

    const result = this.battleMode === "tag" ? this.tagResult() : matchResult(this.match);
    const out: TickOutput = {};
    if (result.over) {
      const winnerTeam = "winnerTeam" in result ? result.winnerTeam : undefined;
      const winners = winnerTeam
        ? this.members.filter((member) => member.team === winnerTeam)
        : this.members.filter((member) => member.id === result.winnerId);
      for (const member of winners) member.wins++;
      const winner = winners[0];
      this.setOver = !!winner && winner.wins >= (this.battleMode === "maniac" ? 3 : this.winsToWin);
      out.result = { ...result, setOver: this.setOver };
      this.phase = "results";
      this.resultsLeft = RESULTS_TICKS;
    }
    if (result.over || this.match.tick % SNAPSHOT_EVERY === 0) out.snapshot = this.snapshot(this.match);
    return out;
  }

  private tagResult(): { over: false } | { over: true; winnerId: string | null; winnerTeam: BattleTeam | null } {
    if (!this.match || this.match.players.length < 2) return { over: false };
    const survivors = this.match.players.filter((player) => player.alive);
    const teams = new Set(survivors.map((player) => this.members.find((member) => member.id === player.id)?.team));
    if (teams.size <= 1) {
      const winnerTeam = survivors.length ? (this.members.find((member) => member.id === survivors[0]!.id)?.team ?? null) : null;
      const winnerId = winnerTeam ? (survivors.find((player) => this.members.some((member) => member.id === player.id && member.team === winnerTeam))?.id ?? null) : null;
      return { over: true, winnerId, winnerTeam };
    }
    if (this.match.roundEndsAt !== undefined && this.match.tick >= this.match.roundEndsAt) return { over: true, winnerId: null, winnerTeam: null };
    return { over: false };
  }
}

/** A string's FNV-1a hash (a bot's id, to give each bot different dice from one match seed). */
function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}
