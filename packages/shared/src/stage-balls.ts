import { TILE } from "./constants";
import { playerElevated } from "./player-carry";
import { nextSb4Random } from "./sb4-rng";
import type { StageBall } from "./stage-state";
import { bombAt, DIR_VECTORS, getTile, hasFlame, Tile, type Facing, type MatchState } from "./state";

const DIRECTIONS: readonly Facing[] = ["up", "right", "down", "left"];

function chooseSegment(s: MatchState, ball: StageBall): void {
  if (!ball.dir) return;
  const current = DIRECTIONS.indexOf(ball.dir);
  const turns = (ball.turnOrder ?? 0) % 2 === 0 ? [0, 1, 3, 2] : [0, 3, 1, 2];
  const x = Math.floor(ball.px / TILE);
  const y = Math.floor(ball.py / TILE);
  let canBreak = (ball.travelRemaining ?? 8 * TILE) < 8 * TILE;
  for (const turn of turns) {
    const direction = DIRECTIONS[(current + turn) % 4]!;
    const [dx, dy] = DIR_VECTORS[direction];
    const nx = x + dx;
    const ny = y + dy;
    const tile = getTile(s, nx, ny);
    if (tile === Tile.Block && canBreak) {
      s.grid.tiles[ny * s.grid.width + nx] = Tile.Empty;
      canBreak = false;
    }
    const other = s.stageState?.balls?.some(b => b !== ball && Math.floor(b.px / TILE) === nx && Math.floor(b.py / TILE) === ny);
    if (tile !== Tile.Empty || other || hasFlame(s, nx, ny)) continue;
    ball.dir = direction;
    ball.segmentRemaining = TILE;
    return;
  }
  ball.dir = null;
  ball.segmentRemaining = 0;
}

export function activateStageBall(s: MatchState, ball: StageBall, direction: Facing, ownerId?: string): void {
  if (ball.dir !== null) return;
  const random = nextSb4Random({ seed: s.rng, bound: 0xff });
  s.rng = random.seed;
  ball.turnOrder = random.value & 3;
  ball.dir = direction;
  ball.travelRemaining = 8 * TILE;
  if (ownerId) ball.ownerId = ownerId;
  chooseSegment(s, ball);
}

function ballHits(s: MatchState, ball: StageBall): void {
  const bomb = bombAt(s, Math.floor(ball.px / TILE), Math.floor(ball.py / TILE));
  if (bomb) bomb.fuse = 0;
  for (const p of s.players) {
    if (p.alive && !playerElevated(p) && Math.abs(p.px - ball.px) < TILE / 2 && Math.abs(p.py - ball.py) < TILE / 2 && p.jumpTicks === 0) p.alive = false;
  }
}

export function updateStageBalls(s: MatchState): void {
  for (const ball of s.stageState?.balls ?? []) {
    if (!ball.dir) continue;
    ball.travelRemaining ??= 8 * TILE;
    if (!ball.segmentRemaining) chooseSegment(s, ball);
    if (!ball.dir) continue;
    const [dx, dy] = DIR_VECTORS[ball.dir];
    const amount = Math.min(ball.travelRemaining, ball.segmentRemaining ?? TILE, TILE / 16);
    ball.px += dx * amount;
    ball.py += dy * amount;
    ball.travelRemaining -= amount;
    ball.segmentRemaining = (ball.segmentRemaining ?? TILE) - amount;
    ballHits(s, ball);
    if (ball.travelRemaining <= 0) ball.dir = null;
    else if (ball.segmentRemaining <= 0) chooseSegment(s, ball);
  }
}

export function forecastStageBalls(s: MatchState, horizon: number): { x: number; y: number; ticks: number }[] {
  const balls = s.stageState?.balls;
  if (!balls?.length) return [];
  const forecast: MatchState = {
    ...s,
    grid: { ...s.grid, tiles: s.grid.tiles.slice() },
    players: [],
    bombs: [],
    stageState: { balls: balls.map(ball => ({ ...ball })) },
  };
  const result: { x: number; y: number; ticks: number }[] = [];
  const record = (ticks: number) => {
    for (const ball of forecast.stageState!.balls!) result.push({ x: Math.floor(ball.px / TILE), y: Math.floor(ball.py / TILE), ticks });
  };
  record(0);
  for (let ticks = 1; ticks <= horizon && forecast.stageState!.balls!.some(ball => ball.dir); ticks++) {
    updateStageBalls(forecast);
    record(ticks);
  }
  return result;
}
