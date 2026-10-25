import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/** What a ?debug client measured over the last few seconds. */
export interface NetReport {
  ping?: number;
  delay?: number;
  fps?: number;
  late?: number;
  gap?: number;
  /** Longest frame, ms: the device itself froze. */
  slow?: number;
  /** Frames drawn with no newer snapshot, over the whole report period. */
  missed?: number;
  /** Most CPU time the client's own code spent on one frame, tenths of a ms. */
  work?: number;
  /** Biggest jump between two frames, hundredths of a tile: our player, the others. */
  jumpMe?: number;
  jumpOthers?: number;
  /** The page's script memory, MB (Chrome only), and the device's memory, GB. */
  mem?: number;
  dm?: number;
  ua?: string;
  /** An offline (Wi-Fi) match: whether the phones talk straight over the Wi-Fi or through the internet. */
  route?: "wifi" | "internet";
  /** Set by the server, never taken from the client: its slowest simulation tick, tenths of a ms. */
  tick?: number;
}

const LIMITS: Record<Exclude<keyof NetReport, "ua" | "tick" | "route">, number> = { ping: 10_000, delay: 10_000, fps: 1000, late: 100_000, gap: 60_000, slow: 60_000, missed: 100_000, work: 600_000, jumpMe: 10_000, jumpOthers: 10_000, mem: 100_000, dm: 1024 };
const UA_MAX = 120;
const MIN_GAP_MS = 2000;

/** The client's report, with only sane numbers kept; null when nothing is usable. */
export function netReport(message: unknown): NetReport | null {
  if (typeof message !== "object" || message === null) return null;
  const m = message as Record<string, unknown>;
  const out: NetReport = {};
  for (const [k, max] of Object.entries(LIMITS) as [keyof typeof LIMITS, number][]) {
    const v = m[k];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max) out[k] = v;
  }
  if (typeof m.ua === "string") out.ua = m.ua.slice(0, UA_MAX);
  if (m.route === "wifi" || m.route === "internet") out.route = m.route;
  return Object.keys(out).length ? out : null;
}

/** Reports from clients, one JSON line each, in a file per day named `<prefix>-<date>.jsonl` (read over SSH). */
export class NetLog {
  private last = new Map<string, number>();

  constructor(
    private readonly dir: string,
    private readonly now: () => Date = () => new Date(),
    private readonly prefix = "net",
  ) {}

  /** Rate limit per player, so a client cannot flood the disk. */
  allow(id: string): boolean {
    const t = this.now().getTime();
    const prev = this.last.get(id);
    if (prev !== undefined && t - prev < MIN_GAP_MS) return false;
    this.last.set(id, t);
    return true;
  }

  write(who: Record<string, string>, report: object): void {
    const t = this.now().toISOString();
    mkdirSync(this.dir, { recursive: true });
    appendFileSync(join(this.dir, `${this.prefix}-${t.slice(0, 10)}.jsonl`), JSON.stringify({ t, ...who, ...report }) + "\n");
  }
}

/** The room's slowest simulation tick since its last report: tells server stalls apart from the network. */
export class TickCost {
  private worst = 0;

  add(ms: number): void {
    this.worst = Math.max(this.worst, ms);
  }

  /** Tenths of a ms; starts the window over. */
  take(): number {
    const out = Math.round(this.worst * 10);
    this.worst = 0;
    return out;
  }
}

interface Request extends AsyncIterable<Buffer | string> {
  headers: Record<string, string | string[] | undefined>;
  socket: { remoteAddress?: string };
}
interface Response {
  writeHead(status: number, headers: Record<string, string>): unknown;
  end(): void;
}

/** Reports one address may send a minute (an offline match's phones each send one every 5 s). */
const OFFLINE_PER_MINUTE = 30;
const MAX_BODY = 4096;

/**
 * POST /net: an offline (Wi-Fi) match has no room here, so its phones send their connection reports over HTTP (when
 * they have internet), logged beside the online ones as room `wifi:<code>`.
 */
export function offlineNetRoute(log: { write(who: Record<string, string>, report: object): void }, now: () => number = Date.now) {
  let window = 0;
  let counts = new Map<string, number>();
  return async (req: Request, res: Response): Promise<void> => {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*" });
    res.end();
    const forwarded = req.headers["x-forwarded-for"];
    const ip = (typeof forwarded === "string" ? forwarded.split(",")[0]!.trim() : req.socket.remoteAddress) ?? "?";
    if (now() - window >= 60_000) {
      window = now();
      counts = new Map();
    }
    let body = "";
    for await (const chunk of req) {
      body += chunk.toString();
      if (body.length > MAX_BODY) return;
    }
    let m: Record<string, unknown>;
    try {
      m = JSON.parse(body);
    } catch {
      return;
    }
    const report = netReport(m);
    const n = counts.get(ip) ?? 0;
    if (!report || n >= OFFLINE_PER_MINUTE) return;
    counts.set(ip, n + 1);
    const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "?");
    try {
      log.write({ room: `wifi:${text(m.room, 16)}`, player: text(m.player, 24) }, report);
    } catch (err) {
      console.warn("[bombtop] offline net log", err);
    }
  };
}
