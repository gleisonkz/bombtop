import { launch } from "./air";
import { TILE } from "./constants";
import { playerElevated } from "./player-carry";
import { bombAt, DIR_VECTORS, OPPOSITE_DIRECTIONS, Floor, getTile, playerTile, tileCenter, Tile, type Bomb, type Facing, type MatchState, type Player, type PlayerInput } from "./state";
import type { StageSeesaw } from "./stage-state";
import { initializeTrolley, updateTrolley } from "./stage-trolley";
import { startSeesawFlight, startSeesawRebounds, updateSeesawFlights, type SeesawLanding } from "./stage-seesaw-flight";

const FLIGHT_TILES = 3;
const SEESAW_COOLDOWN = 3;

function seesawGroups(s: MatchState): StageSeesaw[] {
  const visited = new Set<number>();
  const groups: StageSeesaw[] = [];
  for (let y = 0; y < s.grid.height; y++) for (let x = 0; x < s.grid.width; x++) {
    const index = y * s.grid.width + x;
    if (visited.has(index) || s.grid.floor[index] !== Floor.Seesaw) continue;
    const horizontal = s.grid.floor[index + s.grid.width] !== Floor.Seesaw;
    const cells: { x: number; y: number }[] = [];
    let cx = x;
    let cy = y;
    while (cx < s.grid.width && cy < s.grid.height && s.grid.floor[cy * s.grid.width + cx] === Floor.Seesaw) {
      visited.add(cy * s.grid.width + cx);
      cells.push({ x: cx, y: cy });
      if (horizontal) cx++; else cy++;
    }
    const center = cells[Math.floor(cells.length / 2)]!;
    groups.push({ ...center, dir: horizontal ? "right" : "down", raised: center.x < s.grid.width / 2, cooldown: 0 });
  }
  return groups;
}

export function initializeStageTransport(s: MatchState): void {
  if (s.stage !== "sb4-09" && s.stage !== "sb4-11") return;
  const state = s.stageState ??= {};
  if (s.stage === "sb4-09") state.seesaws ??= seesawGroups(s);
  if (s.stage === "sb4-11") initializeTrolley(s);
}

// A flame is no reason to come down elsewhere: in SB4 whoever lands in one burns (e-fly-over-fire).
function safeLanding(s: MatchState, x: number, y: number): boolean {
  return getTile(s, x, y) === Tile.Empty && !bombAt(s, x, y) && s.grid.floor[y * s.grid.width + x] !== Floor.Pit;
}

function finishFlight(s: MatchState, p: Player, dir: Facing): void {
  const [dx, dy] = DIR_VECTORS[dir];
  const landing = playerTile(p);
  for (let distance = 0; distance <= FLIGHT_TILES; distance++) {
    const x = landing.x - dx * distance;
    const y = landing.y - dy * distance;
    if (distance > 0 && getTile(s, x, y) === Tile.Wall) break;
    if (!safeLanding(s, x, y)) continue;
    p.px = tileCenter(x);
    p.py = tileCenter(y);
    return;
  }
  p.alive = false;
}

/**
 * Coming down on a bomb, a block or a pivot, a player hops on along the plank a tile at a time, 8 frames each and a
 * frame's rest between hops, to the first tile they can stand on (C22026; e-player-landing-blocked). Another player
 * is no obstacle.
 */
function bounceOn(s: MatchState, landing: SeesawLanding): boolean {
  const { player: p, dir } = landing;
  if (dir !== "left" && dir !== "right") return false;
  const { x, y } = playerTile(p);
  const pivot = s.stageState?.seesaws?.some(saw => saw.x === x && saw.y === y);
  if (!pivot && getTile(s, x, y) !== Tile.Block && !bombAt(s, x, y)) return false;
  if (getTile(s, x + DIR_VECTORS[dir][0], y) === Tile.Wall) return false;
  delete s.stageState!.floorLocks?.[`seesaw:land:${p.id}`];
  s.stageState!.flights![p.id] = { kind: "seesawRebound", dir, steering: dir, ticks: landing.rebound ? 9 : 8, remaining: 0 };
  return true;
}

