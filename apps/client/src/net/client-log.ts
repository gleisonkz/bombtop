interface Store {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

/** The game server's /log, where pages report about themselves (deploy/vps/README.md). */
export function logUrl(server: string): string {
  return `${server.replace(/^ws/, "http").replace(/\/$/, "")}/log`;
}

const ALIVE_KEY = "bombtop.alive";

/** Where a page that died without closing was, and what it was doing. */
export interface Crashed {
  path: string;
  crumb: string;
  /** How long it had been open, ms. */
  age: number;
}

/**
 * Tells a crash from a page closed: the mark is set while the page is in front and taken off when it is closed or
 * sent to the background, so a mark found on opening means the last page died in front of the player (iOS kills a
 * page that uses too much memory, then shows "a problem repeatedly occurred").
 */
export class AliveMark {
  private mark = { path: "/", crumb: "boot", since: 0 };

  constructor(
    private readonly store: Store,
    private readonly now: () => number = Date.now,
  ) {}

  /** The page opened: returns the last one's, if it crashed. */
  start(path: string): Crashed | null {
    let crashed: Crashed | null = null;
    try {
      const was = JSON.parse(this.store.get(ALIVE_KEY) || "null") as typeof this.mark | null;
      if (was) crashed = { path: was.path, crumb: was.crumb, age: this.now() - was.since };
    } catch {
      /* not ours */
    }
    this.mark = { path, crumb: "boot", since: this.now() };
    this.save();
    return crashed;
  }

  /** What the page is doing now (menu, lobby, match…), and where (the address changes in a room). */
  crumb(text: string, path = this.mark.path): void {
    this.mark.crumb = text;
    this.mark.path = path;
    this.save();
  }

  /** Closed or hidden: whatever happens to it now is not a crash. */
  away(): void {
    this.store.set(ALIVE_KEY, "");
  }

  /** In front again. */
  back(): void {
    this.save();
  }

  private save(): void {
    this.store.set(ALIVE_KEY, JSON.stringify(this.mark));
  }
}

/** Errors one page sends at most (a loop throwing every frame would send thousands). */
const MAX_ERRORS = 10;

/** A page's events (boot, crash, error) for the server's log, each with what the page is. */
export class ClientLog {
  private readonly seen = new Set<string>();

  constructor(
    private readonly post: (event: object) => void,
    private readonly page: Record<string, string | number>,
  ) {}

  send(event: { kind: string } & Record<string, unknown>): void {
    this.post({ ...event, ...this.page });
  }

  error(msg: string, stack?: string): void {
    const key = `${msg}\n${stack ?? ""}`;
    if (this.seen.has(key) || this.seen.size >= MAX_ERRORS) return;
    this.seen.add(key);
    this.send({ kind: "error", msg, ...(stack ? { stack } : {}) });
  }
}

let alive: AliveMark | null = null;

/** Notes what the page is doing, for a crash report (no-op before startClientLog). */
export function crumb(text: string): void {
  alive?.crumb(text, location.pathname);
}

/**
 * Reports this page to the game server's log: that it opened (screen, device), that the last one crashed, and any
 * script error. Sent with sendBeacon as plain text: no CORS preflight, and it goes even as the page closes.
 */
export function startClientLog(server: string, version: string, store: Store): void {
  const url = logUrl(server);
  const post = (event: object): void => {
    try {
      const body = JSON.stringify(event);
      if (!navigator.sendBeacon?.(url, body)) void fetch(url, { method: "POST", body, keepalive: true, mode: "no-cors" }).catch(() => {});
    } catch {
      /* logging never breaks the game */
    }
  };
  const log = new ClientLog(post, { ua: navigator.userAgent.slice(0, 160), v: version.slice(0, 7) });
  alive = new AliveMark(store);
  const mark = alive;
  const crashed = mark.start(location.pathname);
  const dm = (navigator as { deviceMemory?: number }).deviceMemory;
  log.send({ kind: "boot", path: location.pathname, w: innerWidth, h: innerHeight, ...(dm ? { dm } : {}) });
  if (crashed) log.send({ kind: "crash", ...crashed });
  addEventListener("error", (e) => log.error(String(e.message), (e.error as Error | undefined)?.stack));
  addEventListener("unhandledrejection", (e) => {
    const reason = e.reason as { message?: string; stack?: string } | undefined;
    log.error(String(reason?.message ?? e.reason), reason?.stack);
  });
  addEventListener("pagehide", () => mark.away());
  addEventListener("pageshow", () => mark.back());
  document.addEventListener("visibilitychange", () => (document.hidden ? mark.away() : mark.back()));
}
