import { TILE } from "./constants";
import { movePlayer } from "./movement";
import { playerElevated } from "./player-carry";
import { bombAt, DIR_VECTORS, getTile, playerTile, tileCenter, Tile, type MatchState, type Player, type PlayerInput } from "./state";

const PACE = TILE / 4;

export function tryPush(s: MatchState, p: Player, inputs: Record<string, PlayerInput>): boolean {
  if (!p.alive || !p.canPush || p.mount || p.shove || p.stun > 0 || p.webbed > 0 || playerElevated(p)) return false;
  const { x, y } = playerTile(p);
  if (p.px !== tileCenter(x) || p.py !== tileCenter(y)) return false;
  const [dx, dy] = DIR_VECTORS[p.facing];
  const tx = x + dx;
  const ty = y + dy;
  if (getTile(s, tx, ty) !== Tile.Empty || bombAt(s, tx, ty)) return false;
  const rival = s.players.find((other) => other.id !== p.id && other.alive && !playerElevated(other) && playerTile(other).x === tx && playerTile(other).y === ty);
  if (rival) {
    if (rival.shove || inputs[rival.id]?.brace) return false;
    const nx = tx + dx;
    const ny = ty + dy;
    if (getTile(s, nx, ny) !== Tile.Empty || bombAt(s, nx, ny)) return false;
    if (s.players.some((other) => other.id !== rival.id && other.id !== p.id && other.alive && playerTile(other).x === nx && playerTile(other).y === ny)) return false;
    rival.shove = { dir: p.facing, pace: PACE, ticks: 12 };
  }
  p.shove = { dir: p.facing, pace: PACE, ticks: 4 };
  return true;
}

export function updatePushMotions(s: MatchState): void {
  for (const p of s.players) {
    const shove = p.shove;
    if (!shove) continue;
    if (!p.alive) {
      delete p.shove;
      continue;
    }
    const [dx, dy] = DIR_VECTORS[shove.dir];
    const { x, y } = playerTile(p);
    const nextX = x + dx;
    const nextY = y + dy;
    const blocked = s.players.some((other) => other.id !== p.id && other.alive && !other.shove && playerTile(other).x === nextX && playerTile(other).y === nextY);
    if (blocked) {
      delete p.shove;
      continue;
    }
    const px = p.px;
    const py = p.py;
    movePlayer(s, p, shove.dir, shove.pace);
    if (p.px === px && p.py === py || --shove.ticks <= 0) delete p.shove;
  }
}
