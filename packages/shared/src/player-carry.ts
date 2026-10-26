import { AIR_DISTANCE, AIR_TICKS_PER_TILE } from "./constants";
import { bombAt, DIR_VECTORS, getTile, playerTile, tileCenter, Tile, type MatchState, type Player, type PlayerInput } from "./state";

export function playerElevated(p: Player): boolean {
  return !!p.heldBy || !!p.thrown;
}

export function carriedPlayer(s: MatchState, holder: Player): Player | undefined {
  return s.players.find(p => p.alive && p.heldBy === holder.id);
}

export function playerCarryButton(s: MatchState, p: Player, input: PlayerInput, inputs: Record<string, PlayerInput>): boolean {
  const child = carriedPlayer(s, p);
  if (child) {
    if (!input.hold) {
      delete child.heldBy;
      const from = playerTile(p);
      child.px = tileCenter(from.x);
      child.py = tileCenter(from.y);
      child.thrown = { dir: p.facing, span: AIR_DISTANCE, tilesLeft: AIR_DISTANCE, progress: 0 };
    }
    return true;
  }
  if (!input.bomb || !p.canGlove || playerElevated(p)) return false;
  const from = playerTile(p);
  if (bombAt(s, from.x, from.y)) return false;
  const childToLift = s.players.find(other => {
    if (other === p || !other.alive || playerElevated(other) || other.jumpTicks > 0 || other.shove || inputs[other.id]?.brace || s.stageState?.flights?.[other.id] || s.stageState?.trolley?.riderId === other.id) return false;
    const tile = playerTile(other);
    return tile.x === from.x && tile.y === from.y;
  });
  if (!childToLift) return false;
  childToLift.heldBy = p.id;
  delete childToLift.shove;
  childToLift.charge = childToLift.rasengan = childToLift.truck = childToLift.dashTicks = 0;
  childToLift.px = p.px;
  childToLift.py = p.py;
  return true;
}

export function updateCarriedPlayers(s: MatchState): void {
  for (let pass = 0; pass < s.players.length; pass++) {
    for (const p of s.players) {
      if (!p.heldBy) continue;
      const holder = s.players.find(other => other.id === p.heldBy);
      if (!p.alive || !holder?.alive || !holder.canGlove) {
        delete p.heldBy;
        continue;
      }
      p.px = holder.px;
      p.py = holder.py;
    }
  }
}

export function updateThrownPlayers(s: MatchState): void {
  for (const p of s.players) {
    const air = p.thrown;
    if (!air) continue;
    if (!p.alive) { delete p.thrown; continue; }
    if (++air.progress < AIR_TICKS_PER_TILE) continue;
    air.progress = 0;
    const [dx, dy] = DIR_VECTORS[air.dir];
    const from = playerTile(p);
    const nx = from.x + dx;
    const ny = from.y + dy;
    const x = nx <= 0 ? s.grid.width - 2 : nx >= s.grid.width - 1 ? 1 : nx;
    const y = ny <= 0 ? s.grid.height - 2 : ny >= s.grid.height - 1 ? 1 : ny;
    p.px = tileCenter(x);
    p.py = tileCenter(y);
    if (x !== nx || y !== ny) air.tilesLeft = 1;
    if (--air.tilesLeft > 0) continue;
    const occupied = s.players.some(other => other !== p && other.alive && !playerElevated(other) && playerTile(other).x === x && playerTile(other).y === y);
    if (getTile(s, x, y) === Tile.Empty && !bombAt(s, x, y) && !occupied) {
      delete p.thrown;
      continue;
    }
    air.span = 1;
    air.tilesLeft = 1;
    air.bounces = (air.bounces ?? 0) + 1;
    if (air.bounces >= Math.max(s.grid.width, s.grid.height)) {
      p.alive = false;
      delete p.thrown;
    }
  }
}
