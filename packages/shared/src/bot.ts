import { FUSE_TICKS, PRESSURE_INTERVAL, ROUND_TICKS, TILE } from "./constants";
import { pressureOrder } from "./pressure";
import { effectiveRange, effectiveSpeed } from "./curse";
import {
  bombAt,
  DIR_VECTORS,
  getTile,
  ItemKind,
  playerTile,
  tileCenter,
  Tile,
  type Bomb,
  type Facing,
  type MatchState,
  type Player,
  type PlayerInput,
} from "./state";

/**
 * Computer players. Every tick a bot reads the match like a player would: it
 * knows where each blast will land and when, and gets out of the way. Between
 * "thoughts" (more often on harder levels) it picks what to do next: grab a
 * power-up, break blocks, or go after a rival, and it only drops a bomb when
 * it can still get away from it.
 */

export type BotLevel = "easy" | "medium" | "hard";
export const BOT_LEVELS: readonly BotLevel[] = ["easy", "medium", "hard"];

interface Tuning {
  /** Ticks between decisions about where to go and whether to bomb. */
  think: number;
  /** Extra ticks wanted between leaving a tile and it catching fire. */
  margin: number;
  /** Own bombs on the field at once. */
  bombs: number;
  /** Steps a bot will walk for a power-up. */
  itemReach: number;
  /** Goes after rivals (otherwise only blocks and items). */
  hunt: boolean;
  /** Drops bombs that leave a rival nowhere to run. */
  cunning: boolean;
}

const TUNING: Record<BotLevel, Tuning> = {
  easy: { think: 18, margin: 28, bombs: 1, itemReach: 5, hunt: false, cunning: false },
  medium: { think: 7, margin: 16, bombs: 2, itemReach: 9, hunt: true, cunning: false },
  hard: { think: 1, margin: 10, bombs: 99, itemReach: 14, hunt: true, cunning: true },
};

const FACINGS: Facing[] = ["up", "down", "left", "right"];
/** A rival's remote bomb can go off at any moment: assume this soon. */
const REMOTE_THREAT = 20;

type Danger = Map<number, number>;
interface Node {
  x: number;
  y: number;
  steps: number;
  /** First tile on the way here (the start tile for the start itself). */
  first: { x: number; y: number };
}

export class Bot {
  private readonly tune: Tuning;
  private goal: { x: number; y: number } | null = null;
  private nextThink = 0;
  /** Last direction sent and where we were then: a step under way. */
  private stride: { dir: Facing; px: number; py: number } | null = null;

  constructor(
    readonly id: string,
    readonly level: BotLevel = "medium",
  ) {
    this.tune = TUNING[level];
  }

  /** This tick's input. */
  input(s: MatchState): PlayerInput {
    const out = this.choose(s);
    const p = s.players.find((q) => q.id === this.id);
    this.stride = out.dir && p ? { dir: out.dir, px: p.px, py: p.py } : null;
    return out;
  }

  private choose(s: MatchState): PlayerInput {
    const p = s.players.find((q) => q.id === this.id);
    if (!p || !p.alive || p.stun > 0 || p.jumpTicks > 0 || p.dashTicks > 0) return { dir: null, bomb: false };
    const here = playerTile(p);
    const danger = dangerMap(s, this.id);
    const k = (x: number, y: number) => y * s.grid.width + x;
    const safe = (x: number, y: number) => !danger.has(k(x, y));
    // Survival first, every tick, on every level: may cross tiles that burn later.
    if (!safe(here.x, here.y)) {
      this.goal = null;
      const escape = reach(s, p, danger, this.tune.margin, false);
      const out = escape.find((n) => safe(n.x, n.y)) ?? latestToBurn(escape, danger, k);
      return { dir: out ? heading(p, out.first.x, out.first.y) : null, bomb: false };
    }

    // Finish a step before rethinking: plans made halfway, from whichever tile we happen to
    // be on, flip at every tile edge and the bot dithers back and forth across it.
    if (this.striding(s, p, here, safe)) return { dir: this.stride!.dir, bomb: false };

    // Everything else only walks through tiles that are safe for good.
    const nodes = reach(s, p, danger, this.tune.margin, true);
    if (s.tick >= this.nextThink) {
      this.nextThink = s.tick + this.tune.think;
      const act = this.decide(s, p, danger, nodes);
      if (act) return act;
    }

    // Keep heading for the goal while the way there stays safe.
    const goal = this.goal;
    const route = goal && nodes.find((n) => n.x === goal.x && n.y === goal.y && safe(n.x, n.y));
    if (!route || route.steps === 0) {
      this.goal = null;
      return { dir: heading(p, here.x, here.y), bomb: false }; // settle on the center: turns are free from there
    }
    return { dir: heading(p, route.first.x, route.first.y), bomb: false };
  }

