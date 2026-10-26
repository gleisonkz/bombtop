import { FUSE_TICKS, PRESSURE_INTERVAL, TICK_RATE, TILE } from "./constants";
import { pressureOrder } from "./pressure";
import { cursedDirection, effectiveCapacity, effectiveFuse, effectiveRange, effectiveSpeed } from "./curse";
import { createRng } from "./rng";
import { SPECIAL_PLANS, type SpecialContext } from "./bot-specials";
import { conveyorDirection } from "./floor";
import { updateSlides } from "./kick";
import { stageTempoRate } from "./stage";
import {
  bombAt,
  DIR_VECTORS,
  Floor,
  getFloor,
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
 * it can still get away from it. Each bot has a personality (what it goes for, how
 * careful it is) and its own dice, so no two bots, nor two matches, play alike.
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
  /** Ticks a chance to use the special must last before the bot takes it (up to twice as long). */
  react: number;
  /** Chance it then takes it (otherwise it waits again); fired up, it takes more. */
  use: number;
}

/** What a bot is like: what it goes for first, how careful and how predictable it is. */
export type BotPersona = "hunter" | "collector" | "demolisher" | "cautious" | "wildcard";
export const BOT_PERSONAS: readonly BotPersona[] = ["hunter", "collector", "demolisher", "cautious", "wildcard"];

interface Traits {
  /** Head start, in steps, given to each kind of goal when choosing (higher = preferred). */
  item: number;
  block: number;
  rival: number;
  /** Walks this many times further for a power-up. */
  greed: number;
  /** Goes after rivals even on levels that otherwise don't. */
  hunts: boolean;
  /** Extra ticks of safety wanted before dropping a bomb (never when running: that only narrows the way out). */
  caution: number;
  /** Thinks this many times slower. */
  slow: number;
  /** Random steps added to each goal's distance (how unpredictable). */
  noise: number;
  /** Chance, per thought, of strolling somewhere instead. */
  wander: number;
}

const PERSONAS: Record<BotPersona, Traits> = {
  hunter: { item: 0, block: 0, rival: 4, greed: 1, hunts: true, caution: 0, slow: 1, noise: 2, wander: 0 },
  collector: { item: 5, block: 1, rival: -2, greed: 2.5, hunts: false, caution: 2, slow: 1, noise: 2, wander: 0.05 },
  demolisher: { item: 1, block: 4, rival: -1, greed: 1, hunts: false, caution: 0, slow: 1, noise: 2, wander: 0 },
  cautious: { item: 2, block: 1, rival: -3, greed: 1, hunts: false, caution: 10, slow: 1.5, noise: 2, wander: 0.05 },
  wildcard: { item: 1, block: 1, rival: 1, greed: 1.5, hunts: true, caution: 0, slow: 1, noise: 7, wander: 0.2 },
};

const TUNING: Record<BotLevel, Tuning> = {
  easy: { think: 18, margin: 28, bombs: 1, itemReach: 5, hunt: false, cunning: false, react: 45, use: 0.4 },
  medium: { think: 7, margin: 16, bombs: 2, itemReach: 9, hunt: true, cunning: false, react: 12, use: 0.8 },
  hard: { think: 1, margin: 10, bombs: 99, itemReach: 14, hunt: true, cunning: true, react: 0, use: 1 },
};

/**
 * How fired up the bots are, 0 to BOT_HEAT_MAX: they warm up a step at a time as a match drags on, and are at their
 * hottest once no human is left (nobody wants to watch two careful bots circle each other until the walls fall in).
 * Hotter, every bot hunts, cares less for power-ups, thinks faster, keeps more bombs out, sets traps (from 2) and stops
 * strolling; how safe it keeps from its own bombs never changes.
 */
export const BOT_HEAT_MAX = 3;
const HEAT_FROM = 45 * TICK_RATE;
const HEAT_STEP = 30 * TICK_RATE;

