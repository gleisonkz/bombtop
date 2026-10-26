import { CONVEYOR_SPEED } from "./constants";
import { movePlayer } from "./movement";
import { Floor, getFloor, playerTile, tileCenter, type Facing, type MatchState } from "./state";

const BELTS: Partial<Record<Floor, Facing>> = {
  [Floor.ConveyorUp]: "up",
  [Floor.ConveyorDown]: "down",
  [Floor.ConveyorLeft]: "left",
  [Floor.ConveyorRight]: "right",
};

export function conveyorDirection(floor: Floor): Facing | undefined {
  return BELTS[floor];
}

/** Conveyor belts carry players; warps teleport them to the paired warp. */
export function applyFloor(s: MatchState): void {
  for (const p of s.players) {
    if (!p.alive || p.jumpTicks > 0) continue;
    const { x, y } = playerTile(p);
    const floor = getFloor(s, x, y);

    const belt = conveyorDirection(floor);
    if (belt) movePlayer(s, p, belt, CONVEYOR_SPEED);

    if (floor !== Floor.Warp) {
      p.warpLock = false;
      continue;
    }
    if (p.warpLock) continue;
    const i = s.grid.warps.findIndex((w) => w.x === x && w.y === y);
    const target = s.grid.warps[i ^ 1];
    if (i < 0 || !target) continue;
    p.px = tileCenter(target.x);
    p.py = tileCenter(target.y);
    p.warpLock = true;
  }
}
