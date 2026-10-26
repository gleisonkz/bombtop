import { AIR_TICKS_PER_TILE, DIR_VECTORS, TILE, type Player } from "@bombtop/shared";
import { airLift } from "./air-arc";
import { between } from "./sprites";

interface CarryPose {
  player: Player;
  x: number;
  y: number;
  groundY: number;
  depth: number;
  carrying: boolean;
  elevated: boolean;
}

export function playerCarryPoses({ players, previous, alpha, bodyHeight }: {
  players: readonly Player[];
  previous: ReadonlyMap<string, { px: number; py: number }>;
  alpha: number;
  bodyHeight: (player: Player) => number;
}): CarryPose[] {
  const byId = new Map(players.map(player => [player.id, player]));
  const holders = new Set(players.filter(player => player.alive && player.heldBy).map(player => player.heldBy));
  const resolved = new Map<string, CarryPose>();
  const visiting = new Set<string>();
  const resolve = (player: Player): CarryPose => {
    const found = resolved.get(player.id);
    if (found) return found;
    visiting.add(player.id);
    const position = player.heldBy || player.thrown ? player : between(previous.get(player.id) ?? player, player, alpha);
    const pose: CarryPose = {
      player, x: position.px / TILE * 16, y: position.py / TILE * 16,
      groundY: position.py / TILE * 16, depth: position.py / TILE * 16,
      carrying: holders.has(player.id), elevated: !!player.heldBy || !!player.thrown,
    };
    const holder = player.heldBy ? byId.get(player.heldBy) : undefined;
    if (player.alive && holder?.alive && !visiting.has(holder.id)) {
      const parent = resolve(holder);
      pose.x = parent.x;
      pose.y = parent.y - bodyHeight(holder);
      pose.groundY = parent.groundY;
      pose.depth = parent.depth + 0.01;
    } else if (player.thrown) {
      const progress = Math.min(AIR_TICKS_PER_TILE, player.thrown.progress + Math.max(0, Math.min(1, alpha)));
      const [dx, dy] = DIR_VECTORS[player.thrown.dir];
      pose.x += dx * 16 * progress / AIR_TICKS_PER_TILE;
      pose.groundY += dy * 16 * progress / AIR_TICKS_PER_TILE;
      pose.y = pose.groundY - airLift({ ...player.thrown, progress });
      pose.depth = pose.groundY;
    }
    visiting.delete(player.id);
    resolved.set(player.id, pose);
    return pose;
  };
  for (const player of players) resolve(player);
  return [...resolved.values()];
}
