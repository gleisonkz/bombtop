/** A freeze found (the page's beats stopped) or over (they came back), with how long the page had been stuck. */
export interface FreezeEvent {
  kind: "freeze" | "unfreeze";
  ms: number;
  crumb: string;
  path: string;
}

/** Freezes one page reports at most (a page that stalls every few seconds would send hundreds). */
const MAX_FREEZES = 5;

/**
 * Runs in a worker, which keeps going while the page's own thread is stuck: the page beats about once a second, and
 * beats that stop for `limit` ms while the page is in front mean it froze. A page that never comes back still gets
 * reported, and one that does says how long it was stuck.
 */
export class FreezeWatch {
  private last = 0;
  private lastCheck: number | null = null;
  private watching = false;
  private frozen = false;
  /** This freeze was reported, so its end is too. */
  private told = false;
  private freezes = 0;
  private crumb = "boot";
  private path = "/";

  constructor(private readonly limit = 5000) {}

  /** The page is alive, doing `crumb`. */
  beat(now: number, crumb: string, path: string): FreezeEvent | null {
    const back: FreezeEvent | null = this.told ? { kind: "unfreeze", ms: now - this.last, crumb: this.crumb, path: this.path } : null;
    this.frozen = this.told = false;
    this.watching = true;
    this.last = now;
    this.crumb = crumb;
    this.path = path;
    return back;
  }

  /** Closed or in the background: its timers slow down there, which is not a freeze. */
  away(): void {
    this.watching = false;
    this.frozen = this.told = false;
  }

  /** Called about once a second. */
  check(now: number): FreezeEvent | null {
    // Our own checks stopped too: the whole device slept, not the page.
    const slept = this.lastCheck !== null && now - this.lastCheck >= this.limit;
    this.lastCheck = now;
    if (slept) this.last = now;
    if (!this.watching || this.frozen || now - this.last < this.limit) return null;
    this.frozen = true;
    if (this.freezes >= MAX_FREEZES) return null;
    this.freezes++;
    this.told = true;
    return { kind: "freeze", ms: now - this.last, crumb: this.crumb, path: this.path };
  }
}
