import { MAX_PLAYERS, RoomCore, TICK_RATE } from "@bombtop/shared";
import type { LanRoomInfo } from "./lan";
import { worstRoute, type Route } from "./rtc-route";
import type { RoomLink } from "./room-link";
import { TickClock } from "../loop/tick-clock";

/** An ordered, reliable text pipe to one other phone (a WebRTC data channel). */
export interface Wire {
  send(data: string): void;
  onMessage(callback: (data: string) => void): void;
  onClose(callback: () => void): void;
  close(): void;
  /** Which way the connection runs (a WebRTC data channel tells; see rtc-route.ts). */
  route?(): Promise<Route | null>;
}

/** Wire messages besides the room's own (C2S/S2C) ones. */
const JOIN = "~join";
const WELCOME = "~welcome";
const PING = "~ping";
const PONG = "~pong";

/** Code shown for an offline room (there is no server to look it up on). */
export const OFFLINE_CODE = "offline";

type Handlers = Map<string, ((message: unknown) => void)[]>;

function dispatch(handlers: Handlers, type: string, message: unknown): void {
  for (const cb of handlers.get(type) ?? []) cb(message);
}

function listen(handlers: Handlers, type: string, cb: (message: unknown) => void): void {
  handlers.set(type, [...(handlers.get(type) ?? []), cb]);
}

/**
 * Offline play: this phone runs the room (RoomCore, the same code as the server)
 * for friends nearby, each connected over a Wire. The host itself plays through
 * hostLink(), a link that never leaves the phone.
 */
export class LocalHost {
  readonly core: RoomCore;
  private readonly links = new Map<string, (type: string, message: unknown) => void>();
  private readonly wires = new Map<string, Wire>();
  private seq = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  private closed = false;
  private closeListeners: (() => void)[] = [];

  constructor() {
    this.core = new RoomCore(OFFLINE_CODE, {
      send: (id, type, message) => this.links.get(id)?.(type, message),
      broadcast: (type, message) => {
        for (const deliver of this.links.values()) deliver(type, message);
      },
    });
  }

  /** The host's own seat. Starts the room's clock; leaving it closes the room. */
  hostLink(name: string, character: string): RoomLink {
    const link = this.localLink(name, character, () => this.close())!;
    this.run();
    return link;
  }

  /**
   * Another player on this same screen (couch play: one per controller), or null when the room is
   * full or playing. Leaving frees the seat; the room goes on.
   */
  seat(name: string, character: string): RoomLink | null {
    return this.localLink(name, character, (id) => {
      this.links.delete(id);
      this.core.leave(id);
    });
  }

  /** A seat whose messages never leave this device. */
  private localLink(name: string, character: string, left: (id: string) => void): RoomLink | null {
    const id = `p${++this.seq}`;
    const handlers: Handlers = new Map();
    const leaveHandlers: ((code: number) => void)[] = [];
    // Delivered a moment later, like a network would: handlers attached right after still get it.
    this.links.set(id, (type, message) => queueMicrotask(() => dispatch(handlers, type, message)));
    if (!this.core.join(id, name, character)) {
      this.links.delete(id);
      return null;
    }
    return {
      sessionId: id,
      roomId: OFFLINE_CODE,
      reconnectionToken: "",
      send: (type, message) => queueMicrotask(() => this.core.message(id, type, message)),
      onMessage: (type, cb) => listen(handlers, type, cb),
      onLeave: (cb) => leaveHandlers.push(cb),
      ping: (cb) => cb(0),
      // on this device: the friends' connections are what count
      route: () => Promise.all([...this.wires.values()].map((w) => w.route?.() ?? null)).then(worstRoute),
      leave: async () => {
        left(id);
        for (const cb of leaveHandlers) cb(1000);
      },
    };
  }

