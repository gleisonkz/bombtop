import { BALL_RANGE, BOLT_RANGE, BUBBLE_TICKS, FLAME_TICKS, FLASH_RANGE, FUSE_TICKS, KAME_RANGE, KISS_RANGE, MAGNET_RANGE, RASENGAN_RANGE, SHIELD_TICKS, THUNDER_RANGE, TRUCK_RANGE, TUNNEL_RANGE, WEB_RANGE } from "./constants";
import { effectiveRange } from "./curse";
import { shieldAt } from "./special";
import { bombAt, DIR_VECTORS, getTile, hasFlame, playerTile as tileOf, Tile, type Bomb, type CharacterId, type Facing, type MatchState, type Player } from "./state";

/**
 * How a bot uses its character's special. Each character has a plan of up to three hooks, each answering where to aim:
 * a facing to turn to (the bot turns and fires in the same tick), null to fire as it stands, undefined for "not now".
 * - `attack`: checked every tick the bot stands somewhere safe (after a reaction delay that depends on its level).
 * - `defend`: checked when the bot is in danger and has no safe tile to walk to.
 * - `plan`: checked on the bot's thoughts, with the tiles it can walk to (`nodes`).
 * A new character gets an entry in SPECIAL_PLANS; one without an entry simply never uses its special.
 */
export type Aim = Facing | null | undefined;

export interface SpecialContext {
  s: MatchState;
  p: Player;
  here: { x: number; y: number };
  /** Ticks until each tile (key y * width + x) burns; tiles not in it are safe. */
  danger: Map<number, number>;
  safe(x: number, y: number): boolean;
  /** Living rivals the bot can see (a sneaking panther is out of sight). */
  rivals: Player[];
  /** Goes after rivals (its level or personality does, or it is fired up). */
  hunting: boolean;
  /** Tiles the bot can walk to, nearest first, with their steps (`plan` only). */
  nodes: readonly { x: number; y: number; steps: number }[];
  /** Whether the bot could still get to a safe tile with `bomb` down too. */
  escapes(bomb: Bomb): boolean;
  /** What a bomb at (x, y) with this range and type would hit (blocks 1, rivals 5 each). */
  bombValue(x: number, y: number, range: number, type: Bomb["type"]): number;
  /** Whether a falling sudden-death wall lands on (x, y) soon (no shield nor bubble helps then). */
  crushSoon(x: number, y: number): boolean;
}

export interface SpecialPlan {
  attack?(c: SpecialContext): Aim;
  defend?(c: SpecialContext): Aim;
  plan?(c: SpecialContext): Aim;
}

/** How far down a line lula leaves his picanha for a rival. */
const PICANHA_REACH = 4;

const FACINGS: Facing[] = ["up", "down", "left", "right"];

/** The bot's facing first: a shot that needs no turn wins ties. */
const facings = (p: Player): Facing[] => [p.facing, ...FACINGS.filter((f) => f !== p.facing)];

/** The living player (other than `p`) on (x, y). */
const playerOn = (c: SpecialContext, x: number, y: number) =>
  c.s.players.find((o) => o !== c.p && o.alive && tileOf(o).x === x && tileOf(o).y === y);

/** A rival worth hitting: not already stunned or wrapped up (hitting them again is a waste). */
const fresh = (o: Player) => o.stun === 0 && o.webbed === 0;

interface LineRules {
  range: number;
  /** Goes through blocks (goku's beam breaks them). */
  blocks?: boolean;
  /** Goes past bombs (goku's beam leaves them alone, harry's stag leaps them). */
  bombs?: boolean;
}

/** A shot straight ahead that hits the first player in its way: fired at a fresh rival with nothing (or no shield) between. */
function lineShot(rules: LineRules): SpecialPlan {
  return {
    attack(c) {
      for (const f of facings(c.p)) {
        const [dx, dy] = DIR_VECTORS[f];
        for (let i = 1; i <= rules.range; i++) {
          const x = c.here.x + dx * i;
          const y = c.here.y + dy * i;
          const tile = getTile(c.s, x, y);
          if (tile === Tile.Wall || (tile === Tile.Block && !rules.blocks)) break;
          if (!rules.bombs && bombAt(c.s, x, y)) break;
          if (shieldAt(c.s, x, y, dx, dy)) break; // it would come back
          const o = playerOn(c, x, y);
          if (o) {
            if (fresh(o)) return f;
            break;
          }
        }
      }
      return undefined;
    },
  };
}

/**
 * A dash straight ahead into the first player in its way, up to `range` tiles, through tiles that stay safe. With
 * `drivesOn` it does not stop there (optimus shoves them along): every tile left on the road must be safe too.
 */
