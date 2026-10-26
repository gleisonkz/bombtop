import { TILE } from "./constants";
import { playerElevated } from "./player-carry";
import { nextSb4TrolleyRoute, sb4TrolleyExit, sb4TrolleyRoute } from "./sb4-trolley-route";
import type { StageTrolley } from "./stage-state";
import { DIR_VECTORS, Floor, getTile, playerTile, tileCenter, Tile, type MatchState } from "./state";

const TROLLEY_SPEED = TILE / 8;
const TROLLEY_COOLDOWN = 60;

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

function trolleyHits(s: MatchState, trolley: StageTrolley): void {
  const x = Math.floor(trolley.px / TILE);
  const y = Math.floor(trolley.py / TILE);
  if (getTile(s, x, y) === Tile.Block) s.grid.tiles[y * s.grid.width + x] = Tile.Empty;
  for (const bomb of s.bombs) if (bomb.x === x && bomb.y === y) bomb.fuse = 0;
  for (const p of s.players) {
    const tile = playerTile(p);
    if (p.alive && p.id !== trolley.riderId && tile.x === x && tile.y === y) p.alive = false;
  }
}

export function updateTrolley(s: MatchState): void {
  const trolley = s.stageState?.trolley;
  if (!trolley?.route?.length) return;
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
  if (trolley.phase === "boarding") {
    trolley.phaseTicks = (trolley.phaseTicks ?? 1) - 1;
    if (trolley.phaseTicks > 0) return;
    trolley.phase = "riding";
  }
  if (trolley.phase === "leaving") {
    trolley.phaseTicks = (trolley.phaseTicks ?? 1) - 1;
    if (trolley.phaseTicks > 0) return;
    const rider = s.players.find(p => p.id === trolley.riderId);
    const start = trolley.route[0]!;
    const [dx, dy] = DIR_VECTORS[sb4TrolleyExit(trolley.variant ?? 1, trolley.station ?? 0).dir];
    if (rider) { rider.px = tileCenter(start.x + dx); rider.py = tileCenter(start.y + dy); }
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
  if (dx) trolley.dir = dx > 0 ? "right" : "left";
  else if (dy) trolley.dir = dy > 0 ? "down" : "up";
  trolley.px += Math.sign(dx) * Math.min(Math.abs(dx), TROLLEY_SPEED);
  trolley.py += Math.sign(dy) * Math.min(Math.abs(dy), TROLLEY_SPEED);
  const rider = s.players.find(p => p.id === trolley.riderId);
  if (rider) { rider.px = trolley.px; rider.py = trolley.py; }
  trolleyHits(s, trolley);
  if (trolley.px !== tileCenter(target.x) || trolley.py !== tileCenter(target.y)) return;
  trolley.index = next;
  trolley.remaining = (trolley.remaining ?? 1) - 1;
  if (trolley.remaining <= 0) { trolley.phase = "leaving"; trolley.phaseTicks = sb4TrolleyExit(trolley.variant ?? 1, trolley.station ?? 0).ticks; }
}
