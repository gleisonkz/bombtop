import { TILE } from "./constants";
import { nextRandom } from "./rng";
import { playerElevated } from "./player-carry";
import { initializeStageTransport, stageTransportInput, updateStageTransport } from "./stage-transport";
import { igniteStageSlots, updateStageSlots } from "./stage-slots";
import { igniteSurpriseFloor, stopStageStickyBombs } from "./stage-surprise";
import { bombAt, DIR_VECTORS, OPPOSITE_DIRECTIONS, Floor, getFloor, getTile, playerTile, tileCenter, Tile, type Facing, type MatchState, type Player, type PlayerInput } from "./state";

export function initializeStageMechanics(s: MatchState): void {
  if (!s.stage?.startsWith("sb4-")) return;
  s.stageState ??= {};
  if (s.stage === "sb4-03") s.stageState.balls = [{ px: tileCenter(5), py: tileCenter(5), dir: null }, { px: tileCenter(9), py: tileCenter(7), dir: null }];
  if (s.stage === "sb4-08") s.stageState.roulette = { cooldown: 0, until: 0, active: false };
  if (s.stage === "sb4-10") {
    const spots = s.grid.tiles.flatMap((tile, index) => tile === Tile.Block && !s.items.some(item => item.y * s.grid.width + item.x === index) ? [index] : []);
    const honey = [];
    for (let count = 0; count < 8 && spots.length; count++) {
      const [index] = spots.splice(Math.floor(nextRandom(s) * spots.length), 1);
      honey.push({ x: index! % s.grid.width, y: Math.floor(index! / s.grid.width) });
    }
    s.stageState.honey = honey;
  }
  if (s.stage === "sb4-12") {
    s.stageState.flags = s.players.map(p => ({ ...playerTile(p), ownerId: p.id }));
  }
  initializeStageTransport(s);
}

export function stageInput(s: MatchState, p: Player, input?: PlayerInput): boolean {
  if (stageTransportInput(s, p, input)) return true;
  if (s.stage !== "sb4-12" || !s.stageState?.flags) return false;
  const flags = s.stageState.flags;
  const carried = flags.find(flag => flag.carriedBy === p.id && !flag.destroyed);
  if (carried && input?.action) {
    Object.assign(carried, playerTile(p));
    delete carried.carriedBy;
    (s.stageState.floorLocks ??= {})[`flag:${p.id}`] = s.tick + 20;
    return true;
  }
  return false;
}

export function carriesStageFlag(s: MatchState, id: string): boolean {
  return !!s.stageState?.flags?.some(flag => flag.carriedBy === id && !flag.destroyed);
}

export function stageFlame(s: MatchState, x: number, y: number, ownerId?: string, direction?: Facing): boolean {
  igniteSurpriseFloor(s, x, y);
  igniteStageSlots(s, x, y);
  const ball = s.stageState?.balls?.find(b => Math.floor(b.px / TILE) === x && Math.floor(b.py / TILE) === y);
  if (!ball) return false;
  if (direction && ball.dir === null) {
    ball.dir = OPPOSITE_DIRECTIONS[direction];
    ball.travelRemaining = 8 * TILE;
    if (ownerId) ball.ownerId = ownerId;
  }
  return true;
}

