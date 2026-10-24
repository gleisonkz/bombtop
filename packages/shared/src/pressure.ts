import { PRESSURE_INTERVAL } from "./constants";
import { getTile, playerTile, setTile, Tile, type MatchState } from "./state";

/** Interior tiles in a clockwise spiral from the top-left corner inward. */
export function pressureOrder(width: number, height: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  let [left, top, right, bottom] = [1, 1, width - 2, height - 2];
  while (left <= right && top <= bottom) {
    for (let x = left; x <= right; x++) out.push({ x, y: top });
    for (let y = top + 1; y <= bottom; y++) out.push({ x: right, y });
    if (top < bottom) for (let x = right - 1; x >= left; x--) out.push({ x, y: bottom });
    if (left < right) for (let y = bottom - 1; y > top; y--) out.push({ x: left, y });
    left++;
    top++;
    right--;
    bottom--;
  }
  return out;
}

/** From `pressureAt` (ROUND_TICKS, or sooner once only bots are left), drops a wall on the next spiral tile every PRESSURE_INTERVAL ticks. */
export function updatePressure(s: MatchState): void {
  const elapsed = s.tick - s.pressureAt - 1;
  if (elapsed < 0 || elapsed % PRESSURE_INTERVAL !== 0) return;

  const order = pressureOrder(s.grid.width, s.grid.height);
  while (s.pressure < order.length && getTile(s, order[s.pressure]!.x, order[s.pressure]!.y) === Tile.Wall) {
    s.pressure++;
  }
  const target = order[s.pressure];
  if (target) {
    s.pressure++;
    const { x, y } = target;
    setTile(s, x, y, Tile.Wall);
    s.bombs = s.bombs.filter((b) => !(b.x === x && b.y === y && !b.air));
    s.items = s.items.filter((i) => !(i.x === x && i.y === y));
    // a block burning there would clear its tile when its flame died, taking the wall with it
    s.flames = s.flames.filter((f) => !(f.x === x && f.y === y));
  }
  // Crushed: no mount or invulnerability saves you. Whoever stands inside any fallen wall counts, not only under the one
  // falling now: a player half across a tile's edge as it fell ended up inside it, alive, and the match never ended.
  for (const p of s.players) {
    const t = playerTile(p);
    if (p.alive && getTile(s, t.x, t.y) === Tile.Wall) p.alive = false;
  }
}

export type MatchResult = { over: false } | { over: true; winnerId: string | null };

/** A match with 2+ players ends when at most one is left alive. */
export function matchResult(s: MatchState): MatchResult {
  if (s.players.length < 2) return { over: false };
  const alive = s.players.filter((p) => p.alive);
  if (alive.length > 1) return { over: false };
  return { over: true, winnerId: alive[0]?.id ?? null };
}