function updateFlights(s: MatchState, inputs: Record<string, PlayerInput>): void {
  for (const landing of updateSeesawFlights(s, inputs)) if (!bounceOn(s, landing)) finishFlight(s, landing.player, landing.dir);
  const flights = s.stageState?.flights;
  if (!flights) return;
  for (const [id, flight] of Object.entries(flights)) {
    if (flight.kind === "seesaw" || flight.kind === "seesawRebound") continue;
    const p = s.players.find(player => player.id === id);
    if (!p?.alive || flight.ticks <= 0) { delete flights[id]; continue; }
    const amount = Math.ceil(flight.remaining / flight.ticks);
    const [dx, dy] = DIR_VECTORS[flight.dir];
    const x = Math.floor((p.px + dx * amount) / TILE);
    const y = Math.floor((p.py + dy * amount) / TILE);
    if (getTile(s, x, y) === Tile.Wall) {
      finishFlight(s, p, flight.dir);
      delete flights[id];
      continue;
    }
    p.px += dx * amount;
    p.py += dy * amount;
    flight.remaining -= amount;
    if (--flight.ticks <= 0) {
      finishFlight(s, p, flight.dir);
      delete flights[id];
    }
  }
}

/**
 * Native frames a seesaw's ends stay shut to fire after it turns (e-fire-vs-flight): the turning tick and the next,
 * while `cooldown` (SEESAW_COOLDOWN on the turn, one less a tick) is still at least this.
 */
const TURNING_COOLDOWN = SEESAW_COOLDOWN - 1;

/**
 * What stops fire and a sliding bomb on a seesaw (e-flame-into-end, e-flame-from-low-end; C13A63 for kicks): its
 * pivot, the end that is up and, while it turns, both ends. The end that is down lets them in.
 */
export function seesawBarrier(s: Pick<MatchState, "stageState">, x: number, y: number): boolean {
  for (const saw of s.stageState?.seesaws ?? []) {
    if (saw.x === x && saw.y === y) return true;
    const up = endpoint(saw, true);
    const down = endpoint(saw, false);
    if (up.x === x && up.y === y) return true;
    if (down.x === x && down.y === y && (saw.cooldown ?? 0) >= TURNING_COOLDOWN) return true;
  }
  return false;
}

function endpoint(seesaw: StageSeesaw, low: boolean) {
  const sign = low === seesaw.raised ? 1 : -1;
  const [dx, dy] = DIR_VECTORS[seesaw.dir];
  return { x: seesaw.x + dx * sign, y: seesaw.y + dy * sign, dir: sign > 0 ? seesaw.dir : OPPOSITE_DIRECTIONS[seesaw.dir] };
}

/** A seesaw throws a resting bomb across itself: 6 tiles in 12 frames (e-bomb-on-launch-end). */
const SEESAW_BOMB_TILES = 6;
const SEESAW_BOMB_TICKS_PER_TILE = 2;
/** Ticks a seesaw-thrown bomb takes for each tile it bounces on (e-bomb-launched-off-edge). */
export const SEESAW_BOUNCE_TICKS = 8;

function throwBomb(bomb: Bomb, dir: Facing): void {
  launch(bomb, dir);
  // It leaves on the frame after the turn: one tick more on the first tile.
  bomb.air = { ...bomb.air!, span: SEESAW_BOMB_TILES, tilesLeft: SEESAW_BOMB_TILES, progress: -1,
    ticksPerTile: SEESAW_BOMB_TICKS_PER_TILE, seesaw: true };
}

/** One tile on for a seesaw-thrown bomb, round a ring from one tile outside the arena's left (top) edge to one outside its right (bottom). */
export function seesawHop(s: Pick<MatchState, "grid">, bomb: Bomb, dir: Facing): void {
  const [dx, dy] = DIR_VECTORS[dir];
  const ring = (value: number, size: number) => ((value + 1) % (size + 2) + size + 2) % (size + 2) - 1;
  bomb.x = ring(bomb.x + dx, s.grid.width);
  bomb.y = ring(bomb.y + dy, s.grid.height);
}

