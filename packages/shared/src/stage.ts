import { Floor } from "./state";
import { TICK_RATE } from "./constants";
import { nextRandom } from "./rng";
import type { MatchState, Tile } from "./state";
import { SB4_STAGE_DEFINITIONS } from "./sb4-stage-definitions";
import { buildSb4Layout, SB4_SOFT_BLOCK_COUNTS } from "./sb4-layouts";

export const SB4_STAGES = [
  "sb4-01", "sb4-02", "sb4-03", "sb4-04", "sb4-05", "sb4-06",
  "sb4-07", "sb4-08", "sb4-09", "sb4-10", "sb4-11", "sb4-12",
] as const;
export type Sb4StageId = (typeof SB4_STAGES)[number];
export type StageId = "classic" | "conveyor" | "warp" | Sb4StageId;

export const STAGES: readonly StageId[] = ["classic", "conveyor", "warp"];
export const SELECTABLE_STAGES: readonly StageId[] = [...STAGES, ...SB4_STAGES];

export const SB4_MAP_PRESETS = Object.fromEntries(SB4_STAGES.map((id, index) => [id, {
  number: SB4_STAGE_DEFINITIONS[index]!.number,
  softBlocks: SB4_SOFT_BLOCK_COUNTS[index]!,
  timeFlow: index === 1,
}])) as Record<Sb4StageId, { readonly number: (typeof SB4_STAGE_DEFINITIONS)[number]["number"]; readonly softBlocks: number; readonly timeFlow: boolean }>;

export function sb4Map(id: number | string) {
  const index = SB4_STAGE_DEFINITIONS.findIndex(definition => definition.number === id || definition.name === id);
  const key = index < 0 ? SB4_STAGES.find(stage => stage === id) : SB4_STAGES[index];
  return key === undefined ? null : SB4_MAP_PRESETS[key];
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
  /** Explicit row-major initial collision grid for the 15x13 Group 1 captures. */
  tiles?: Tile[];
  rollingBalls?: { x: number; y: number }[];
}

/** Floor gimmicks for a stage on a width x height arena. */
export function buildStage(id: StageId, width: number, height: number): StageLayout {
  const original = sb4Map(id);
  if (original) return buildSb4Layout(original.number, width, height);
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
