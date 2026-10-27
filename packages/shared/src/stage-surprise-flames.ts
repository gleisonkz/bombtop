import { nextSb4Random } from "./sb4-rng";
import { nextSurpriseCounter, nextSurpriseSelection } from "./sb4-surprise-selection";
import type { StageSurpriseCenter, StageSurpriseSamples } from "./stage-state";
import { Floor, getFloor, type MatchState } from "./state";

export function initializeSurpriseSelection(s: MatchState): void {
  if (s.stage !== "sb4-06") return;
  const stage = s.stageState ??= {};
  const next = nextSurpriseCounter(s.rng);
  stage.surpriseCounter = next.counter;
  s.rng = next.seed;
}

function sample(s: MatchState, mask: number): number {
  const next = nextSb4Random({ seed: s.rng, bound: 255 });
  s.rng = next.seed;
  return (next.value & mask) || 1;
}

/** C13DE4..C13E11 prepares every arm before the first floor write. */
export function beginSurpriseBurst(s: MatchState): StageSurpriseSamples | undefined {
  if (s.stage !== "sb4-06") return undefined;
  return { up: sample(s, 15), right: sample(s, 15), down: sample(s, 15), left: sample(s, 15) };
}

/** Explicit samples belong to separate flame events; null suppresses duplicate hooks. */
export function igniteSurpriseFloor(s: MatchState, x: number, y: number, supplied?: number | null): void {
  if (s.stage !== "sb4-06" || supplied === null || getFloor(s, x, y) !== Floor.Surprise) return;
  const stage = s.stageState ??= {};
  const locks = stage.floorLocks ??= {};
  const index = y * s.grid.width + x;
  const key = `surprise:hit:${index}`;
  if (supplied === undefined && locks[key] === s.tick) return;
  const floors = stage.surprise ??= {};
  const current = floors[index] ?? { kind: "normal", hits: 0 };
  if (stage.surpriseCounter === undefined) initializeSurpriseSelection(s);
  const value = supplied ?? sample(s, 15);
  const selected = nextSurpriseSelection({ counter: stage.surpriseCounter!, sample: value, seed: s.rng });
  s.rng = selected.seed;
  stage.surpriseCounter = selected.counter;
  floors[index] = { kind: selected.kind ?? current.kind, hits: current.hits + 1 };
  locks[key] = s.tick;
}

function pulse(s: MatchState, center: StageSurpriseCenter): void {
  igniteSurpriseFloor(s, center.x, center.y, sample(s, 3));
  center.remaining--;
  center.nextAt += 2;
}

export function startSurpriseCenter(s: MatchState, x: number, y: number): void {
  if (s.stage !== "sb4-06" || getFloor(s, x, y) !== Floor.Surprise) return;
  const stage = s.stageState ??= {};
  const centers = stage.surpriseCenters ??= [];
  const center = { x, y, nextAt: s.tick, remaining: 13 };
  centers.push(center);
  pulse(s, center);
}

/** C151AC: center animation supplies a new two-bit sample every other update. */
export function updateSurpriseCenters(s: MatchState): void {
  if (s.stage !== "sb4-06" || !s.stageState?.surpriseCenters) return;
  for (const center of s.stageState.surpriseCenters) {
    if (center.remaining > 0 && s.tick >= center.nextAt) pulse(s, center);
  }
  s.stageState.surpriseCenters = s.stageState.surpriseCenters.filter(center => center.remaining > 0);
}
