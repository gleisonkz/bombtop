import type { StageTrolleyStation, StageTrolleyVariant } from "./stage-state";
import { SB4_TROLLEY_PATHS } from "./sb4-trolley-paths";
import { nextSb4Random } from "./sb4-rng";

type Point = { x: number; y: number };

export function sb4TrolleyExit(variant: StageTrolleyVariant, station: StageTrolleyStation = 0) {
  return SB4_TROLLEY_PATHS[station].routes[variant].exit;
}

export function nextSb4TrolleyRoute(seed: number): { seed: number; variant: StageTrolleyVariant } {
  const next = nextSb4Random({ seed, bound: 3 });
  return { seed: next.seed, variant: next.value as StageTrolleyVariant };
}

function direction(from: Point, to: Point): Point {
  return { x: Math.sign(to.x - from.x), y: Math.sign(to.y - from.y) };
}

function straight(path: Point[], target: Point): void {
  let current = path.at(-1)!;
  while (current.x !== target.x || current.y !== target.y) {
    current = {
      x: current.x + Math.sign(target.x - current.x) * Math.min(2, Math.abs(target.x - current.x)),
      y: current.y + Math.sign(target.y - current.y) * Math.min(2, Math.abs(target.y - current.y)),
    };
    path.push(current);
  }
}

function turn(path: Point[], incoming: Point, outgoing: Point): void {
  for (const velocity of [incoming, { x: incoming.x + outgoing.x, y: incoming.y + outgoing.y }, outgoing]) {
    for (let frame = 0; frame < 2; frame++) {
      const current = path.at(-1)!;
      path.push({ x: current.x + velocity.x, y: current.y + velocity.y });
    }
  }
}

export function sb4TrolleyRoute(variant: StageTrolleyVariant = 1, station: StageTrolleyStation = 0): Point[] {
  const corners: Point[] = SB4_TROLLEY_PATHS[station].routes[variant].corners.map(([x, y]) => ({ x, y }));
  const path: Point[] = [{ ...corners[0]! }];
  for (let index = 1; index < corners.length; index++) {
    const corner = corners[index]!;
    const incoming = direction(corners[index - 1]!, corner);
    const next = corners[index + 1];
    straight(path, next ? { x: corner.x - incoming.x * 4, y: corner.y - incoming.y * 4 } : corner);
    if (next) turn(path, incoming, direction(corner, next));
  }
  return path.map(point => ({ x: point.x / 16 - 1, y: point.y / 16 - 2 }));
}