  /** Whether a step under way still has a safe, free tile center ahead to reach. */
  private striding(s: MatchState, p: Player, here: { x: number; y: number }, safe: (x: number, y: number) => boolean): boolean {
    const st = this.stride;
    if (!st || (st.px === p.px && st.py === p.py)) return false; // no step, or blocked
    const [dx, dy] = DIR_VECTORS[st.dir];
    const ahead = dx ? (tileCenter(here.x) - p.px) * dx : (tileCenter(here.y) - p.py) * dy;
    if (ahead > 0) return true; // still short of this tile's center
    if (ahead === 0) return false; // on the center: free to turn
    const x = here.x + dx;
    const y = here.y + dy;
    return getTile(s, x, y) === Tile.Empty && !bombAt(s, x, y) && safe(x, y);
  }

  /** A thought: bomb or detonate now, or pick where to go. Returns an input to send right away, if any. */
  private decide(s: MatchState, p: Player, danger: Danger, nodes: Node[]): PlayerInput | null {
    const t = this.tune;
    const k = (x: number, y: number) => y * s.grid.width + x;
    const safe = (x: number, y: number) => !danger.has(k(x, y));
    const here = playerTile(p);

    // Carrying a bomb (glove): throw it.
    if (s.bombs.some((b) => b.heldBy === p.id)) return { dir: null, bomb: true };

    // Remote bombs: set them off once we are clear and they would hit something.
    const remote = s.bombs.find((b) => b.ownerId === p.id && b.type === "remote" && !b.air && !b.heldBy);
    if (remote && bombValue(s, p, remote.x, remote.y) > 0) return { dir: null, bomb: false, action: true };

    const mine = s.bombs.filter((b) => b.ownerId === p.id).length;
    const canBomb = p.curse?.kind !== "constipation" && !bombAt(s, here.x, here.y) && mine < Math.min(p.bombCapacity, t.bombs);
    if (canBomb) {
      const after = dangerMap(s, p.id, ownBomb(p, here));
      const worth = bombValue(s, p, here.x, here.y) > 0 || (t.cunning && this.traps(s, p, after));
      if (worth && this.canEscape(s, p, after)) return { dir: null, bomb: true };
    }

    // Where to next: a power-up, a spot to bomb from, or a rival.
    const items = new Set(s.items.filter((i) => i.kind !== ItemKind.Skull).map((i) => k(i.x, i.y)));
    const pick =
      nodes.find((n) => n.steps > 0 && n.steps <= t.itemReach && items.has(k(n.x, n.y)) && safe(n.x, n.y)) ??
      (canBomb ? nodes.find((n) => n.steps > 0 && safe(n.x, n.y) && bombValue(s, p, n.x, n.y) > 0) : undefined) ??
      (t.hunt ? this.towardRival(s, p, nodes, safe) : undefined);
    this.goal = pick ? { x: pick.x, y: pick.y } : null;
    return null;
  }

  /** With the bomb down (`after`), a safe tile must still be within reach in time. */
  private canEscape(s: MatchState, p: Player, after: Danger): boolean {
    return reach(s, p, after, this.tune.margin, false).some((n) => !after.has(n.y * s.grid.width + n.x));
  }