export function botHeat(tick: number, humansAlive: boolean): number {
  if (!humansAlive) return BOT_HEAT_MAX;
  if (tick < HEAT_FROM) return 0;
  return Math.min(BOT_HEAT_MAX, 1 + Math.floor((tick - HEAT_FROM) / HEAT_STEP));
}

const FACINGS: Facing[] = ["up", "down", "left", "right"];
/** A bot's mood (see Bot.mood) lasts this long, up to twice as long. */
const MOOD_TICKS = 120;

/** How much a mood fancies tile (x, y), in [0, 1): a hash, the same for as long as the mood lasts. */
function tileFancy(mood: number, x: number, y: number): number {
  let h = Math.imul(mood ^ Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663), 2654435761);
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
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
  private readonly traits: Traits;
  /** This bot's own dice (deterministic: the same seed plays the same match). */
  private readonly random: () => number;
  private goal: { x: number; y: number } | null = null;
  private nextThink = 0;
  /**
   * The bot's mood: how much it fancies each tile, rerolled every few seconds. Fresh dice at every thought
   * would flip its goal tick after tick (a hard bot thinks every tick) and leave it dithering by its bombs.
   */
  private mood = 0;
  private moodUntil = 0;
  /** This tick's heat (botHeat). */
  private heat = 0;
  /** A chance to use the special (attack or defence) seen since tick `since`, seen last on `last`, taken after `wait`. */
  private readonly gates = { attack: { since: 0, last: -2, wait: 0 }, defend: { since: 0, last: -2, wait: 0 } };
  /** Last direction sent and where we were then: a step under way. */
  private stride: { dir: Facing; px: number; py: number } | null = null;

  constructor(
    readonly id: string,
    readonly level: BotLevel = "medium",
    readonly persona: BotPersona = "demolisher",
    seed = 0,
  ) {
    this.traits = PERSONAS[persona];
    const base = TUNING[level];
    this.tune = { ...base, hunt: base.hunt || this.traits.hunts };
    this.random = createRng(seed);
  }

  /** This tick's input; `humansAlive` false once only bots are left (they go all out: botHeat). */
  input(s: MatchState, humansAlive = true): PlayerInput {
    this.heat = botHeat(s.tick, humansAlive);
    const out = this.choose(s);
    const p = s.players.find((q) => q.id === this.id);
    this.stride = out.dir && p ? { dir: out.dir, px: p.px, py: p.py } : null;
    return p ? { ...out, dir: cursedDirection(p, out.dir) } : out;
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
      const preferred = reach(s, p, danger, this.tune.margin, false, true);
      let out = preferred.find((n) => safe(n.x, n.y));
      if (!out) {
        const escape = reach(s, p, danger, this.tune.margin, false);
        out = escape.find((n) => safe(n.x, n.y)) ?? latestToBurn(escape, danger, k);
      }
      if (out && s.bombs.some((b) => b.ownerId === this.id)) {
        const conservative = dangerMap(s, this.id, undefined, true);
        if (conservative.has(k(out.x, out.y))) {
          const alternatives = reach(s, p, conservative, this.tune.margin, false, true);
          out = alternatives.find((n) => !conservative.has(k(n.x, n.y)));
          if (!out) {
            const fallback = reach(s, p, conservative, this.tune.margin, false);
            out = fallback.find((n) => !conservative.has(k(n.x, n.y))) ?? latestToBurn(fallback, conservative, k);
          }
        }
      }
      // A defensive special can still save a bot with no safe walking destination.
      const saved = out && safe(out.x, out.y) ? null : this.special(s, p, danger, "defend");
      if (saved) return saved;
      return { dir: out ? heading(p, out.first.x, out.first.y) : null, bomb: false };
    }

    // A chance to use the special on a rival is taken as soon as the bot reacts to it.
    const attack = this.special(s, p, danger, "attack");
    if (attack) return attack;

    // Finish a step before rethinking: plans made halfway, from whichever tile we happen to
    // be on, flip at every tile edge and the bot dithers back and forth across it.
    if (this.striding(s, p, here, safe)) return { dir: this.stride!.dir, bomb: false };

    // Everything else only walks through tiles that are safe for good.
    const nodes = reach(s, p, danger, this.tune.margin, true);
    if (s.tick >= this.nextThink) {
      const think = (this.tune.think * this.traits.slow) / (1 + this.heat);
      this.nextThink = s.tick + Math.round(think + this.random() * think * 0.5);
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

    const planned = this.special(s, p, danger, "plan", nodes);
    if (planned) return planned;

    const mine = s.bombs.filter((b) => b.ownerId === p.id).length;
    const canBomb = p.curse?.kind !== "constipation" && !bombAt(s, here.x, here.y) && mine < Math.min(effectiveCapacity(p), t.bombs + this.heat);
    if (canBomb) {
      const possible = ownBomb(p, here);
      const after = dangerMap(s, p.id, possible);
      const worth = bombValue(s, p, here.x, here.y) > 0 || ((t.cunning || this.heat >= 2) && this.traps(s, p, after));
      if (worth && this.canEscape(s, p, dangerMap(s, p.id, possible, true))) return { dir: null, bomb: true };
    }

    // Where to next: a power-up, a spot to bomb from, or a rival, weighed by personality and a little luck;
    // now and then just a stroll.
    const pick = this.heat === 0 && this.random() < this.traits.wander ? this.stroll(nodes, safe) : this.pickGoal(s, p, nodes, safe, canBomb);
    this.goal = pick ? { x: pick.x, y: pick.y } : null;
    return null;
  }

  /** The best goal: each candidate's distance, less its kind's head start, plus some noise. */
  private pickGoal(s: MatchState, p: Player, nodes: Node[], safe: (x: number, y: number) => boolean, canBomb: boolean): Node | undefined {
    const t = this.tune;
    const tr = this.traits;
    const k = (x: number, y: number) => y * s.grid.width + x;
    const items = new Set(s.items.filter((i) => i.kind !== ItemKind.Skull).map((i) => k(i.x, i.y)));
    if (s.tick >= this.moodUntil) {
      this.mood = Math.floor(this.random() * 2 ** 32);
      this.moodUntil = s.tick + MOOD_TICKS + Math.floor(this.random() * MOOD_TICKS);
    }
    let best: Node | undefined;
    let bestScore = Infinity;
    const consider = (n: Node | undefined, headStart: number) => {
      if (!n) return;
      const score = n.steps - headStart + tileFancy(this.mood, n.x, n.y) * tr.noise;
      if (score < bestScore) {
        best = n;
        bestScore = score;
      }
    };
    let spots = 0;
    for (const n of nodes) {
      if (n.steps === 0 || !safe(n.x, n.y)) continue;
      if (items.has(k(n.x, n.y)) && n.steps <= (t.itemReach * tr.greed) / (1 + this.heat)) consider(n, tr.item - this.heat * 2);
      // The nearest few spots to bomb from (looking further costs time and changes little).
      else if (canBomb && spots < 6 && bombValue(s, p, n.x, n.y) > 0) {
        spots++;
        consider(n, tr.block);
      }
    }
    if (t.hunt || this.heat > 0) consider(this.towardRival(s, p, nodes, safe), Math.max(tr.rival, 0) + this.heat * 4);
    return best;
  }

  /** Somewhere safe nearby, at random. */
  private stroll(nodes: Node[], safe: (x: number, y: number) => boolean): Node | undefined {
    const near = nodes.filter((n) => n.steps > 0 && n.steps <= 6 && safe(n.x, n.y));
    return near[Math.floor(this.random() * near.length)];
  }

  /**
   * The special, if its character's plan (SPECIAL_PLANS) says now: turned toward where it aims and fired in the same tick.
   * Attacks and defences wait for the bot to react (its level's `react`); plans come on thoughts, paced already.
   */
  private special(s: MatchState, p: Player, danger: Danger, hook: "attack" | "defend" | "plan", nodes: Node[] = []): PlayerInput | null {
    if (p.specialCooldown > 0 || p.sneak > 0 || p.bubble > 0) return null;
    const check = SPECIAL_PLANS[p.character]?.[hook];
    if (!check) return null;
    const w = s.grid.width;
    const c: SpecialContext = {
      s,
      p,
      here: playerTile(p),
      danger,
      safe: (x, y) => !danger.has(y * w + x),
      rivals: s.players.filter((o) => o.id !== p.id && o.alive && o.sneak === 0),
      hunting: this.tune.hunt || this.heat > 0,
      nodes,
      escapes: (b) => this.canEscape(s, p, dangerMap(s, p.id, b, true)),
      bombValue: (x, y, range, type) => bombValue(s, p, x, y, range, type),
      crushSoon: (x, y) => crushSoon(s, x, y),
    };
    const aim = check(c);
    if (aim === undefined) return null;
    if (hook !== "plan" && !this.reacted(hook, s.tick)) return null;
    // Walking toward the aim turns the bot (a step that way included): only when that step is safe too.
    const turn = aim === null || aim === p.facing ? null : aim;
    if (turn) {
      const [dx, dy] = DIR_VECTORS[turn];
      const x = c.here.x + dx;
      const y = c.here.y + dy;
      if (hook !== "defend" && getTile(s, x, y) === Tile.Empty && !bombAt(s, x, y) && !c.safe(x, y)) return null;
    }
    return { dir: turn, bomb: false, special: true };
  }

  /** Whether a chance to use the special has lasted long enough for the bot to react (seen on every tick since). */
  private reacted(hook: "attack" | "defend", tick: number): boolean {
    const g = this.gates[hook];
    if (g.last !== tick - 1) {
      const base = this.tune.react / (1 + this.heat);
      g.since = tick;
      g.wait = base > 0 ? Math.round(base + this.random() * base) : 0;
    }
    g.last = tick;
    if (tick - g.since < g.wait) return false;
    g.last = -2; // decided: the next chance starts over
    return this.random() < this.tune.use + this.heat * 0.2;
  }

  /** With the bomb down (`after`), a safe tile must still be within reach in time. */
  private canEscape(s: MatchState, p: Player, after: Danger): boolean {
    return reach(s, p, after, this.tune.margin + (this.heat >= 2 ? 0 : this.traits.caution), false).some((n) => !after.has(n.y * s.grid.width + n.x));
  }

  /** Whether the bomb would leave some rival with no safe tile to run to. */
  private traps(s: MatchState, p: Player, after: Danger): boolean {
    return s.players.some(
      (o) => o.id !== p.id && o.alive && !reach(s, o, after, 0, false).some((n) => !after.has(n.y * s.grid.width + n.x)),
    );
  }

  private towardRival(s: MatchState, p: Player, nodes: Node[], safe: (x: number, y: number) => boolean): Node | undefined {
    const rivals = s.players.filter((o) => o.id !== p.id && o.alive && o.sneak === 0).map(playerTile);
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
function dangerMap(s: MatchState, me: string, extra?: Bomb, unblockedExtra = false): Danger {
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
  const occ = occupancy(s);
  const unblocked = { ...occ, items: new Set<number>() };
  const blasts = new Map(bombs.map((b) => [b, forecastBlast(s, b, b.ownerId === me && unblockedExtra ? unblocked : occ, when.get(b)!, mark)]));
  // Bombs by tile, in field order (sliding ones can share a tile).
  const at = new Map<number, Bomb[]>();
  for (const b of bombs) {
    const k = b.y * w + b.x;
    const list = at.get(k);
    if (list) list.push(b);
    else at.set(k, [b]);
  }
  // A bomb caught in an earlier blast goes off with it.
  for (let changed = true; changed; ) {
    changed = false;
    for (const b of bombs) {
      for (const [x, y] of blasts.get(b)!) {
        const hit = at.get(y * w + x)?.find((o) => o !== b);
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

/** Keep every possible belt origin: obstruction or an early chain can stop transport short. */
function forecastBlast(s: MatchState, b: Bomb, occ: Occupancy, deadline: number, mark: (x: number, y: number, t: number) => void): [number, number][] {
  const tiles = blast(s, b, occ);
  if (!b.conveyor && !conveyorDirection(getFloor(s, b.x, b.y))) return tiles;

  const moving = { ...b };
  // Players and other bombs may move away before arrival; do not rely on their cover.
  const forecast = { ...s, bombs: [moving], players: [], items: [] };
  const open = { bombs: new Set<number>(), items: new Set<number>() };
  const seen = new Set([b.y * s.grid.width + b.x]);
  const horizon = Math.min(FUSE_TICKS, Math.max(0, b.type === "remote" ? FUSE_TICKS : b.fuse));
  for (let tick = 0; tick < horizon; tick++) {
    updateSlides(forecast);
    const key = moving.y * s.grid.width + moving.x;
    if (!seen.has(key)) {
      seen.add(key);
      const transported = blast(s, moving, open);
      tiles.push(...transported);
      for (const [x, y] of transported) mark(x, y, Math.min(deadline, tick + 1));
    }
    if (!moving.slide) break;
  }
  return tiles;
}

/** Lookahead for sudden-death walls, in walls. */
const PRESSURE_LOOKAHEAD = 40;

/** Sudden death: the next walls to fall, with the ticks until each lands. */
function pressureDanger(s: MatchState, mark: (x: number, y: number, t: number) => void): void {
  const startsIn = s.pressureAt + 1 - s.tick;
  if (startsIn > PRESSURE_LOOKAHEAD * PRESSURE_INTERVAL) return;
  const sinceStart = -startsIn;
  const firstIn = startsIn > 0 ? startsIn : (PRESSURE_INTERVAL - (sinceStart % PRESSURE_INTERVAL)) % PRESSURE_INTERVAL;
  const order = pressureOrder(s.grid.width, s.grid.height);
  let n = 0;
  for (let i = s.pressure; i < Math.min(order.length, s.pressureLimit ?? order.length) && n < PRESSURE_LOOKAHEAD; i++) {
    const { x, y } = order[i]!;
    if (getTile(s, x, y) === Tile.Wall) continue;
    mark(x, y, firstIn + n * PRESSURE_INTERVAL);
    n++;
  }
}

/** Whether a sudden-death wall lands on (x, y) within CRUSH_SOON ticks. */
const CRUSH_SOON = 4 * TICK_RATE;
function crushSoon(s: MatchState, x: number, y: number): boolean {
  let soon = false;
  pressureDanger(s, (wx, wy, t) => {
    if (wx === x && wy === y && t <= CRUSH_SOON) soon = true;
  });
  return soon;
}

/** Tiles holding a resting bomb, or an item (tile keys y * width + x): looked up instead of searched. */
interface Occupancy {
  bombs: Set<number>;
  items: Set<number>;
}

function occupancy(s: MatchState): Occupancy {
  const w = s.grid.width;
  return {
    bombs: new Set(s.bombs.filter((b) => !b.air && !b.heldBy).map((b) => b.y * w + b.x)),
    items: new Set(s.items.map((i) => i.y * w + i.x)),
  };
}

/** Tiles an explosion covers. */
function blast(s: MatchState, b: Pick<Bomb, "x" | "y" | "range" | "type">, occ = occupancy(s)): [number, number][] {
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
      const k = y * s.grid.width + x;
      if (!pierce && (tile === Tile.Block || occ.bombs.has(k) || occ.items.has(k))) break;
    }
  }
  return tiles;
}

/**
 * Every tile the player can get to, nearest first. A tile on fire, or one
 * that would burn before the player is through it, is not entered.
 */
function reach(s: MatchState, p: Player, danger: Danger, margin: number, strict: boolean, avoidSkulls = strict): Node[] {
  const skulls = new Set(s.items.filter((i) => i.kind === ItemKind.Skull).map((i) => i.y * s.grid.width + i.x));
  const w = s.grid.width;
  const start = playerTile(p);
  const perStep = TILE / Math.max(1, effectiveSpeed(p) * stageTempoRate(s));
  // Off-center players need a little longer to clear their own tile.
  const lag = (Math.abs(p.px - tileCenter(start.x)) + Math.abs(p.py - tileCenter(start.y))) / Math.max(1, effectiveSpeed(p) * stageTempoRate(s));
  const bombs = occupancy(s).bombs;
  const seen = new Set([start.y * w + start.x]);
  const out: Node[] = [{ ...start, steps: 0, first: start }];
  for (let i = 0; i < out.length; i++) {
    const n = out[i]!;
    for (const f of FACINGS) {
      const [dx, dy] = DIR_VECTORS[f];
      const x = n.x + dx;
      const y = n.y + dy;
      const k = y * w + x;
      if (seen.has(k) || getTile(s, x, y) !== Tile.Empty || bombs.has(k)) continue;
      const burns = danger.get(k);
      const through = (n.steps + 2) * perStep + lag + margin;
      if (burns !== undefined && (strict || burns <= through)) continue;
      if (avoidSkulls && skulls.has(k)) continue;
      if (getFloor(s, x, y) === Floor.Warp) {
        const portalIndex = s.grid.warps.findIndex((warp) => warp.x === x && warp.y === y);
        const destination = portalIndex < 0 ? undefined : s.grid.warps[portalIndex ^ 1];
        if (!destination || getTile(s, destination.x, destination.y) !== Tile.Empty) continue;
        const destinationKey = destination.y * w + destination.x;
        if (bombs.has(destinationKey)) continue;
        const destinationBurns = danger.get(destinationKey);
        if (destinationBurns !== undefined && (strict || destinationBurns <= through)) continue;
        if (avoidSkulls && skulls.has(destinationKey)) continue;
      }
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

/**
 * Direction toward tile (x, y), or toward its center when already on it. Closer than one
 * step counts as there: at speeds that don't divide half a tile the center can't be landed
 * on, and aiming at it overshoots back and forth (turning lines the player up anyway).
 */
export function heading(p: Player, x: number, y: number): Facing | null {
  const cx = tileCenter(x) - p.px;
  const cy = tileCenter(y) - p.py;
  const step = effectiveSpeed(p);
  if (Math.abs(cx) < step && Math.abs(cy) < step) return null;
  return Math.abs(cx) >= Math.abs(cy) ? (cx > 0 ? "right" : "left") : cy > 0 ? "down" : "up";
}

function ownBomb(p: Player, at: { x: number; y: number }): Bomb {
  return { ownerId: p.id, x: at.x, y: at.y, fuse: effectiveFuse(p), range: effectiveRange(p), type: p.bombType, slide: null, offset: 0, air: null, heldBy: null };
}

/** What a bomb at (x, y) would hit: blocks to break and rivals to catch. */
function bombValue(s: MatchState, p: Player, x: number, y: number, range = effectiveRange(p), type = p.bombType): number {
  let value = 0;
  const tiles = blast(s, { x, y, range, type });
  for (const [tx, ty] of tiles) {
    if (getTile(s, tx, ty) === Tile.Block) value += 1;
    if (s.players.some((o) => o.id !== p.id && o.alive && o.sneak === 0 && playerTile(o).x === tx && playerTile(o).y === ty)) value += 5;
  }
  return value;
}
