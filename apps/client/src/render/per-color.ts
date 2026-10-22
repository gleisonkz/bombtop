/**
 * A character sheet repainted per player color, each made the first time it is drawn: painting every
 * character in every color up front held dozens of sheet-sized canvases, past what iPhones allow a page.
 */
export class PerColor<T> {
  private readonly made = new Map<number, T>();

  constructor(
    private readonly make: (player: number) => T,
    private readonly dispose: (made: T) => void,
  ) {}

  get(player: number): T {
    let out = this.made.get(player);
    if (out === undefined) {
      out = this.make(player);
      this.made.set(player, out);
    }
    return out;
  }

  /** How many colors are painted. */
  get size(): number {
    return this.made.size;
  }

  /** Lets every painted color go (the next draw paints again). */
  clear(): void {
    for (const m of this.made.values()) this.dispose(m);
    this.made.clear();
  }
}
