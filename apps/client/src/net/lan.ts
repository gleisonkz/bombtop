/**
 * Offline (Wi-Fi) rooms found through the game server (apps/server/src/lan.ts): the host's phone lists its room
 * there and answers whoever knocks, a friend's phone lists the rooms on its network (or opens the room's link) and
 * knocks with its WebRTC offer. Only that handshake goes through the server; the match runs phone to phone.
 * With no internet nothing here works, and the phones pair by two QR codes instead (ui/pairing.ts).
 */
export type LanPost = (op: string, body: object) => Promise<{ status: number; json: any }>;

export interface LanRoomInfo {
  name: string;
  players: number;
  max: number;
  playing: boolean;
}

export interface LanRoom extends LanRoomInfo {
  id: string;
}

/** POST /lan/<op> on the game server (plain text: no CORS preflight); status 0 when it can't be reached. */
export function lanPost(server: string, fetcher: typeof fetch = fetch): LanPost {
  const base = `${server.replace(/^ws/, "http").replace(/\/$/, "")}/lan/`;
  return async (op, body) => {
    try {
      const res = await fetcher(base + op, { method: "POST", body: JSON.stringify(body) });
      const text = await res.text();
      return { status: res.status, json: text ? JSON.parse(text) : null };
    } catch {
      return { status: 0, json: null };
    }
  };
}

/** Rooms open on this phone's network (none when the server can't be reached). */
export async function lanRooms(post: LanPost): Promise<LanRoom[]> {
  const { status, json } = await post("rooms", {});
  return status === 200 && Array.isArray(json) ? json : [];
}

/** How often the host tells the server it is still there (and picks up knocks). */
const BEAT_MS = 1000;

/**
 * The host's side: keeps its room listed while the room is open and answers every knock with `answer`
 * (which connects that friend). `id` is the room's code, null while the server can't be reached.
 */
export class LanBeacon {
  id: string | null = null;
  private key = "";
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopped = false;
  private listeners: ((id: string | null) => void)[] = [];

  constructor(
    private readonly post: LanPost,
    private readonly info: () => LanRoomInfo,
    private readonly answer: (offer: string) => Promise<string>,
  ) {}

  /** Called with the room's code each time it is known again (null: not listed). */
  onChange(cb: (id: string | null) => void): void {
    this.listeners.push(cb);
  }

  async start(): Promise<void> {
    await this.open();
    this.next();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    clearTimeout(this.timer);
    if (this.id) await this.post("close", { id: this.id, key: this.key });
    this.id = null;
  }

  private async open(): Promise<void> {
    const { status, json } = await this.post("open", this.info());
    if (this.stopped) return;
    const was = this.id;
    if (status === 200 && json?.id) {
      this.id = json.id;
      this.key = json.key;
    } else this.id = null;
    if (this.id !== was || this.id === null) for (const cb of this.listeners) cb(this.id);
  }

  private next(): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => void this.beat().finally(() => this.next()), BEAT_MS);
  }

  private async beat(): Promise<void> {
    if (!this.id) return this.open();
    const id = this.id;
    const key = this.key;
    const { status, json } = await this.post("beat", { id, key, ...this.info() });
    if (this.stopped) return;
    if (status === 404) return this.open();
    if (status !== 200 || !Array.isArray(json)) return;
    for (const { ticket, offer } of json as { ticket: string; offer: string }[]) {
      void this.answer(offer)
        .then((answer) => this.post("answer", { id, key, ticket, answer }))
        .catch((err) => console.warn("[lan] knock", err));
    }
  }
}

const POLL_MS = 500;
/** How long a friend waits for the host to answer. */
const KNOCK_WAIT_MS = 20_000;

/** A friend's side: knocks on room `id` with its offer and resolves with the host's answer. */
export async function lanKnock(post: LanPost, id: string, offer: string): Promise<string> {
  const knocked = await post("knock", { id, offer });
  if (knocked.status === 0) throw new Error("Sem conexão com o servidor (precisa de internet pra achar a sala)");
  if (knocked.status !== 200) throw new Error("Sala não encontrada (fechou?)");
  const ticket = knocked.json.ticket as string;
  for (let waited = 0; waited < KNOCK_WAIT_MS; waited += POLL_MS) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    const { status, json } = await post("reply", { ticket });
    if (status === 404) throw new Error("Sala não encontrada (fechou?)");
    if (status === 200 && json?.answer) return json.answer as string;
  }
  throw new Error("A sala não respondeu");
}
