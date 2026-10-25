import { randomBytes } from "node:crypto";
import { MAX_PLAYERS } from "@bombtop/shared";

/**
 * Offline (Wi-Fi) rooms, introduced through the server: a host's phone lists its room here, and a friend's phone
 * finds it (on the same network: same public address) or opens its link, then the two swap their WebRTC
 * descriptions through it. The match itself never touches the server: it runs on the host's phone, straight over
 * the Wi-Fi. Without internet the phones still pair by two QR codes (ui/pairing.ts).
 */
export interface LanRoomInfo {
  name: string;
  players: number;
  max: number;
  playing: boolean;
}

export interface Knock {
  ticket: string;
  offer: string;
}

interface Room extends LanRoomInfo {
  id: string;
  key: string;
  net: string;
  seen: number;
  knocks: Knock[];
}

interface Ticket {
  room: string;
  answer: string | null;
  at: number;
}

/** A room whose host has not beaten for this long is gone (hosts beat every second or so). */
const ROOM_TTL = 15_000;
/** A knock nobody answered is gone after this long. */
const TICKET_TTL = 30_000;
const MAX_ROOMS_PER_NET = 8;
const MAX_KNOCKS = 20;
/** A description with its candidates is a few kB; anything far longer is not one. */
const MAX_SDP = 16_000;
const NAME_MAX = 24;
/** Room ids: easy to say aloud, no 0/O or 1/I. */
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function clean(info: Partial<Record<keyof LanRoomInfo, unknown>>): LanRoomInfo {
  const count = (v: unknown, max: number, fallback: number) =>
    typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max ? v : fallback;
  const max = count(info.max, MAX_PLAYERS, MAX_PLAYERS) || MAX_PLAYERS;
  return {
    name: typeof info.name === "string" ? info.name.trim().slice(0, NAME_MAX) : "",
    players: count(info.players, max, 0),
    max,
    playing: info.playing === true,
  };
}

function sdp(text: unknown): text is string {
  return typeof text === "string" && text.length > 0 && text.length <= MAX_SDP;
}

export class LanDirectory {
  private readonly rooms = new Map<string, Room>();
  private readonly tickets = new Map<string, Ticket>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly random: (n: number) => Buffer = randomBytes,
  ) {}

  /** A host opens its room on network `net`; null when that network has too many. */
  open(net: string, info: Partial<Record<keyof LanRoomInfo, unknown>>): { id: string; key: string } | null {
    this.sweep();
    const mine = [...this.rooms.values()].filter((r) => r.net === net);
    if (mine.length >= MAX_ROOMS_PER_NET) this.rooms.delete(mine.sort((a, b) => a.seen - b.seen)[0]!.id);
    let id = "";
    do id = [...this.random(4)].map((b) => LETTERS[b % LETTERS.length]).join("");
    while (this.rooms.has(id));
    const key = this.random(16).toString("hex");
    this.rooms.set(id, { ...clean(info), id, key, net, seen: this.now(), knocks: [] });
    return { id, key };
  }

  /** Rooms open on network `net`. */
  list(net: string): ({ id: string } & LanRoomInfo)[] {
    this.sweep();
    return [...this.rooms.values()]
      .filter((r) => r.net === net)
      .map(({ id, name, players, max, playing }) => ({ id, name, players, max, playing }));
  }

  /** The host is still there (with the room's news): hands it the friends knocking since. Null: no such room. */
  beat(id: string, key: string, info: Partial<Record<keyof LanRoomInfo, unknown>>): Knock[] | null {
    this.sweep();
    const room = this.own(id, key);
    if (!room) return null;
    Object.assign(room, clean({ ...info, name: typeof info.name === "string" ? info.name : room.name }), { seen: this.now() });
    const knocks = room.knocks;
    room.knocks = [];
    return knocks;
  }

  /** A friend asks in with their offer; their ticket, or null (no such room, or junk). */
  knock(id: string, offer: unknown): string | null {
    this.sweep();
    const room = this.rooms.get(id);
    if (!room || !sdp(offer) || room.knocks.length >= MAX_KNOCKS) return null;
    const ticket = this.random(12).toString("hex");
    this.tickets.set(ticket, { room: id, answer: null, at: this.now() });
    room.knocks.push({ ticket, offer });
    return ticket;
  }

  /** The host's answer to a knock. */
  answer(id: string, key: string, ticket: string, answer: unknown): boolean {
    const t = this.tickets.get(ticket);
    if (!this.own(id, key) || !t || t.room !== id || !sdp(answer)) return false;
    t.answer = answer;
    return true;
  }

  /** The host's answer, null while it has not come, undefined when the ticket is gone. */
  reply(ticket: string): string | null | undefined {
    this.sweep();
    return this.tickets.get(ticket)?.answer;
  }

  close(id: string, key: string): boolean {
    if (!this.own(id, key)) return false;
    this.rooms.delete(id);
    return true;
  }

  private own(id: string, key: string): Room | null {
    const room = this.rooms.get(id);
    return room && room.key === key ? room : null;
  }

  private sweep(): void {
    const now = this.now();
    for (const [id, r] of this.rooms) if (now - r.seen > ROOM_TTL) this.rooms.delete(id);
    for (const [t, k] of this.tickets) if (now - k.at > TICKET_TTL || !this.rooms.has(k.room)) this.tickets.delete(t);
  }
}

