import { TILE } from "./constants";
import { canPlayerEnterTile } from "./movement";
import { playerElevated } from "./player-carry";
import { DIR_VECTORS, playerTile, tileCenter, type Facing, type MatchState, type Player } from "./state";

// C273F9 movement sequences: two native pixels per logic update.
const ICE_SPEED = TILE / 8;

/** Starts with one setup update, then finishes at the next lane center. */
export function moveIcePlayer(s: MatchState, p: Player, entryFacing: Facing): boolean {
  const stage = s.stageState ??= {};
  const slides = stage.iceSlides ??= {};
  const active = slides[p.id];
  if (!p.alive || playerElevated(p)) {
    delete slides[p.id];
    return false;
  }
  if (active) {
    const x = Math.floor(active.targetPx / TILE);
    const y = Math.floor(active.targetPy / TILE);
    if (!canPlayerEnterTile(s, p, x, y)) {
      delete slides[p.id];
      return true;
    }
    p.facing = active.dir;
    const [dx] = DIR_VECTORS[active.dir];
    if (dx !== 0) {
      p.py = active.targetPy;
      p.px += Math.sign(active.targetPx - p.px) * Math.min(ICE_SPEED, Math.abs(active.targetPx - p.px));
    } else {
      p.px = active.targetPx;
      p.py += Math.sign(active.targetPy - p.py) * Math.min(ICE_SPEED, Math.abs(active.targetPy - p.py));
    }
    if (p.px === active.targetPx && p.py === active.targetPy) delete slides[p.id];
    return true;
  }
  const from = playerTile(p);
  const [dx, dy] = DIR_VECTORS[entryFacing];
  const x = from.x + dx;
  const y = from.y + dy;
  if (!canPlayerEnterTile(s, p, x, y)) return false;
  slides[p.id] = { dir: entryFacing, targetPx: tileCenter(x), targetPy: tileCenter(y) };
  p.facing = entryFacing;
  return true;
}
