import { execSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Replay } from "@bombtop/shared";

/** The game's commit (the server runs from a git checkout); a replay plays back exactly only on it. */
export function gitCommit(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "dev";
  }
}

/**
 * Every round played, kept to be played back when a bug turns up (`pnpm -C packages/shared replay <file>`): one
 * JSON file each under `<dir>/replays/<date>/<time>-<room>-r<round>.json`, days older than `keepDays` dropped.
 */
export class ReplayLog {
  private pruned = "";

  constructor(
    private readonly dir: string,
    private readonly now: () => Date = () => new Date(),
    private readonly commit: string = gitCommit(),
    private readonly keepDays = 30,
  ) {}

  write(room: string, replay: Replay, commit = this.commit): string {
    const t = this.now().toISOString();
    const day = t.slice(0, 10);
    const folder = join(this.dir, "replays", day);
    mkdirSync(folder, { recursive: true });
    const file = join(folder, `${t.slice(11, 19).replaceAll(":", "")}-${safe(room)}-r${replay.round}.json`);
    writeFileSync(file, JSON.stringify({ t, room, commit, ...replay }));
    if (this.pruned !== day) this.prune(day);
    return file;
  }

  private prune(today: string): void {
    this.pruned = today;
    const oldest = new Date(Date.parse(today) - this.keepDays * 86_400_000).toISOString().slice(0, 10);
    for (const day of readdirSync(join(this.dir, "replays"))) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(day) && day < oldest) rmSync(join(this.dir, "replays", day), { recursive: true, force: true });
    }
  }
}

const safe = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24) || "room";

/** Looks like a replay (the shape `replayMatch` reads), or null. */
function replayOf(r: unknown): Replay | null {
  if (!r || typeof r !== "object") return null;
  const x = r as Partial<Replay>;
  const ok = x.v === 1 && typeof x.options?.seed === "number" && Array.isArray(x.players) && Array.isArray(x.inputs)
    && Array.isArray(x.pressure) && Array.isArray(x.leaves) && Number.isInteger(x.ticks) && Number.isInteger(x.round);
  return ok ? (x as Replay) : null;
}

const MAX_BODY = 4_000_000;
const PER_MINUTE = 30;

interface Request extends AsyncIterable<Buffer | string> {
  headers: Record<string, string | string[] | undefined>;
  socket: { remoteAddress?: string };
}
interface Response {
  writeHead(status: number, headers: Record<string, string>): unknown;
  end(): void;
}

/** POST /replay: a round played in a browser (offline or couch play: no server ran it) sends its replay here. */
export function replayRoute(log: ReplayLog, now: () => number = Date.now) {
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
    let msg: { room?: unknown; v?: unknown; replay?: unknown };
    try {
      msg = JSON.parse(body);
    } catch {
      return;
    }
    const replay = replayOf(msg?.replay);
    const n = counts.get(ip) ?? 0;
    if (!replay || n >= PER_MINUTE) return;
    counts.set(ip, n + 1);
    try {
      log.write(typeof msg.room === "string" ? msg.room : "offline", replay, typeof msg.v === "string" ? msg.v.slice(0, 40) : "?");
    } catch (err) {
      console.warn("[bombtop] replay", err);
    }
  };
}
