import { CONVEYOR_SPEED, KICK_SPEED, TILE } from "./constants";
import { conveyorDirection } from "./floor";
import { playerElevated } from "./player-carry";
import { stageSolid } from "./stage-obstacles";
import {
  bombAt,
  DIR_VECTORS,
  Floor,
  getTile,
  getFloor,
  playerTile,
  tileCenter,
  Tile,
  type Direction,
  type Bomb,
  type MatchState,
  type Player,
} from "./state";

/**
 * A player with kick who is pressed against a resting bomb (stopped at their
 * tile center, facing it) sends it sliding.
 */
export function tryKick(s: MatchState, p: Player, dir: Direction): void {
  if (!dir || !p.alive || playerElevated(p) || p.stun > 0 || p.canBombPass || !(p.canKick || p.mount === "pusher")) return;
  const { x, y } = playerTile(p);
  if (p.px !== tileCenter(x) || p.py !== tileCenter(y)) return;
  const [dx, dy] = DIR_VECTORS[dir];
  const bomb = bombAt(s, x + dx, y + dy);
  if (bomb && !bomb.slide) {
    bomb.slide = dir;
    bomb.kickedBy = p.id;
  }
}

export function stopKickedBombs(s: MatchState, p: Player): void {
  if (!p.alive || p.canBombPass || !(p.canKick || p.mount === "pusher")) return;
  for (const bomb of s.bombs) {
    if ((bomb.kickedBy ?? bomb.ownerId) !== p.id || !bomb.slide || bomb.conveyor) continue;
    bomb.slide = null;
    bomb.offset = 0;
  }
}

/** A sliding bomb may enter empty tiles with no bomb and no living player. */
function freeForBomb(s: MatchState, bomb: Bomb, x: number, y: number): boolean {
  if (getTile(s, x, y) !== Tile.Empty || bombAt(s, x, y) || stageSolid(s, x, y) || getFloor(s, x, y) === Floor.Slot) return false;
  if (s.bombs.some(other => {
    if (other === bomb || other.air || other.heldBy || !other.slide || other.offset === 0) return false;
    const [dx, dy] = DIR_VECTORS[other.slide];
    return other.x + dx === x && other.y + dy === y;
  })) return false;
  return !s.players.some((p) => {
    if (!p.alive || playerElevated(p)) return false;
    const t = playerTile(p);
    return t.x === x && t.y === y;
  });
}

function followConveyor(s: MatchState, b: Bomb): void {
  if (b.offset !== 0) return;
  const belt = conveyorDirection(getFloor(s, b.x, b.y));
  if (belt) {
    b.slide = belt;
    b.conveyor = true;
  } else if (b.conveyor) {
    b.slide = null;
    delete b.conveyor;
  }
}

export function updateSlides(s: MatchState): void {
  for (const b of s.bombs) {
    if (b.air || b.heldBy) {
      b.slide = null;
      b.offset = 0;
      delete b.conveyor;
      continue;
    }
    followConveyor(s, b);
    if (!b.slide) continue;
    const [dx, dy] = DIR_VECTORS[b.slide];
    if (!freeForBomb(s, b, b.x + dx, b.y + dy)) {
      b.slide = null;
      b.offset = 0;
      continue;
    }
    b.offset += b.conveyor ? CONVEYOR_SPEED : KICK_SPEED;
    if (b.offset >= TILE) {
      b.x += dx;
      b.y += dy;
      b.offset -= TILE;
      if (b.conveyor) s.items = s.items.filter(item => item.x !== b.x || item.y !== b.y);
    }
  }
}