function dash(range: number, drivesOn = false): SpecialPlan {
  return {
    attack(c) {
      for (const f of facings(c.p)) {
        const [dx, dy] = DIR_VECTORS[f];
        let target = false;
        for (let i = 1; i <= range; i++) {
          const x = c.here.x + dx * i;
          const y = c.here.y + dy * i;
          if (getTile(c.s, x, y) !== Tile.Empty || bombAt(c.s, x, y) || shieldAt(c.s, x, y, dx, dy)) break;
          const o = !target && playerOn(c, x, y);
          if (o) {
            if (!fresh(o)) break;
            target = true;
            if (!drivesOn) return f;
            continue;
          }
          if (!c.safe(x, y)) {
            target = false;
            break;
          }
        }
        if (target) return f;
      }
      return undefined;
    },
  };
}

/** Rivals in reach of a shock all around the bot (`range` tiles each way, stopped as the special is); undefined if a shield faces it. */
function around(c: SpecialContext, range: number, stoppedByTiles: boolean): Aim {
  let hits = false;
  const on = playerOn(c, c.here.x, c.here.y);
  if (on && fresh(on)) hits = true;
  for (const f of FACINGS) {
    const [dx, dy] = DIR_VECTORS[f];
    for (let i = 1; i <= range; i++) {
      const x = c.here.x + dx * i;
      const y = c.here.y + dy * i;
      if (stoppedByTiles && (getTile(c.s, x, y) !== Tile.Empty || bombAt(c.s, x, y))) break;
      if (shieldAt(c.s, x, y, dx, dy)) return undefined; // the shock would come back into us
      const o = playerOn(c, x, y);
      if (o && fresh(o)) hits = true;
    }
  }
  return hits ? null : undefined;
}

/** Where bugs comes out digging toward `f` (as `tunnel` in special.ts picks it), if anywhere. */
function tunnelExit(c: SpecialContext, f: Facing): { x: number; y: number; i: number } | undefined {
  const [dx, dy] = DIR_VECTORS[f];
  for (let i = TUNNEL_RANGE; i > 0; i--) {
    const x = c.here.x + dx * i;
    const y = c.here.y + dy * i;
    if (getTile(c.s, x, y) !== Tile.Empty || bombAt(c.s, x, y) || hasFlame(c.s, x, y) || playerOn(c, x, y)) continue;
    return { x, y, i };
  }
  return undefined;
}

/** Fire-only danger the bot can sit out for `ticks`: no wall about to fall on it, burning by then and burnt out before. */
const sitOut = (c: SpecialContext, ticks: number) => {
  const t = c.danger.get(c.here.y * c.s.grid.width + c.here.x);
  return t !== undefined && t > 0 && t + FLAME_TICKS < ticks && !c.crushSoon(c.here.x, c.here.y);
};

