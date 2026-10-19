interface Store {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

const KEY = "bombtop.seat";

/**
 * This tab's seat in a room (sessionStorage in the browser): reloading the room page
 * reconnects to the same seat instead of joining as a second player.
 */
export class SeatMemory {
  constructor(private readonly store: Store) {}

  remember(code: string, token: string): void {
    this.store.set(KEY, JSON.stringify({ code, token }));
  }

  tokenFor(code: string): string | null {
    try {
      const seat = JSON.parse(this.store.get(KEY) ?? "null") as { code?: unknown; token?: unknown } | null;
      return seat?.code === code && typeof seat.token === "string" ? seat.token : null;
    } catch {
      return null;
    }
  }

  forget(): void {
    this.store.remove(KEY);
  }
}

/** sessionStorage, quietly empty where it is blocked. */
export const tabStore: Store = {
  get: (k) => {
    try {
      return sessionStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      sessionStorage.setItem(k, v);
    } catch {
      /* private mode: no reload rejoin */
    }
  },
  remove: (k) => {
    try {
      sessionStorage.removeItem(k);
    } catch {
      /* nothing stored */
    }
  },
};