interface Request extends AsyncIterable<Buffer | string> {
  headers: Record<string, string | string[] | undefined>;
  socket: { remoteAddress?: string };
  params: { op?: string };
}
interface Response {
  writeHead(status: number, headers: Record<string, string>): unknown;
  end(body?: string): void;
}

const MAX_BODY = 40_000;
/** Most calls one address may make a minute: a host beats once a second, a friend polls for an answer. */
const PER_MINUTE = 300;

/**
 * POST /lan/<op> (open, rooms, beat, knock, answer, reply, close): JSON sent as plain text, so no CORS preflight.
 * The network a phone is on is the address it reaches us from (Caddy's X-Forwarded-For).
 */
export function lanRoute(dir: LanDirectory, now: () => number = Date.now) {
  let window = 0;
  let counts = new Map<string, number>();
  return async (req: Request, res: Response): Promise<void> => {
    const reply = (status: number, body?: unknown) => {
      res.writeHead(status, { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" });
      res.end(body === undefined ? "" : JSON.stringify(body));
    };
    const forwarded = req.headers["x-forwarded-for"];
    const net = (typeof forwarded === "string" ? forwarded.split(",")[0]!.trim() : req.socket.remoteAddress) ?? "?";
    if (now() - window >= 60_000) {
      window = now();
      counts = new Map();
    }
    const n = counts.get(net) ?? 0;
    if (n >= PER_MINUTE) return reply(429);
    counts.set(net, n + 1);
    let text = "";
    for await (const chunk of req) {
      text += chunk.toString();
      if (text.length > MAX_BODY) return reply(413);
    }
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(text || "{}");
      if (typeof body !== "object" || body === null) throw new Error();
    } catch {
      return reply(400);
    }
    const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string) : "");
    switch (req.params.op) {
      case "open": {
        const opened = dir.open(net, body);
        return opened ? reply(200, opened) : reply(429);
      }
      case "rooms":
        return reply(200, dir.list(net));
      case "beat": {
        const knocks = dir.beat(str("id"), str("key"), body);
        return knocks ? reply(200, knocks) : reply(404);
      }
      case "knock": {
        const ticket = dir.knock(str("id"), body.offer);
        return ticket ? reply(200, { ticket }) : reply(404);
      }
      case "answer":
        return dir.answer(str("id"), str("key"), str("ticket"), body.answer) ? reply(200, {}) : reply(404);
      case "reply": {
        const answer = dir.reply(str("ticket"));
        return answer === undefined ? reply(404) : reply(200, { answer });
      }
      case "close":
        return dir.close(str("id"), str("key")) ? reply(200, {}) : reply(404);
      default:
        return reply(404);
    }
  };
}
