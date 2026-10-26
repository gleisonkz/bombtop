import { Room, type Client } from "@colyseus/core";
import { C2S, MAX_PLAYERS, MAX_WATCHERS, RoomCore, TickClock, TICK_RATE } from "@bombtop/shared";
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
  /** A screen joining only to watch (TV mode): no seat, any time. */
  watch?: boolean;
}

/** Thin Colyseus adapter around RoomCore. State is sent as messages, not Schema. */
export class BattleRoom extends Room {
  maxClients = MAX_PLAYERS + MAX_WATCHERS;
  private readonly core = new RoomCore(() => this.roomId, {
    send: (id, type, message) => this.clients.getById(id)?.send(type, message),
    broadcast: (type, message) => this.broadcast(type, message),
    phaseChanged: () => this.refreshListing(),
    seatsChanged: () => this.refreshListing(),
  });
  /** Created private (a room with friends): never matched publicly. */
  private privateRoom = false;
  private hidden = false;
  /** Who joined to watch (not held for on a drop: they just join again). */
  private readonly watchers = new Set<string>();

  private readonly tickCost = new TickCost();

  async onCreate(options: BattleRoomOptions) {
    this.privateRoom = !!options?.private;
    if (this.privateRoom) await this.setPrivate(true);
    this.hidden = this.privateRoom;
    this.setPatchRate(null);

    for (const type of [C2S.input, C2S.sync, C2S.addBot, C2S.removeBot, C2S.character, C2S.start, C2S.rules, C2S.beat]) {
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
    if (options?.watch) {
      if (!this.core.watch(client.sessionId)) throw new Error("Já tem telas demais assistindo esta sala");
      this.watchers.add(client.sessionId);
      return;
    }
    const auth = client.auth as Partial<AuthUser> | undefined;
    if (!this.core.join(client.sessionId, auth?.name ?? options?.name, options?.character)) {
      throw new Error("Sala cheia ou partida em andamento");
    }
    this.refreshListing();
  }

  /**
   * Out of public matchmaking while a match runs or every seat is taken (bots take seats too), but never
   * locked: a TV can still join by code to watch.
   */
  private refreshListing(): void {
    const s = this.core.session;
    const hide = this.privateRoom || s.phase !== "lobby" || s.members.length >= MAX_PLAYERS;
    if (hide === this.hidden) return;
    this.hidden = hide;
    void this.setPrivate(hide);
  }

  onDrop(client: Client) {
    // A watcher is not held for: Colyseus calls onLeave next (no seat to keep).
    if (this.watchers.has(client.sessionId)) return;
    this.core.setConnected(client.sessionId, false);
    // Rejects at once when the client dropped mid-join or the room is closing:
    // left unhandled, that rejection would take the whole server down.
    this.allowReconnection(client, RECONNECT_SECONDS).catch(() => this.onLeave(client));
  }

  onReconnect(client: Client) {
    this.core.setConnected(client.sessionId, true);
  }

  onLeave(client: Client) {
    this.watchers.delete(client.sessionId);
    this.core.leave(client.sessionId);
    this.refreshListing();
  }
}
