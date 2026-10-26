import { Floor } from "./state";
import { TICK_RATE } from "./constants";
import { nextRandom } from "./rng";
import type { MatchState } from "./state";

export type StageId = "classic" | "conveyor" | "warp" | "sb4-01" | "sb4-02";

export const STAGES: readonly StageId[] = ["classic", "conveyor", "warp"];
export const SB4_STAGES = ["sb4-01", "sb4-02"] as const;
export const SELECTABLE_STAGES: readonly StageId[] = [...STAGES, ...SB4_STAGES];

export const SB4_MAP_PRESETS = {
  "sb4-01": { number: 1, softBlocks: 80, timeFlow: false },
  "sb4-02": { number: 2, softBlocks: 80, timeFlow: true },
} as const;

export function sb4Map(id: StageId) {
  return id === "sb4-01" || id === "sb4-02" ? SB4_MAP_PRESETS[id] : null;
}

export const SB4_TIME_FLOW_TICKS = 14 * TICK_RATE;

export function stageTempoRate(s: Pick<MatchState, "tempo">): number {
  return s.tempo ?? 1;
}

export function stageFuseTicks(s: Pick<MatchState, "tempo" | "tick">): number {
  const tempo = stageTempoRate(s);
  return tempo === 0.5 ? Number(s.tick % 2 === 0) : tempo;
}

export function advanceStageTempo(s: MatchState): void {
  if (s.stage !== "sb4-02" || s.tick % SB4_TIME_FLOW_TICKS !== 0) return;
  const next = [0.5, 1, 2] as const;
  const possibilities = next.filter(tempo => tempo !== s.tempo);
  s.tempo = possibilities[Math.floor(nextRandom(s) * possibilities.length)]!;
}

export interface StageLayout {
  floor: Floor[];
  warps: { x: number; y: number }[];
  /** Tile indices that must never start with a block. */
  keepClear: Set<number>;
}

/** Floor gimmicks for a stage on a width x height arena. */
export function buildStage(id: StageId, width: number, height: number): StageLayout {
  const floor: Floor[] = new Array(width * height).fill(Floor.Normal);
  const keepClear = new Set<number>();
  const warps: { x: number; y: number }[] = [];
  const mark = (x: number, y: number, f: Floor) => {
    floor[y * width + x] = f;
    keepClear.add(y * width + x);
  };

  if (id === "conveyor") {
    for (let x = 1; x < width - 1; x++) {
      mark(x, 3, Floor.ConveyorRight);
      mark(x, height - 4, Floor.ConveyorLeft);
    }
  }

  if (id === "warp") {
    // Diagonal pairs: top-left <-> bottom-right, top-right <-> bottom-left.
    warps.push(
      { x: 3, y: 1 },
      { x: width - 4, y: height - 2 },
      { x: width - 4, y: 1 },
      { x: 3, y: height - 2 },
    );
    for (const w of warps) mark(w.x, w.y, Floor.Warp);
  }

  return { floor, warps, keepClear };
}
