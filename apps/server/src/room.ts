import { Room, type Client } from "@colyseus/core";
import {
  C2S,
  MAX_PLAYERS,
  S2C,
  sanitizeInput,
  sanitizeName,
  TICK_RATE,
  type PublicView,
  type RoomPhase,
} from "@bombtopia/shared";
import { BattleSession } from "./session";

/** Seconds a dropped player has to reconnect before being removed. */
const RECONNECT_SECONDS = 20;

export interface BattleRoomOptions {
  private?: boolean;
  name?: string;
}

/** Thin Colyseus adapter around BattleSession. State is sent as messages, not Schema. */
export class BattleRoom extends Room {
  maxClients = MAX_PLAYERS;
  private session = new BattleSession();
  private lastPhase: RoomPhase = "lobby";
  private lastSnapshot: PublicView | null = null;

  async onCreate(options: BattleRoomOptions) {
    if (options?.private) await this.setPrivate(true);
    this.setPatchRate(null);

    this.onMessage(C2S.input, (client, message) => {
      this.session.setInput(client.sessionId, sanitizeInput(message));
    });
    this.onMessage(C2S.sync, (client) => {
      client.send(S2C.lobby, this.session.lobbyInfo(this.roomId));
      if (this.session.phase !== "lobby" && this.lastSnapshot) client.send(S2C.snapshot, this.lastSnapshot);
    });
    this.onMessage(C2S.start, (client) => {
      if (this.session.start(client.sessionId)) this.syncPhase();
    });

    this.setSimulationInterval(() => this.update(), 1000 / TICK_RATE);
  }

  onJoin(client: Client, options: BattleRoomOptions) {
    if (!this.session.join(client.sessionId, sanitizeName(options?.name))) {
      throw new Error("Sala cheia ou partida em andamento");
    }
    this.broadcastLobby();
  }

  onDrop(client: Client) {
    this.session.setConnected(client.sessionId, false);
    this.broadcastLobby();
    this.allowReconnection(client, RECONNECT_SECONDS);
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
      this.lastSnapshot = out.snapshot;
      this.broadcast(S2C.snapshot, out.snapshot);
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

  private broadcastLobby() {
    this.broadcast(S2C.lobby, this.session.lobbyInfo(this.roomId));
  }
}