  /** A friend's wire: they join with their first message. */
  addPeer(wire: Wire): void {
    let id: string | null = null;
    wire.onMessage((data) => {
      const [type, message] = JSON.parse(data) as [string, unknown];
      if (type === PING) return wire.send(JSON.stringify([PONG, message]));
      if (type === JOIN) {
        if (id) return;
        const { name, character } = (message ?? {}) as { name?: unknown; character?: unknown };
        const newId = `p${++this.seq}`;
        this.links.set(newId, (t, m) => wire.send(JSON.stringify([t, m])));
        if (!this.core.join(newId, name, character)) {
          this.links.delete(newId);
          return wire.close();
        }
        id = newId;
        this.wires.set(id, wire);
        return wire.send(JSON.stringify([WELCOME, id]));
      }
      if (id) this.core.message(id, type, message);
    });
    wire.onClose(() => {
      if (!id || !this.links.has(id)) return;
      this.links.delete(id);
      this.wires.delete(id);
      this.core.leave(id);
    });
  }

  /** One simulation tick (the clock calls it TICK_RATE times a second). */
  tick(): void {
    this.core.update();
  }

  /** Called once the room is closed. */
  onClose(cb: () => void): void {
    this.closeListeners.push(cb);
  }

  /** What the room's listing on the server shows (net/lan.ts), as hosted by `name`. */
  listing(name: string): LanRoomInfo {
    const { members, phase } = this.core.session;
    return { name, players: members.length, max: MAX_PLAYERS, playing: phase !== "lobby" };
  }

  /** Ends the room: every friend is let go. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const cb of this.closeListeners) cb();
    clearInterval(this.timer);
    this.links.clear();
    for (const wire of this.wires.values()) wire.close();
    this.wires.clear();
  }

  private run(): void {
    if (this.timer !== undefined || typeof window === "undefined") return;
    // Keeps real time: after a slow frame the owed ticks are played a few per call, not in one freeze.
    const step = 1000 / TICK_RATE;
    const clock = new TickClock(step, performance.now());
    this.timer = setInterval(() => {
      for (let n = clock.due(performance.now()); n > 0; n--) this.tick();
    }, step / 2);
  }
}

/** A friend's end of an offline room: talks to the host's phone over a Wire. */
export class PeerLink implements RoomLink {
  readonly roomId = OFFLINE_CODE;
  readonly reconnectionToken = "";
  private readonly handlers: Handlers = new Map();
  private readonly leaveHandlers: ((code: number) => void)[] = [];
  private pings = new Map<number, (ms: number) => void>();
  private pingSeq = 0;
  private gone = false;

  private constructor(
    private readonly wire: Wire,
    readonly sessionId: string,
  ) {
    wire.onMessage((data) => {
      const [type, message] = JSON.parse(data) as [string, unknown];
      if (type === PONG) {
        const [n, sent] = message as [number, number];
        this.pings.get(n)?.(Math.round(performance.now() - sent));
        this.pings.delete(n);
        return;
      }
      dispatch(this.handlers, type, message);
    });
    wire.onClose(() => this.ended());
  }

  /** Asks the host for a seat; resolves once it is given. */
  static join(wire: Wire, name: string, character: string): Promise<PeerLink> {
    return new Promise((resolve, reject) => {
      wire.onMessage((data) => {
        const [type, message] = JSON.parse(data) as [string, unknown];
        if (type === WELCOME) resolve(new PeerLink(wire, String(message)));
      });
      wire.onClose(() => reject(new Error("A sala não aceitou (cheia ou em partida).")));
      wire.send(JSON.stringify([JOIN, { name, character }]));
    });
  }

  send(type: string, message?: unknown): void {
    if (!this.gone) this.wire.send(JSON.stringify([type, message]));
  }

  onMessage(type: string, callback: (message: any) => void): void {
    listen(this.handlers, type, callback);
  }

  onLeave(callback: (code: number) => void): void {
    this.leaveHandlers.push(callback);
  }

  ping(callback: (ms: number) => void): void {
    const n = ++this.pingSeq;
    this.pings.set(n, callback);
    this.wire.send(JSON.stringify([PING, [n, performance.now()]]));
  }

  route(): Promise<Route | null> {
    return this.wire.route?.() ?? Promise.resolve(null);
  }

  async leave(): Promise<void> {
    this.wire.close();
    this.ended();
  }

  private ended(): void {
    if (this.gone) return;
    this.gone = true;
    for (const cb of this.leaveHandlers) cb(1000);
  }
}
