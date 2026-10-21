import { Room, type Client } from "@colyseus/core";
import {
  botLevel,
  C2S,
  characterId,
  DEFAULT_CHARACTER,
  MAX_PLAYERS,
  S2C,
  inputSeq,
  inputTick,
  sanitizeInput,
  sanitizeName,
  TICK_RATE,
  type RoomPhase,
} from "@bombtop/shared";
import { authConfigFromEnv, authenticate, type AuthUser } from "./auth";
import { BattleSession, SnapshotStream } from "@bombtop/shared";
import { NetLog, netReport } from "./net-log";

/** ?debug clients' connection reports, read over SSH (deploy/vps/README.md). */
const netLog = new NetLog(process.env.LOG_DIR ?? "logs");

const authConfig = authConfigFromEnv();

/** Seconds a dropped player has to reconnect before being removed. */
const RECONNECT_SECONDS = 20;

export interface BattleRoomOptions {
  private?: boolean;
  name?: string;
  character?: string;
  /** Supabase access token (Google login). */
  token?: string;
}

/** Thin Colyseus adapter around BattleSession. State is sent as messages, not Schema. */
export class BattleRoom extends Room {
  maxClients = MAX_PLAYERS;
  private session = new BattleSession();
  private lastPhase: RoomPhase = "lobby";
  /** Whole snapshots now and then, differences in between. */
  private stream = new SnapshotStream();

  async onCreate(options: BattleRoomOptions) {
    if (options?.private) await this.setPrivate(true);
    this.setPatchRate(null);

    this.onMessage(C2S.input, (client, message) => {
      this.session.setInput(client.sessionId, sanitizeInput(message), inputSeq(message), inputTick(message));
    });
    this.onMessage(C2S.sync, (client) => {
      client.send(S2C.lobby, this.session.lobbyInfo(this.roomId));
      // The base the next difference is made against.
      const last = this.stream.last;
      if (this.session.phase !== "lobby" && last) client.send(S2C.snapshot, last);
    });
    this.onMessage(C2S.addBot, (client, message) => {
      const level = botLevel(message);
      if (level && this.session.addBot(client.sessionId, level)) this.seatsChanged();
    });
    this.onMessage(C2S.removeBot, (client, message: unknown) => {
      const id = (message as { id?: unknown } | null)?.id;
      if (typeof id === "string" && this.session.removeBot(client.sessionId, id)) this.seatsChanged();
    });
    this.onMessage(C2S.character, (client, message) => {
      const character = characterId(message);
      if (character && this.session.setCharacter(client.sessionId, character)) this.broadcastLobby();
    });
    this.onMessage(C2S.stats, (client, message) => {
      const report = netReport(message);
      if (!report || !netLog.allow(client.sessionId)) return;
      const player = this.session.lobbyInfo(this.roomId).members.find((m) => m.id === client.sessionId)?.name ?? "?";
      try {
        netLog.write({ room: this.roomId, player }, report);
      } catch (err) {
        console.warn("[bombtop] net log", err);
      }
    });
    this.onMessage(C2S.start, (client) => {
      if (this.session.start(client.sessionId)) this.syncPhase();
    });

    this.setSimulationInterval(() => this.update(), 1000 / TICK_RATE);
  }

  /**
   * Verifies the Google login when present; the result is available as client.auth.
   * Colyseus treats a falsy return as "unauthorized", so guests get a truthy marker.
   */
  async onAuth(_client: Client, options: BattleRoomOptions): Promise<AuthUser | { guest: true }> {
    return (await authenticate(options?.token, authConfig)) ?? { guest: true };
  }

  onJoin(client: Client, options: BattleRoomOptions) {
    const auth = client.auth as Partial<AuthUser> | undefined;
    if (!this.session.join(client.sessionId, sanitizeName(auth?.name ?? options?.name), characterId(options?.character) ?? DEFAULT_CHARACTER)) {
      throw new Error("Sala cheia ou partida em andamento");
    }
    this.broadcastLobby();
  }

  onDrop(client: Client) {
    this.session.setConnected(client.sessionId, false);
    this.broadcastLobby();
    // Rejects at once when the client dropped mid-join or the room is closing:
    // left unhandled, that rejection would take the whole server down.
    this.allowReconnection(client, RECONNECT_SECONDS).catch(() => this.onLeave(client));
  }

  onReconnect(client: Client) {
    this.session.setConnected(client.sessionId, true);
    this.broadcastLobby();
  }

  onLeave(client: Client) {
    this.session.leave(client.sessionId);
    this.broadcastLobby();
  }

  private update() {
    const out = this.session.tick();
    if (out.snapshot) {
      const sent = this.stream.next(out.snapshot);
      if ("full" in sent) this.broadcast(S2C.snapshot, sent.full);
      else this.broadcast(S2C.delta, sent.delta);
    }
    if (out.result) this.broadcast(S2C.result, out.result);
    this.syncPhase();
  }

  /** Locks the room while a match runs (no public joins) and announces phase changes. */
  private syncPhase() {
    const phase = this.session.phase;
    if (phase === this.lastPhase) return;
    this.lastPhase = phase;
    if (phase === "playing") void this.lock();
    if (phase === "lobby") void this.unlock();
    this.broadcastLobby();
  }

  /** Bots take seats too: a full room stops taking people until a bot leaves. */
  private seatsChanged() {
    if (this.session.members.length >= MAX_PLAYERS) void this.lock();
    else void this.unlock();
    this.broadcastLobby();
  }

  private broadcastLobby() {
    this.broadcast(S2C.lobby, this.session.lobbyInfo(this.roomId));
  }
}