function updateBalls(s: MatchState): void {
  for (const ball of s.stageState?.balls ?? []) {
    if (!ball.dir) continue;
    const [dx, dy] = DIR_VECTORS[ball.dir];
    const x = Math.floor(ball.px / TILE);
    const y = Math.floor(ball.py / TILE);
    const aheadX = x + dx;
    const aheadY = y + dy;
    const centered = ball.px === tileCenter(x) && ball.py === tileCenter(y);
    const other = s.stageState!.balls!.some(b => b !== ball && Math.floor(b.px / TILE) === aheadX && Math.floor(b.py / TILE) === aheadY);
    if (centered && (getTile(s, aheadX, aheadY) !== Tile.Empty || other)) {
      ball.dir = null;
      continue;
    }
    const amount = Math.min(ball.travelRemaining ?? 8 * TILE, TILE / 16);
    ball.px += dx * amount;
    ball.py += dy * amount;
    ball.travelRemaining = (ball.travelRemaining ?? 8 * TILE) - amount;
    const bomb = bombAt(s, Math.floor(ball.px / TILE), Math.floor(ball.py / TILE));
    if (bomb) bomb.fuse = 0;
    for (const p of s.players) {
      if (p.alive && !playerElevated(p) && Math.abs(p.px - ball.px) < TILE / 2 && Math.abs(p.py - ball.py) < TILE / 2 && p.jumpTicks === 0) p.alive = false;
    }
    if (ball.travelRemaining <= 0) ball.dir = null;
  }
}

function updateFlags(s: MatchState): void {
  for (const flag of s.stageState?.flags ?? []) {
    if (flag.destroyed) continue;
    const carrier = s.players.find(p => p.id === flag.carriedBy);
    if (carrier) {
      Object.assign(flag, playerTile(carrier));
      if (!carrier.alive) delete flag.carriedBy;
    }
    if (s.flames.some(f => f.x === flag.x && f.y === flag.y) || getTile(s, flag.x, flag.y) === Tile.Wall) {
      flag.destroyed = true;
      delete flag.carriedBy;
      const owner = s.players.find(p => p.id === flag.ownerId);
      if (owner) owner.alive = false;
      continue;
    }
    if (flag.carriedBy) continue;
    const p = s.players.find(player => {
      const tile = playerTile(player);
      return player.alive && !playerElevated(player) && tile.x === flag.x && tile.y === flag.y && !carriesStageFlag(s, player.id) && (s.stageState?.floorLocks?.[`flag:${player.id}`] ?? 0) <= s.tick;
    });
    if (p) flag.carriedBy = p.id;
  }
}

function collectCosplay(s: MatchState): void {
  for (const honey of s.stageState?.honey ?? []) {
    if (honey.takenBy || getTile(s, honey.x, honey.y) !== Tile.Empty) continue;
    const player = s.players.find(p => p.alive && !playerElevated(p) && playerTile(p).x === honey.x && playerTile(p).y === honey.y);
    if (!player || player.costume) continue;
    player.costume = nextRandom(s) < 0.5 ? "honey" : "kotetsu";
    player.curse = null;
    honey.takenBy = player.id;
  }
}

export function updateStageMechanics(s: MatchState, inputs: Record<string, PlayerInput> = {}): void {
  if (!s.stage?.startsWith("sb4-")) return;
  for (const p of s.players) {
    if (!p.alive || p.jumpTicks > 0 || p.heldBy || p.thrown || s.stageState?.flights?.[p.id]) continue;
    const { x, y } = playerTile(p);
    if (getFloor(s, x, y) === Floor.Pit) p.alive = false;
    const dir = inputs[p.id]?.dir;
    const touchesRope = x === 1 && dir === "left" || y === 1 && dir === "up" || x === s.grid.width - 2 && dir === "right" || y === s.grid.height - 2 && dir === "down";
    if (s.stage === "sb4-05" && touchesRope) p.stun = Math.max(p.stun, 20);
  }
  s.bombs = s.bombs.filter(b => b.air || b.heldBy || getFloor(s, b.x, b.y) !== Floor.Pit);
  stopStageStickyBombs(s);
  updateStageSlots(s);
  updateStageTransport(s);
  updateBalls(s);
  collectCosplay(s);
  updateFlags(s);
}

export function resolveStageHazards(s: MatchState): void {
  if (!s.stageState) return;
  updateFlags(s);
  for (const honey of s.stageState.honey ?? []) {
    if (!honey.takenBy && getTile(s, honey.x, honey.y) === Tile.Empty && s.flames.some(f => f.x === honey.x && f.y === honey.y && !f.block)) honey.takenBy = "burned";
  }
}
