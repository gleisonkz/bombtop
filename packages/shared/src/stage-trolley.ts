import { TILE } from "./constants";
import { playerElevated } from "./player-carry";
import { nextSb4TrolleyRoute, sb4TrolleyExit, sb4TrolleyRoute } from "./sb4-trolley-route";
import type { StageTrolley } from "./stage-state";
import { DIR_VECTORS, Floor, getTile, playerTile, tileCenter, Tile, type MatchState } from "./state";

const TROLLEY_SPEED = TILE / 8;
const TROLLEY_COOLDOWN = 60;
const BOARDING_DIRECTION_ROWS = [
  "2222222866666664", "4222221076666644", "4422211077666444", "4442111077764444",
  "4445111077733444", "4455511077333344", "4555551073333334", "8666666022222228",
  "0777777411111110", "007775345111110x", "0007733455111000", "0000333455510000",
  "0002333455560000", "0022233455666000", "0222223456666600", "2222222866666666",
] as const;
const BOARDING_DIRECTIONS = [
  [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, 0],
] as const;
const BOARDING_SENTINEL_VECTOR = [0x6b01, 0x20c2] as const;
const NATIVE_ORIGIN_X = 8;
const NATIVE_ORIGIN_Y = 24;
const BOARDING_CENTER_MASK = 0x1f0;
const BOARDING_VERTICAL = [
  [2, 0], [7, -1], [12, -3], [16, -7], [19, -12], [21, -18],
  [23, -23], [25, -26], [31, -27], [37, -21], [41, -13], [43, -4],
] as const;

function boardingVerticalOffset(tick: number): number {
  return BOARDING_VERTICAL.find(([until]) => tick <= until)?.[1] ?? 0;
}
const FINAL_RIDER_FOLLOW = [
  [false, true, false],
  [false, true, true],
  [false, false, false],
] as const;
const EXIT_SIDE = [
  [5, 0, -9], [10, 1, -11], [14, 3, -15], [17, 5, -20],
  [19, 7, -26], [21, 8, -31], [23, 9, -35], [29, 10, -37],
  [35, 11, -34], [39, 12, -30], [42, 13, -25], [45, 14, -19],
  [48, 15, -12], [61, 16, -8],
] as const;
const EXIT_UP = [
  [5, -9], [10, -11], [14, -15], [17, -20], [19, -26], [21, -31],
  [24, -35], [31, -37], [38, -34], [43, -30], [47, -25], [50, -24],
] as const;

function nativeExitOffset(dir: string, tick: number): [number, number] | null {
  if (dir === "up") {
    const keyframe = EXIT_UP.find(([until]) => tick <= until);
    return keyframe ? [0, keyframe[1]] : null;
  }
  if (dir !== "left" && dir !== "right") return null;
  const keyframe = EXIT_SIDE.find(([until]) => tick <= until);
  return keyframe ? [keyframe[1] * (dir === "left" ? -1 : 1), keyframe[2]] : null;
}

export function initializeTrolley(s: MatchState): void {
  const state = s.stageState ??= {};
  if (state.trolley) return;
  const choice = nextSb4TrolleyRoute(s.rng & 0xffff);
  const station = choice.variant;
  const route = sb4TrolleyRoute(1, station);
  const start = route[0]!;
  const index = start.y * s.grid.width + start.x;
  if (s.grid.tiles[index] === Tile.Block) s.grid.tiles[index] = Tile.Empty;
  s.grid.floor[index] = Floor.Rail;
  state.trolley = { px: tileCenter(start.x), py: tileCenter(start.y), dir: "up", route, index: 0, remaining: 0, cooldown: 0, routeRng: choice.seed, station };
}

function trolleyHits(s: MatchState, trolley: StageTrolley, previousPx: number, previousPy: number): void {
  const x = Math.floor(trolley.px / TILE);
  const y = Math.floor(trolley.py / TILE);
  const previousX = Math.floor(previousPx / TILE);
  const previousY = Math.floor(previousPy / TILE);
  const crossedLeftBoundary = trolley.px < previousPx && x < previousX;
  if (getTile(s, x, y) === Tile.Block) s.grid.tiles[y * s.grid.width + x] = Tile.Empty;
  for (const bomb of s.bombs) if (bomb.x === x && bomb.y === y) bomb.trolleyContactPending = true;
  const hitIds: string[] = [];
  for (const p of s.players) {
    const tile = playerTile(p);
    if (p.alive && p.id !== trolley.riderId && ((!crossedLeftBoundary && tile.x === x && tile.y === y) || (tile.x === previousX && tile.y === previousY))) hitIds.push(p.id);
  }
  if (hitIds.length) trolley.pendingHitIds = hitIds;
}

