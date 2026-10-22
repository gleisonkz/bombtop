import { Room, type Client } from "@colyseus/core";
import { C2S, MAX_PLAYERS, RoomCore, TickClock, TICK_RATE } from "@bombtop/shared";
import { authConfigFromEnv, authenticate, type AuthUser } from "./auth";
import { NetLog, netReport, TickCost } from "./net-log";

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

/** Thin Colyseus adapter around RoomCore. State is sent as messages, not Schema. */
export class BattleRoom extends Room {
  maxClients = MAX_PLAYERS;
  private readonly core = new RoomCore(() => this.roomId, {
    send: (id, type, message) => this.clients.getById(id)?.send(type, message),
    broadcast: (type, message) => this.broadcast(type, message),
    // Locked while a match runs (no public joins); bots take seats too, so a full room stops taking people.
    phaseChanged: (phase) => void (phase === "playing" ? this.lock() : phase === "lobby" ? this.unlock() : undefined),
    seatsChanged: (full) => void (full ? this.lock() : this.unlock()),
  });

  private readonly tickCost = new TickCost();

  async onCreate(options: BattleRoomOptions) {
    if (options?.private) await this.setPrivate(true);
    this.setPatchRate(null);

    for (const type of [C2S.input, C2S.sync, C2S.addBot, C2S.removeBot, C2S.character, C2S.start, C2S.beat]) {
      this.onMessage(type, (client, message) => this.core.message(client.sessionId, type, message));
    }
    this.onMessage(C2S.stats, (client, message) => {
      const report = netReport(message);
      if (!report || !netLog.allow(client.sessionId)) return;
      const player = this.core.session.lobbyInfo(this.roomId).members.find((m) => m.id === client.sessionId)?.name ?? "?";
      try {
        netLog.write({ room: this.roomId, player }, { ...report, tick: this.tickCost.take() });
      } catch (err) {
        console.warn("[bombtop] net log", err);
      }
    });

    const stepMs = 1000 / TICK_RATE;
    const clock = new TickClock(stepMs, performance.now());
    this.setSimulationInterval(() => {
      const ticks = clock.due(performance.now());
      for (let i = 0; i < ticks; i++) {
        const t = performance.now();
        this.core.update();
        this.tickCost.add(performance.now() - t);
      }
    }, stepMs / 2);
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
    if (!this.core.join(client.sessionId, auth?.name ?? options?.name, options?.character)) {
      throw new Error("Sala cheia ou partida em andamento");
    }
  }

  onDrop(client: Client) {
    this.core.setConnected(client.sessionId, false);
    // Rejects at once when the client dropped mid-join or the room is closing:
    // left unhandled, that rejection would take the whole server down.
    this.allowReconnection(client, RECONNECT_SECONDS).catch(() => this.onLeave(client));
  }

  onReconnect(client: Client) {
    this.core.setConnected(client.sessionId, true);
  }

  onLeave(client: Client) {
    this.core.leave(client.sessionId);
  }
}
