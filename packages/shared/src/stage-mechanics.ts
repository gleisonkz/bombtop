import { TILE } from "./constants";
import { nextRandom } from "./rng";
import { playerElevated } from "./player-carry";
import { activateStageBall, updateStageBalls } from "./stage-balls";
import { initializeStageTransport, stageTransportInput, updateStageTransport } from "./stage-transport";
import { igniteStageSlots, updateStageSlots } from "./stage-slots";
import { igniteSurpriseFloor, initializeSurpriseSelection, stopStageStickyBombs } from "./stage-surprise";
import { stageFlagInput, initializeStageFlags, updateStageFlags } from "./stage-flags";
import { Floor, getFloor, getTile, playerTile, tileCenter, Tile, type Facing, type MatchState, type Player, type PlayerInput } from "./state";

export { carriesStageFlag } from "./stage-flags";

export function initializeStageMechanics(s: MatchState): void {
  if (!s.stage?.startsWith("sb4-")) return;
  s.stageState ??= {};
  initializeSurpriseSelection(s);
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
  initializeStageFlags(s);
  initializeStageTransport(s);
}

export function stageInput(s: MatchState, p: Player, input?: PlayerInput): boolean {
  if (stageTransportInput(s, p, input)) return true;
  return stageFlagInput(s, p, input);
}

export function stageFlame(s: MatchState, x: number, y: number, ownerId?: string, direction?: Facing, surpriseSample?: number | null): boolean {
  igniteSurpriseFloor(s, x, y, surpriseSample);
  igniteStageSlots(s, x, y);
  const ball = s.stageState?.balls?.find(b => Math.floor(b.px / TILE) === x && Math.floor(b.py / TILE) === y);
  if (!ball) return false;
  if (direction) activateStageBall(s, ball, direction, ownerId);
  return true;
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
  }
  s.bombs = s.bombs.filter(b => b.air || b.heldBy || getFloor(s, b.x, b.y) !== Floor.Pit);
  stopStageStickyBombs(s);
  updateStageSlots(s);
  updateStageTransport(s, inputs);
  updateStageBalls(s);
  collectCosplay(s);
  updateStageFlags(s);
}

export function resolveStageHazards(s: MatchState): void {
  if (!s.stageState) return;
  updateStageFlags(s);
  for (const honey of s.stageState.honey ?? []) {
    if (!honey.takenBy && getTile(s, honey.x, honey.y) === Tile.Empty && s.flames.some(f => f.x === honey.x && f.y === honey.y && !f.block)) honey.takenBy = "burned";
  }
}