  /** Whether the bomb would leave some rival with no safe tile to run to. */
  private traps(s: MatchState, p: Player, after: Danger): boolean {
    return s.players.some(
      (o) => o.id !== p.id && o.alive && !reach(s, o, after, 0, false).some((n) => !after.has(n.y * s.grid.width + n.x)),
    );
  }

  private towardRival(s: MatchState, p: Player, nodes: Node[], safe: (x: number, y: number) => boolean): Node | undefined {
    const rivals = s.players.filter((o) => o.id !== p.id && o.alive).map(playerTile);
    let best: Node | undefined;
    let bestDist = Infinity;
    for (const n of nodes) {
      if (!safe(n.x, n.y)) continue; // where we stand counts too: no point pacing between two tiles
      const d = Math.min(...rivals.map((r) => Math.abs(r.x - n.x) + Math.abs(r.y - n.y)));
      if (d < bestDist || (d === bestDist && best && n.steps < best.steps)) {
        best = n;
        bestDist = d;
      }
    }
    return best;
  }
}

/** Stateless helper: a hard bot's input (handy for tests and one-off use). */
export function botInput(s: MatchState, id: string, level: BotLevel = "hard"): PlayerInput {
  return new Bot(id, level).input(s);
}

/** Ticks until each tile burns (0 = burning now). Tiles not in the map are safe. */
function dangerMap(s: MatchState, me: string, extra?: Bomb): Danger {
  const w = s.grid.width;
  const danger: Danger = new Map();
  const mark = (x: number, y: number, t: number) => {
    const k = y * w + x;
    if (!danger.has(k) || danger.get(k)! > t) danger.set(k, t);
  };
  for (const f of s.flames) mark(f.x, f.y, 0);
  pressureDanger(s, mark);

  const bombs = s.bombs.filter((b) => !b.air && !b.heldBy);
  if (extra) bombs.push(extra);
  const when = new Map<Bomb, number>();
  for (const b of bombs) when.set(b, b.type === "remote" ? (b.ownerId === me ? FUSE_TICKS : REMOTE_THREAT) : b.fuse);
  const blasts = new Map(bombs.map((b) => [b, blast(s, b)]));
  // A bomb caught in an earlier blast goes off with it.
  for (let changed = true; changed; ) {
    changed = false;
    for (const b of bombs) {
      for (const [x, y] of blasts.get(b)!) {
        const hit = bombs.find((o) => o !== b && o.x === x && o.y === y);
        if (hit && when.get(hit)! > when.get(b)!) {
          when.set(hit, when.get(b)!);
          changed = true;
        }
      }
    }
  }
  for (const b of bombs) for (const [x, y] of blasts.get(b)!) mark(x, y, Math.max(0, when.get(b)!));
  return danger;
}

/** Lookahead for sudden-death walls, in walls. */
const PRESSURE_LOOKAHEAD = 40;

/** Sudden death: the next walls to fall, with the ticks until each lands. */
function pressureDanger(s: MatchState, mark: (x: number, y: number, t: number) => void): void {
  const startsIn = ROUND_TICKS + 1 - s.tick;
  if (startsIn > PRESSURE_LOOKAHEAD * PRESSURE_INTERVAL) return;
  const sinceStart = -startsIn;
  const firstIn = startsIn > 0 ? startsIn : (PRESSURE_INTERVAL - (sinceStart % PRESSURE_INTERVAL)) % PRESSURE_INTERVAL;
  const order = pressureOrder(s.grid.width, s.grid.height);
  let n = 0;
  for (let i = s.pressure; i < order.length && n < PRESSURE_LOOKAHEAD; i++) {
    const { x, y } = order[i]!;
    if (getTile(s, x, y) === Tile.Wall) continue;
    mark(x, y, firstIn + n * PRESSURE_INTERVAL);
    n++;
  }
}

