import { conveyorDirection, DIR_VECTORS, getFloor, KICK_SPEED, TICK_RATE, TILE, tryKick, updateSlides, type Bomb, type Direction, type Facing, type MatchState, type Player, type PublicView } from "@bombtop/shared";

/** How long the server may take to show our kick before we assume it refused. */
const CONFIRM_MS = 600;
/** Longest a predicted slide is drawn. */
const MAX_MS = 4000;

interface Kick {
  x: number;
  y: number;
  dir: Facing;
  ownerId: string;
  at: number;
  stoppedAt: number | null;
  confirmed: boolean;
  maxDistance: number;
}

/** Distance (fixed-point) a bomb is from (x, y) along `dir`, or null when it is off that line. */
function along(b: Bomb, k: Kick): number | null {
  const [dx, dy] = DIR_VECTORS[k.dir];
  const tiles = dx ? (b.x - k.x) * dx : (b.y - k.y) * dy;
  if ((dx && b.y !== k.y) || (dy && b.x !== k.x) || tiles < 0) return null;
  return tiles * TILE + (b.slide === k.dir ? b.offset : 0);
}

function touchesBelt(view: PublicView, bomb: Bomb, dir: Facing): boolean {
  const [dx, dy] = DIR_VECTORS[dir];
  return !!bomb.conveyor || !!conveyorDirection(getFloor(view, bomb.x, bomb.y)) ||
    !!conveyorDirection(getFloor(view, bomb.x + dx, bomb.y + dy));
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

  stop(ownerId: string, nowMs: number): void {
    for (const kick of this.kicks) {
      if (kick.ownerId === ownerId && kick.stoppedAt === null) kick.stoppedAt = nowMs;
    }
  }

  /** Called each tick with our predicted player and the direction held. */
  check(view: PublicView, me: Player, dir: Direction, nowMs: number): { x: number; y: number } | null {
    if (me.heldBy || me.thrown) return null;
    if (!dir || !me.alive || me.stun > 0 || me.webbed > 1 || me.shield > 0 || me.charge > 0 || me.rasengan > 0 || me.truck > 0 || me.jumpTicks > 0 || me.dashTicks > 0 || me.shove) return null;
    const s = {
      ...view,
      players: view.players.map((p) => p.id === me.id ? structuredClone(me) : p),
      bombs: view.bombs.map((b) => ({ ...b })),
    } as unknown as MatchState;
    tryKick(s, s.players.find((p) => p.id === me.id)!, dir);
    const kicked = s.bombs.findIndex((b, i) => b.slide && !view.bombs[i]!.slide);
    if (kicked < 0) return null;
    const { x, y } = s.bombs[kicked]!;
    if (this.kicks.some((k) => k.x === x && k.y === y)) return null;
    const k: Kick = { x, y, dir: s.bombs[kicked]!.slide!, ownerId: s.bombs[kicked]!.ownerId, at: nowMs, stoppedAt: null, confirmed: false, maxDistance: 0 };
    if (touchesBelt(view, s.bombs[kicked]!, k.dir)) return null;
    const limit = (view.grid.width + view.grid.height) * Math.ceil(TILE / KICK_SPEED);
    for (let tick = 0; tick < limit && s.bombs[kicked]!.slide; tick++) {
      if (touchesBelt(view, s.bombs[kicked]!, k.dir)) return null;
      updateSlides(s);
    }
    k.maxDistance = along(s.bombs[kicked]!, k) ?? 0;
    this.kicks.push(k);
    return { x, y };
  }

  /** `view` with our kicked bombs drawn where they should be by now. */
  apply(view: PublicView, nowMs: number): PublicView {
    if (!this.kicks.length) return view;
    let bombs = view.bombs;
    this.kicks = this.kicks.filter((k) => {
      const i = bombs.findIndex((b) => along(b, k) !== null);
      if (i < 0 || nowMs - k.at > MAX_MS) return false; // gone (it went off) or stale
      if (touchesBelt(view, bombs[i]!, k.dir) || (bombs[i]!.slide && bombs[i]!.slide !== k.dir)) return false;
      const server = along(bombs[i]!, k)!;
      if (server > 0 || bombs[i]!.slide) k.confirmed = true;
      if (!k.confirmed && nowMs - k.at > CONFIRM_MS) return false; // refused: the server's bomb stands
      const predicted = this.slide(k, nowMs);
      if (server >= predicted) return !k.confirmed && nowMs <= k.at && server === 0;
      const [dx, dy] = DIR_VECTORS[k.dir];
      const tiles = Math.floor(predicted / TILE);
      const offset = predicted - tiles * TILE;
      if (bombs === view.bombs) bombs = [...view.bombs];
      bombs[i] = { ...bombs[i]!, x: k.x + dx * tiles, y: k.y + dy * tiles, offset: k.stoppedAt === null ? offset : 0, slide: k.stoppedAt === null ? k.dir : null };
      return true;
    });
    return bombs === view.bombs ? view : { ...view, bombs };
  }

  /** How far the kicked bomb has slid by now, by the game's rules. */
  private slide(k: Kick, nowMs: number): number {
    const at = k.stoppedAt === null ? nowMs : Math.min(nowMs, k.stoppedAt);
    return Math.min(k.maxDistance, (Math.max(0, at - k.at) * TICK_RATE * KICK_SPEED) / 1000);
  }
}