export function updateTrolley(s: MatchState): void {
  const trolley = s.stageState?.trolley;
  if (!trolley?.route?.length) return;
  for (const bomb of s.bombs) {
    if (!bomb.trolleyContactPending) continue;
    delete bomb.trolleyContactPending;
    bomb.fuse = 0;
  }
  if (trolley.pendingHitIds?.length) {
    const pending = new Set(trolley.pendingHitIds);
    for (const p of s.players) if (pending.has(p.id)) p.alive = false;
    delete trolley.pendingHitIds;
  }
  if (trolley.riderId && !s.players.some(p => p.id === trolley.riderId && p.alive)) {
    delete trolley.riderId;
    trolley.remaining = 0;
    trolley.cooldown = TROLLEY_COOLDOWN;
    delete trolley.phase;
    delete trolley.phaseTicks;
    return;
  }
  if (trolley.cooldown) { trolley.cooldown--; return; }
  if (!trolley.riderId) {
    const rider = s.players.find(p => p.alive && !playerElevated(p) && !s.stageState?.flights?.[p.id] && Math.floor(p.px / TILE) === Math.floor(trolley.px / TILE) && Math.floor(p.py / TILE) === Math.floor(trolley.py / TILE));
    if (!rider) return;
    const selection = nextSb4TrolleyRoute(trolley.routeRng ?? 24);
    trolley.routeRng = selection.seed;
    trolley.variant = selection.variant;
    trolley.route = sb4TrolleyRoute(selection.variant, trolley.station ?? 0);
    trolley.riderId = rider.id;
    trolley.remaining = trolley.route.length - 1;
    trolley.index = 0;
    trolley.phase = "boarding";
    trolley.phaseTicks = 43;
    return;
  }
  let boardingDeparture = false;
  if (trolley.phase === "boarding") {
    trolley.phaseTicks = (trolley.phaseTicks ?? 1) - 1;
    if (trolley.phaseTicks > 0) {
      const elapsed = 44 - trolley.phaseTicks;
      const rider = s.players.find(p => p.id === trolley.riderId);
      if (rider && elapsed >= 3) {
        const pixel = TILE / 16;
        const rawX = Math.round(rider.px / pixel);
        const rawY = Math.round(rider.py / pixel) - boardingVerticalOffset(elapsed - 1);
        const column = rawX & 15;
        const row = rawY & 15;
        const cell = BOARDING_DIRECTION_ROWS[row]![column];
        const [dx, dy] = cell === "x" ? BOARDING_SENTINEL_VECTOR : BOARDING_DIRECTIONS[Number(cell)]!;
        rider.px = (rawX + dx) * pixel;
        rider.py = (rawY + dy + boardingVerticalOffset(elapsed)) * pixel;
      }
      return;
    }
    trolley.phase = "riding";
    boardingDeparture = true;
  }
  if (trolley.phase === "leaving") {
    const variant = trolley.variant ?? 1;
    const station = trolley.station ?? 0;
    const exit = sb4TrolleyExit(variant, station);
    const follow = FINAL_RIDER_FOLLOW[station][variant];
    const elapsed = exit.ticks - (trolley.phaseTicks ?? 1) + 1;
    const rider = s.players.find(p => p.id === trolley.riderId);
    if (rider && (trolley.phaseTicks ?? 1) > 1) {
      if (follow && elapsed === 1) {
        rider.px = trolley.px;
        rider.py = trolley.py - TILE / 2;
      } else {
        const offset = nativeExitOffset(exit.dir, elapsed - (follow ? 1 : 0));
        if (offset) {
          rider.px = trolley.px + offset[0] * TILE / 16;
          rider.py = trolley.py + offset[1] * TILE / 16;
        }
      }
    }
    trolley.phaseTicks = (trolley.phaseTicks ?? 1) - 1;
    if (trolley.phaseTicks > 0) return;
    const start = trolley.route[0]!;
    const [dx, dy] = DIR_VECTORS[exit.dir];
    const offset = TILE / 16;
    if (rider) { rider.px = tileCenter(start.x + dx) - offset; rider.py = tileCenter(start.y + dy) - offset; }
    delete trolley.riderId;
    delete trolley.phase;
    delete trolley.phaseTicks;
    trolley.remaining = 0;
    return;
  }
  const next = ((trolley.index ?? 0) + 1) % trolley.route.length;
  const target = trolley.route[next]!;
  const dx = tileCenter(target.x) - trolley.px;
  const dy = tileCenter(target.y) - trolley.py;
  const previousPx = trolley.px;
  const previousPy = trolley.py;
  if (dx) trolley.dir = dx > 0 ? "right" : "left";
  else if (dy) trolley.dir = dy > 0 ? "down" : "up";
  trolley.px += Math.sign(dx) * Math.min(Math.abs(dx), TROLLEY_SPEED);
  trolley.py += Math.sign(dy) * Math.min(Math.abs(dy), TROLLEY_SPEED);
  const rider = s.players.find(p => p.id === trolley.riderId);
  if (rider) {
    if (boardingDeparture) {
      const pixel = TILE / 16;
      const nativeX = Math.round(rider.px / pixel) + NATIVE_ORIGIN_X;
      const nativeY = Math.round(rider.py / pixel) - boardingVerticalOffset(43) + NATIVE_ORIGIN_Y;
      rider.px = (((nativeX + 8) & BOARDING_CENTER_MASK) - 1 - NATIVE_ORIGIN_X) * pixel;
      rider.py = (((nativeY + 8) & BOARDING_CENTER_MASK) - 1 - NATIVE_ORIGIN_Y) * pixel;
    } else {
      rider.px = previousPx;
      rider.py = previousPy - TILE / 2;
    }
  }
  trolleyHits(s, trolley, previousPx, previousPy);
  if (trolley.px !== tileCenter(target.x) || trolley.py !== tileCenter(target.y)) return;
  trolley.index = next;
  trolley.remaining = (trolley.remaining ?? 1) - 1;
  if (trolley.remaining <= 0) { trolley.phase = "leaving"; trolley.phaseTicks = sb4TrolleyExit(trolley.variant ?? 1, trolley.station ?? 0).ticks; }
}
