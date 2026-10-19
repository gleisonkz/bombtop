import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/** What a ?debug client measured over the last few seconds. */
export interface NetReport {
  ping?: number;
  delay?: number;
  fps?: number;
  late?: number;
  gap?: number;
  ua?: string;
}

const LIMITS: Record<Exclude<keyof NetReport, "ua">, number> = { ping: 10_000, delay: 10_000, fps: 1000, late: 100_000, gap: 60_000 };
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
  return Object.keys(out).length ? out : null;
}

/** Connection reports from ?debug clients, one JSON line each, in a file per day (read over SSH). */
export class NetLog {
  private last = new Map<string, number>();

  constructor(
    private readonly dir: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Rate limit per player, so a client cannot flood the disk. */
  allow(id: string): boolean {
    const t = this.now().getTime();
    const prev = this.last.get(id);
    if (prev !== undefined && t - prev < MIN_GAP_MS) return false;
    this.last.set(id, t);
    return true;
  }

  write(who: { room: string; player: string }, report: NetReport): void {
    const t = this.now().toISOString();
    mkdirSync(this.dir, { recursive: true });
    appendFileSync(join(this.dir, `net-${t.slice(0, 10)}.jsonl`), JSON.stringify({ t, ...who, ...report }) + "\n");
  }
}
