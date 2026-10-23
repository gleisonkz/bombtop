import {
  botLevel,
  C2S,
  characterId,
  DEFAULT_CHARACTER,
  inputSeq,
  inputTick,
  MAX_PLAYERS,
  MAX_WATCHERS,
  S2C,
  sanitizeInput,
  sanitizeName,
  type CharacterId,
  type RoomPhase,
} from "../index";
import { BattleSession } from "./session";
import { SnapshotStream } from "./snapshot-stream";

/** Where a room's messages go: a network server, or a phone hosting friends nearby. */
export interface RoomOutput {
  send(clientId: string, type: string, message?: unknown): void;
  broadcast(type: string, message?: unknown): void;
  /** The match started or ended (a server locks the room while it runs). */
  phaseChanged?(phase: RoomPhase): void;
  /** Bots took or freed seats: `full` means no more people fit. */
  seatsChanged?(full: boolean): void;
}

/**
 * A room's message handling on top of BattleSession, with no transport: what
 * each client message does, and what goes back. The Colyseus room and the
 * offline (Wi-Fi) host both run one.
 */
export class RoomCore {
  readonly session = new BattleSession();
  private lastPhase: RoomPhase = "lobby";
  /** Whole snapshots now and then, differences in between. */
  private readonly stream = new SnapshotStream();
  /** Screens watching without a seat (TV mode): they get every broadcast, and may only sync. */
  private readonly watchers = new Set<string>();

  constructor(
    /** The room's code (read when sent: a Colyseus room only gets its id once created). */
    private readonly code: string | (() => string),
    private readonly out: RoomOutput,
  ) {}

  /** Seats a new client; false when the room is full or playing. */
  join(id: string, name: unknown, character: unknown): boolean {
    const ok = this.session.join(id, sanitizeName(name), characterId(character) ?? DEFAULT_CHARACTER);
    if (ok) this.broadcastLobby();
    return ok;
  }

  /** A screen that only watches (a TV); false when MAX_WATCHERS already do. Joins any time, even mid-match. */
  watch(id: string): boolean {
    if (this.watchers.size >= MAX_WATCHERS) return false;
    this.watchers.add(id);
    this.broadcastLobby();
    return true;
  }

  /** One message from a client (untrusted). */
  message(id: string, type: string, message?: unknown): void {
    if (this.watchers.has(id) && type !== C2S.sync) return;
    switch (type) {
      case C2S.input:
        this.session.setInput(id, sanitizeInput(message), inputSeq(message), inputTick(message));
        break;
      case C2S.sync: {
        this.out.send(id, S2C.lobby, this.lobbyInfo());
        // The base the next difference is made against.
        const last = this.stream.last;
        if (this.session.phase !== "lobby" && last) this.out.send(id, S2C.snapshot, last);
        break;
      }
      case C2S.addBot: {
        const level = botLevel(message);
        if (level && this.session.addBot(id, level)) this.seatsChanged();
        break;
      }
      case C2S.removeBot: {
        const bot = (message as { id?: unknown } | null)?.id;
        if (typeof bot === "string" && this.session.removeBot(id, bot)) this.seatsChanged();
        break;
      }
      case C2S.character: {
        const character: CharacterId | null = characterId(message);
        if (character && this.session.setCharacter(id, character)) this.broadcastLobby();
        break;
      }
      case C2S.botCharacter: {
        const { id: bot, character } = (message ?? {}) as { id?: unknown; character?: unknown };
        const picked = characterId(character);
        if (typeof bot === "string" && picked && this.session.setBotCharacter(id, bot, picked)) this.broadcastLobby();
        break;
      }
      case C2S.start:
        if (this.session.start(id)) this.syncPhase();
        break;
    }
  }

  setConnected(id: string, connected: boolean): void {
    this.session.setConnected(id, connected);
    this.broadcastLobby();
  }

  leave(id: string): void {
    if (!this.watchers.delete(id)) this.session.leave(id);
    this.broadcastLobby();
  }

  /** One simulation tick (call TICK_RATE times a second). */
  update(): void {
    const out = this.session.tick();
    if (out.snapshot) {
      const sent = this.stream.next(out.snapshot);
      if ("full" in sent) this.out.broadcast(S2C.snapshot, sent.full);
      else this.out.broadcast(S2C.delta, sent.delta);
    }
    if (out.result) this.out.broadcast(S2C.result, out.result);
    this.syncPhase();
  }

  private syncPhase(): void {
    const phase = this.session.phase;
    if (phase === this.lastPhase) return;
    this.lastPhase = phase;
    this.out.phaseChanged?.(phase);
    this.broadcastLobby();
  }

  private seatsChanged(): void {
    this.out.seatsChanged?.(this.session.members.length >= MAX_PLAYERS);
    this.broadcastLobby();
  }

  private roomCode(): string {
    return typeof this.code === "string" ? this.code : this.code();
  }

  private lobbyInfo() {
    return { ...this.session.lobbyInfo(this.roomCode()), watchers: this.watchers.size };
  }

  private broadcastLobby(): void {
    this.out.broadcast(S2C.lobby, this.lobbyInfo());
  }
}
