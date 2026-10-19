import { DIR_VECTORS, TICK_RATE, TILE, tryKick, updateSlides, type Bomb, type Direction, type Facing, type MatchState, type Player, type PublicView } from "@bombtop/shared";

/** How long the server may take to show our kick before we assume it refused. */
const CONFIRM_MS = 600;
/** Longest a predicted slide is drawn. */
const MAX_MS = 4000;

interface Kick {
  x: number;
  y: number;
  dir: Facing;
  at: number;
  /** The arena as it was when we kicked: the slide is replayed on it. */
  base: PublicView;
  confirmed: boolean;
}

/** Distance (fixed-point) a bomb is from (x, y) along `dir`, or null when it is off that line. */
function along(b: Bomb, k: Kick): number | null {
  const [dx, dy] = DIR_VECTORS[k.dir];
  const tiles = dx ? (b.x - k.x) * dx : (b.y - k.y) * dy;
  if ((dx && b.y !== k.y) || (dy && b.x !== k.x) || tiles < 0) return null;
  return tiles * TILE + (b.slide === k.dir ? b.offset : 0);
}

/**
 * Our own kicks, slid at once instead of a round trip later. The slide is replayed
 * with the game's own rules; the server's bomb takes over once it is as far along,
 * and the bomb goes back if the server never kicked it.
 */
export class KickPrediction {
  private kicks: Kick[] = [];

  clear(): void {
    this.kicks = [];
  }

  /** Called each tick with our predicted player and the direction held. */
  check(view: PublicView, me: Player, dir: Direction, nowMs: number): void {
    if (!dir) return;
    const s = { ...view, players: [structuredClone(me)], bombs: view.bombs.map((b) => ({ ...b })) } as unknown as MatchState;
    tryKick(s, s.players[0]!, dir);
    const kicked = s.bombs.findIndex((b, i) => b.slide && !view.bombs[i]!.slide);
    if (kicked < 0) return;
    const { x, y } = s.bombs[kicked]!;
    if (this.kicks.some((k) => k.x === x && k.y === y)) return;
    this.kicks.push({ x, y, dir: s.bombs[kicked]!.slide!, at: nowMs, base: view, confirmed: false });
  }

  /** `view` with our kicked bombs drawn where they should be by now. */
  apply(view: PublicView, nowMs: number): PublicView {
    if (!this.kicks.length) return view;
    let bombs = view.bombs;
    this.kicks = this.kicks.filter((k) => {
      const i = bombs.findIndex((b) => along(b, k) !== null);
      if (i < 0 || nowMs - k.at > MAX_MS) return false; // gone (it went off) or stale
      const server = along(bombs[i]!, k)!;
      if (server > 0 || bombs[i]!.slide) k.confirmed = true;
      if (!k.confirmed && nowMs - k.at > CONFIRM_MS) return false; // refused: the server's bomb stands
      const predicted = this.slide(k, nowMs);
      if (server >= predicted) return false; // the server caught up
      const [dx, dy] = DIR_VECTORS[k.dir];
      const tiles = Math.floor(predicted / TILE);
      const offset = predicted - tiles * TILE;
      if (bombs === view.bombs) bombs = [...view.bombs];
      bombs[i] = { ...bombs[i]!, x: k.x + dx * tiles, y: k.y + dy * tiles, offset, slide: k.dir };
      return true;
    });
    return bombs === view.bombs ? view : { ...view, bombs };
  }

  /** How far the kicked bomb has slid by now, by the game's rules. */
  private slide(k: Kick, nowMs: number): number {
    const s = { ...k.base, bombs: k.base.bombs.map((b) => ({ ...b })) } as unknown as MatchState;
    const b = s.bombs.find((q) => q.x === k.x && q.y === k.y)!;
    b.slide = k.dir;
    const ticks = Math.floor(((nowMs - k.at) * TICK_RATE) / 1000);
    for (let t = 0; t < ticks && b.slide; t++) updateSlides(s);
    return along(b, k) ?? 0;
  }
}