export const SPECIAL_PLANS: Partial<Record<CharacterId, SpecialPlan>> = {
  thor: lineShot({ range: BOLT_RANGE }),
  spider: lineShot({ range: WEB_RANGE }),
  static: lineShot({ range: MAGNET_RANGE }),
  penelope: lineShot({ range: KISS_RANGE }),
  pele: lineShot({ range: BALL_RANGE }),
  goku: lineShot({ range: KAME_RANGE, blocks: true, bombs: true }),
  // The stag runs on to the first wall or block; a rival far down the line has long moved by the time it gets there.
  harry: lineShot({ range: 6, bombs: true }),
  naruto: dash(RASENGAN_RANGE),
  optimus: dash(TRUCK_RANGE, true),
  flash: {
    // Through every player in the way, stopping on the last free tile before a wall, block or bomb: that tile must be safe.
    attack(c) {
      for (const f of facings(c.p)) {
        const [dx, dy] = DIR_VECTORS[f];
        let land = 0;
        let hits = false;
        let ok = true;
        for (let i = 1; i <= FLASH_RANGE; i++) {
          const x = c.here.x + dx * i;
          const y = c.here.y + dy * i;
          if (getTile(c.s, x, y) !== Tile.Empty || bombAt(c.s, x, y)) break;
          if (shieldAt(c.s, x, y, dx, dy)) {
            ok = false;
            break;
          }
          const o = playerOn(c, x, y);
          if (o) hits ||= fresh(o);
          else land = i;
        }
        if (ok && hits && c.safe(c.here.x + dx * land, c.here.y + dy * land)) return f;
      }
      return undefined;
    },
  },
  pikachu: { attack: (c) => around(c, THUNDER_RANGE, true) },
  lula: {
    // Leaves the picanha on the free tile toward a fresh rival 2 to PICANHA_REACH tiles down a clear line: they come for it.
    attack(c) {
      for (const f of facings(c.p)) {
        const [dx, dy] = DIR_VECTORS[f];
        const nx = c.here.x + dx;
        const ny = c.here.y + dy;
        if (getTile(c.s, nx, ny) !== Tile.Empty || bombAt(c.s, nx, ny) || hasFlame(c.s, nx, ny) || playerOn(c, nx, ny)) continue;
        if (c.s.items.some((i) => i.x === nx && i.y === ny)) continue;
        for (let i = 2; i <= PICANHA_REACH; i++) {
          const x = c.here.x + dx * i;
          const y = c.here.y + dy * i;
          if (getTile(c.s, x, y) !== Tile.Empty || bombAt(c.s, x, y)) break;
          const o = playerOn(c, x, y);
          if (o) {
            if (fresh(o)) return f;
            break;
          }
        }
      }
      return undefined;
    },
  },
  donatello: { attack: (c) => around(c, 1, false) },
  panther: {
    // Slips out of sight when closing in on a rival.
    attack: (c) => (c.hunting && c.p.sneak === 0 && c.rivals.some((o) => Math.abs(tileOf(o).x - c.here.x) + Math.abs(tileOf(o).y - c.here.y) <= 3) ? null : undefined),
  },
  captain: {
    // Every bomb that would burn his tile on one side of him, going off while the shield is up: he faces them.
    defend(c) {
      if (c.crushSoon(c.here.x, c.here.y)) return undefined;
      let side: Facing | undefined;
      for (const b of c.s.bombs) {
        if (b.air || b.heldBy) continue;
        if (b.x === c.here.x && b.y === c.here.y) return undefined; // under him: no shield helps
        const f = sideOf(c, b);
        if (!f) continue;
        if ((side && side !== f) || (b.type === "remote" && b.ownerId !== c.p.id) || b.fuse + 1 >= SHIELD_TICKS) return undefined;
        side = f;
      }
      const t = c.danger.get(c.here.y * c.s.grid.width + c.here.x);
      return side && t !== undefined && t > 0 ? side : undefined;
    },
  },
  // No fire gets into the bubble: sit out a blast that is over before it gives way (he can still walk in it).
  lantern: { defend: (c) => (sitOut(c, BUBBLE_TICKS) ? null : undefined) },
  bugs: {
    // Dig out to a tile that stays safe.
    defend(c) {
      for (const f of facings(c.p)) {
        const out = tunnelExit(c, f);
        if (out && c.safe(out.x, out.y)) return f;
      }
      return undefined;
    },
    // Dig across to a rival it cannot walk to (or only the long way round).
    plan(c) {
      if (!c.hunting || c.rivals.length === 0) return undefined;
      const near = (x: number, y: number) =>
        Math.min(...c.rivals.map((o) => Math.abs(tileOf(o).x - x) + Math.abs(tileOf(o).y - y)));
      const from = near(c.here.x, c.here.y);
      for (const f of facings(c.p)) {
        const out = tunnelExit(c, f);
        if (!out || !c.safe(out.x, out.y) || near(out.x, out.y) > from - 3) continue;
        const walk = c.nodes.find((n) => n.x === out.x && n.y === out.y);
        if (!walk || walk.steps > out.i + 4) return f;
      }
      return undefined;
    },
  },
  bomb: {
    // A mega bomb is a bomb: only where it is worth it and he can still get away.
    plan(c) {
      if (bombAt(c.s, c.here.x, c.here.y)) return undefined;
      const range = effectiveRange(c.p) * 2;
      if (c.bombValue(c.here.x, c.here.y, range, "pierce") < 3) return undefined;
      const mega: Bomb = { ownerId: c.p.id, x: c.here.x, y: c.here.y, fuse: FUSE_TICKS, range, type: "pierce", slide: null, offset: 0, air: null, heldBy: null, mega: true };
      return c.escapes(mega) ? null : undefined;
    },
  },
};

/** Which side of the bot a bomb's blast would reach its tile from, if it does (pierce runs through blocks and bombs). */
function sideOf(c: SpecialContext, b: Bomb): Facing | undefined {
  const dx = Math.sign(b.x - c.here.x);
  const dy = Math.sign(b.y - c.here.y);
  if ((dx !== 0 && dy !== 0) || (dx === 0 && dy === 0)) return undefined;
  const dist = Math.abs(b.x - c.here.x) + Math.abs(b.y - c.here.y);
  if (dist > b.range) return undefined;
  for (let i = 1; i < dist; i++) {
    const x = c.here.x + dx * i;
    const y = c.here.y + dy * i;
    const tile = getTile(c.s, x, y);
    if (tile === Tile.Wall) return undefined;
    if (b.type !== "pierce" && (tile === Tile.Block || bombAt(c.s, x, y))) return undefined;
  }
  return FACINGS.find((f) => DIR_VECTORS[f][0] === dx && DIR_VECTORS[f][1] === dy);
}