/** Tiles an explosion covers. */
function blast(s: MatchState, b: Pick<Bomb, "x" | "y" | "range" | "type">): [number, number][] {
  const tiles: [number, number][] = [[b.x, b.y]];
  const pierce = b.type === "pierce";
  for (const f of FACINGS) {
    const [dx, dy] = DIR_VECTORS[f];
    for (let i = 1; i <= b.range; i++) {
      const x = b.x + dx * i;
      const y = b.y + dy * i;
      const tile = getTile(s, x, y);
      if (tile === Tile.Wall) break;
      tiles.push([x, y]);
      if (!pierce && (tile === Tile.Block || bombAt(s, x, y) || s.items.some((it) => it.x === x && it.y === y))) break;
    }
  }
  return tiles;
}

/**
 * Every tile the player can get to, nearest first. A tile on fire, or one
 * that would burn before the player is through it, is not entered.
 */
function reach(s: MatchState, p: Player, danger: Danger, margin: number, strict: boolean): Node[] {
  const skulls = new Set(s.items.filter((i) => i.kind === ItemKind.Skull).map((i) => i.y * s.grid.width + i.x));
  const w = s.grid.width;
  const start = playerTile(p);
  const perStep = TILE / Math.max(1, effectiveSpeed(p));
  // Off-center players need a little longer to clear their own tile.
  const lag = (Math.abs(p.px - tileCenter(start.x)) + Math.abs(p.py - tileCenter(start.y))) / Math.max(1, effectiveSpeed(p));
  const seen = new Set([start.y * w + start.x]);
  const out: Node[] = [{ ...start, steps: 0, first: start }];
  for (let i = 0; i < out.length; i++) {
    const n = out[i]!;
    for (const f of FACINGS) {
      const [dx, dy] = DIR_VECTORS[f];
      const x = n.x + dx;
      const y = n.y + dy;
      const k = y * w + x;
      if (seen.has(k) || getTile(s, x, y) !== Tile.Empty || bombAt(s, x, y)) continue;
      const burns = danger.get(k);
      const through = (n.steps + 2) * perStep + lag + margin;
      if (burns !== undefined && (strict || burns <= through)) continue;
      if (strict && skulls.has(k)) continue; // curses are not worth it
      seen.add(k);
      out.push({ x, y, steps: n.steps + 1, first: n.steps === 0 ? { x, y } : n.first });
    }
  }
  return out;
}

/** With no safe tile in reach, the tile that burns last (a chain may still spare it). */
function latestToBurn(nodes: Node[], danger: Danger, k: (x: number, y: number) => number): Node | undefined {
  let best: Node | undefined;
  // The tile we stand on counts too: otherwise two neighbours each send us to the other.
  for (const n of nodes) if (!best || danger.get(k(n.x, n.y))! > danger.get(k(best.x, best.y))!) best = n;
  return best;
}

/** Direction toward tile (x, y), or toward its center when already on it. */
function heading(p: Player, x: number, y: number): Facing | null {
  const cx = tileCenter(x) - p.px;
  const cy = tileCenter(y) - p.py;
  if (cx === 0 && cy === 0) return null;
  return Math.abs(cx) >= Math.abs(cy) ? (cx > 0 ? "right" : "left") : cy > 0 ? "down" : "up";
}

function ownBomb(p: Player, at: { x: number; y: number }): Bomb {
  return { ownerId: p.id, x: at.x, y: at.y, fuse: FUSE_TICKS, range: effectiveRange(p), type: p.bombType, slide: null, offset: 0, air: null, heldBy: null };
}

/** What a bomb at (x, y) would hit: blocks to break and rivals to catch. */
function bombValue(s: MatchState, p: Player, x: number, y: number): number {
  let value = 0;
  const tiles = blast(s, { x, y, range: effectiveRange(p), type: p.bombType });
  for (const [tx, ty] of tiles) {
    if (getTile(s, tx, ty) === Tile.Block) value += 1;
    if (s.players.some((o) => o.id !== p.id && o.alive && playerTile(o).x === tx && playerTile(o).y === ty)) value += 5;
  }
  return value;
}
