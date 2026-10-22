/**
 * What a page reports about itself, with no room needed: it opened, it crashed last time, a script failed, it caught
 * and logged a failure (console), or its main thread stopped (freeze) and came back (unfreeze).
 */
export interface ClientEvent {
  kind: "boot" | "crash" | "error" | "console" | "freeze" | "unfreeze";
  /** The address it was on (/sala/<code>, /tv/<code>, /). */
  path?: string;
  /** What it was doing last (menu, lobby, match…), for a crash. */
  crumb?: string;
  /** How long the crashed page had been open, ms. */
  age?: number;
  msg?: string;
  stack?: string;
  /** console.error or console.warn. */
  level?: string;
  /** How long the main thread had been stuck, ms. */
  ms?: number;
  ua?: string;
  /** The client's build. */
  v?: string;
  /** Screen size, CSS pixels. */
  w?: number;
  h?: number;
  /** The device's memory, GB (Chrome only). */
  dm?: number;
}

const KINDS = new Set(["boot", "crash", "error", "console", "freeze", "unfreeze"]);
const TEXT: Record<"path" | "crumb" | "msg" | "stack" | "level" | "ua" | "v", number> = {
  path: 80, crumb: 80, msg: 300, stack: 1000, level: 10, ua: 160, v: 20,
};
const NUMBERS: Record<"age" | "ms" | "w" | "h" | "dm", number> = {
  age: 7 * 24 * 3600_000, ms: 24 * 3600_000, w: 20_000, h: 20_000, dm: 1024,
};

/** The page's report, with only sane fields kept; null when it is not one. */
export function clientEvent(message: unknown): ClientEvent | null {
  if (typeof message !== "object" || message === null) return null;
  const m = message as Record<string, unknown>;
  if (typeof m.kind !== "string" || !KINDS.has(m.kind)) return null;
  const out: Record<string, unknown> = { kind: m.kind };
  for (const [k, max] of Object.entries(TEXT)) if (typeof m[k] === "string") out[k] = (m[k] as string).slice(0, max);
  for (const [k, max] of Object.entries(NUMBERS)) {
    const v = m[k];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max) out[k] = v;
  }
  return out as unknown as ClientEvent;
}

/** Most events one address may log a minute, so nobody can flood the disk. */
const PER_MINUTE = 20;
const MAX_BODY = 4096;

interface Request extends AsyncIterable<Buffer | string> {
  headers: Record<string, string | string[] | undefined>;
  socket: { remoteAddress?: string };
}
interface Response {
  writeHead(status: number, headers: Record<string, string>): unknown;
  end(): void;
}

/**
 * POST /log: pages send their events with sendBeacon (plain text, so no CORS preflight), even ones that never
 * reach a room, and they land in `client-<date>.jsonl` beside the connection reports.
 */
export function logRoute(log: { write(who: Record<string, string>, event: object): void }, now: () => number = Date.now) {
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
    let event: ClientEvent | null = null;
    try {
      event = clientEvent(JSON.parse(body));
    } catch {
      return;
    }
    const n = counts.get(ip) ?? 0;
    if (!event || n >= PER_MINUTE) return;
    counts.set(ip, n + 1);
    try {
      log.write({ ip }, event);
    } catch (err) {
      console.warn("[bombtop] client log", err);
    }
  };
}
