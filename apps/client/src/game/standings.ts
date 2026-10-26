/** A player's place at the end of a match; players out on the same tick share it. */
export interface Placing {
  id: string;
  place: number;
}

/** Watches who goes out when, from the snapshots, to rank everyone when the match ends. */
export class Standings {
  /** Tick of each player's last death; a player brought back (revenge cart) is dropped. */
  private readonly deaths = new Map<string, number>();
  private readonly wasAlive = new Map<string, boolean>();

  see(players: readonly { id: string; alive: boolean }[], tick: number): void {
    for (const p of players) {
      if (p.alive) this.deaths.delete(p.id);
      else if (this.wasAlive.get(p.id)) this.deaths.set(p.id, tick);
      this.wasAlive.set(p.id, p.alive);
    }
  }

  reset(): void {
    this.deaths.clear();
    this.wasAlive.clear();
  }

  /** Winner first, then whoever lasted longest; anyone never seen going out (left the room) last. */
  ranking(ids: readonly string[], winnerId: string | null, winnerIds?: readonly string[]): Placing[] {
    const winners = new Set(winnerIds ?? (winnerId ? [winnerId] : []));
    const score = (id: string) => (winners.has(id) ? Infinity : (this.deaths.get(id) ?? -Infinity));
    const sorted = [...ids].sort((a, b) => score(b) - score(a) || 0);
    return sorted.map((id) => ({ id, place: 1 + sorted.filter((o) => score(o) > score(id)).length }));
  }
}
