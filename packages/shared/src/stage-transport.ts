import { launch } from "./air";
import { TILE } from "./constants";
import { playerElevated } from "./player-carry";
import { bombAt, DIR_VECTORS, OPPOSITE_DIRECTIONS, Floor, getTile, hasFlame, playerTile, tileCenter, Tile, type Facing, type MatchState, type Player, type PlayerInput } from "./state";
import type { StageSeesaw } from "./stage-state";
import { initializeTrolley, updateTrolley } from "./stage-trolley";

const FLIGHT_TICKS = 24;
const FLIGHT_TILES = 3;
const SEESAW_COOLDOWN = 30;

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
    groups.push({ ...center, dir: horizontal ? "right" : "down", raised: false, cooldown: 0 });
  }
  return groups;
}

export function initializeStageTransport(s: MatchState): void {
  if (s.stage !== "sb4-09" && s.stage !== "sb4-11") return;
  const state = s.stageState ??= {};
  if (s.stage === "sb4-09") state.seesaws ??= seesawGroups(s);
  if (s.stage === "sb4-11") initializeTrolley(s);
}

function safeLanding(s: MatchState, x: number, y: number): boolean {
  return getTile(s, x, y) === Tile.Empty && !bombAt(s, x, y) && !hasFlame(s, x, y) && s.grid.floor[y * s.grid.width + x] !== Floor.Pit;
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

function startFlight(s: MatchState, p: Player, dir: Facing): void {
  if (playerElevated(p)) return;
  const [dx, dy] = DIR_VECTORS[dir];
  const from = playerTile(p);
  let distance = 0;
  for (let step = 1; step <= FLIGHT_TILES; step++) {
    const x = from.x + dx * step;
    const y = from.y + dy * step;
    if (getTile(s, x, y) === Tile.Wall) break;
    if (safeLanding(s, x, y)) distance = step;
  }
  if (!distance) return;
  p.px = tileCenter(from.x);
  p.py = tileCenter(from.y);
  (s.stageState!.flights ??= {})[p.id] = { dir, ticks: FLIGHT_TICKS, remaining: distance * TILE };
}

function updateFlights(s: MatchState): void {
  const flights = s.stageState?.flights;
  if (!flights) return;
  for (const [id, flight] of Object.entries(flights)) {
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

function endpoint(seesaw: StageSeesaw, low: boolean) {
  const sign = low === seesaw.raised ? 1 : -1;
  const [dx, dy] = DIR_VECTORS[seesaw.dir];
  return { x: seesaw.x + dx * sign, y: seesaw.y + dy * sign, dir: sign > 0 ? seesaw.dir : OPPOSITE_DIRECTIONS[seesaw.dir] };
}

function updateSeesaws(s: MatchState): void {
  const seesaws = s.stageState?.seesaws;
  if (!seesaws?.length) return;
  for (const saw of seesaws) saw.cooldown = Math.max(0, (saw.cooldown ?? 0) - 1);
  const triggered = seesaws.some(saw => {
    if (saw.cooldown) return false;
    const low = endpoint(saw, true);
    return s.players.some(p => {
      const tile = playerTile(p);
      return p.alive && !playerElevated(p) && !s.stageState?.flights?.[p.id] && !p.jumpTicks && tile.x === low.x && tile.y === low.y;
    });
  });
  if (!triggered) return;
  for (const saw of seesaws) {
    const high = endpoint(saw, false);
    for (const p of s.players) {
      const tile = playerTile(p);
      if (p.alive && !s.stageState?.flights?.[p.id] && tile.x === high.x && tile.y === high.y) startFlight(s, p, high.dir);
    }
    for (const bomb of s.bombs) if (!bomb.air && !bomb.heldBy && bomb.x === high.x && bomb.y === high.y) launch(bomb, high.dir);
    saw.raised = !saw.raised;
    saw.cooldown = SEESAW_COOLDOWN;
  }
}


export function updateStageTransport(s: MatchState): void {
  if (s.stage === "sb4-09") { updateFlights(s); updateSeesaws(s); }
  if (s.stage === "sb4-11") updateTrolley(s);
}

export function stageTransportInput(s: MatchState, p: Player, _input?: PlayerInput): boolean {
  return !!s.stageState?.flights?.[p.id] || s.stageState?.trolley?.riderId === p.id;
}



