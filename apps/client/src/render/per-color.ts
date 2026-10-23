/** The "color" of a player in their character's original colors: the sheet as drawn, not repainted. */
export const ORIGINAL = -1;

/** Which color a player's sheet is drawn in: the original one when they were first to pick it, else their seat's. */
export function skinColor(p: { ownColors?: true | undefined }, seat: number): number {
  return p.ownColors ? ORIGINAL : seat;
}

/** The color to repaint a sheet in for a seat (past the palette: the first seat's), or null to leave it as drawn. */
export function paintTo(player: number, seats: readonly number[]): readonly [number, number, number] | null {
  if (player === ORIGINAL) return null;
  const color = seats[player] ?? seats[0]!;
  return [(color >> 16) & 255, (color >> 8) & 255, color & 255];
}

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