/** Every seesaw turns: whoever and whatever rests on the end that goes up is thrown. */
function turnSeesaws(s: MatchState, inputs: Record<string, PlayerInput>): void {
  for (const saw of s.stageState?.seesaws ?? []) {
    const high = endpoint(saw, false);
    for (const p of s.players) {
      const tile = playerTile(p);
      if (!p.alive || s.stageState?.flights?.[p.id] || tile.x !== high.x || tile.y !== high.y) continue;
      // Someone stunned is thrown only once the stun is over (e-stunned-on-end-TT20): see launchUnstunned.
      if (p.stun > 0) (s.stageState!.floorLocks ??= {})[`${STUNNED}${p.id}`] = 0;
      else startSeesawFlight(s, p, high.dir, inputs[p.id]);
    }
    // Only a resting bomb: a sliding one is left alone.
    for (const bomb of s.bombs) if (!bomb.air && !bomb.heldBy && !bomb.slide && bomb.x === high.x && bomb.y === high.y) throwBomb(bomb, OPPOSITE_DIRECTIONS[high.dir]);
    saw.raised = !saw.raised;
    saw.cooldown = SEESAW_COOLDOWN;
  }
}

/** A bomb coming down on a seesaw's end that is up tips it, as a player stepping on it does (C127AB -> C128D6). */
export function bombLandedOnSeesaw(s: MatchState, bomb: Bomb): void {
  const saws = s.stageState?.seesaws;
  if (s.stage !== "sb4-09" || !saws?.length) return;
  const tips = saws.some(saw => {
    const up = endpoint(saw, true);
    return !saw.cooldown && up.x === bomb.x && up.y === bomb.y;
  });
  if (tips) turnSeesaws(s, {});
}

const STUNNED = "seesaw:stunned:";

/**
 * A player the seesaw tried to throw while stunned hops straight up where they stand on the tick after the stun is
 * over, whichever way the seesaw has turned since (e-stunned-on-end-TT20).
 */
function launchUnstunned(s: MatchState, inputs: Record<string, PlayerInput>): void {
  const locks = s.stageState?.floorLocks;
  for (const p of s.players) {
    const key = `${STUNNED}${p.id}`;
    const freedAt = locks?.[key];
    if (freedAt === undefined) continue;
    if (!p.alive) { delete locks![key]; continue; }
    if (p.stun > 0) continue;
    if (!freedAt) { locks![key] = s.tick; continue; }
    delete locks![key];
    const tile = playerTile(p);
    const saw = s.stageState!.seesaws!.find(saw => saw.y === tile.y && Math.abs(saw.x - tile.x) === 1);
    startSeesawFlight(s, p, saw && tile.x < saw.x ? "left" : "right", inputs[p.id]);
  }
}

function updateSeesaws(s: MatchState, inputs: Record<string, PlayerInput>): void {
  const seesaws = s.stageState?.seesaws;
  if (!seesaws?.length) return;
  launchUnstunned(s, inputs);
  for (const saw of seesaws) saw.cooldown = Math.max(0, (saw.cooldown ?? 0) - 1);
  const triggered = seesaws.some(saw => {
    if (saw.cooldown) return false;
    const low = endpoint(saw, true);
    return s.players.some(p => {
      const tile = playerTile(p);
      return p.alive && !playerElevated(p) && !s.stageState?.flights?.[p.id] && s.stageState?.floorLocks?.[`seesaw:land:${p.id}`] !== s.tick && !p.jumpTicks && tile.x === low.x && tile.y === low.y;
    });
  });
  if (triggered) turnSeesaws(s, inputs);
}


export function updateStageTransport(s: MatchState, inputs: Record<string, PlayerInput> = {}): void {
  if (s.stage === "sb4-09") { updateFlights(s, inputs); startSeesawRebounds(s, inputs); updateSeesaws(s, inputs); }
  if (s.stage === "sb4-11") updateTrolley(s);
}

/** A player coming down off a seesaw is not burnt on the frame they land, only from the next (e-fly-over-fire). */
export function landedOffSeesaw(s: Pick<MatchState, "stageState" | "tick">, p: Player): boolean {
  return s.stageState?.floorLocks?.[`seesaw:land:${p.id}`] === s.tick;
}

export function stageTransportInput(s: MatchState, p: Player, _input?: PlayerInput): boolean {
  return !!s.stageState?.flights?.[p.id] || s.stageState?.trolley?.riderId === p.id;
}



