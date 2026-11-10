import { Floor, Tile, type MatchState, type PlayerInput } from "./state";
import type { StageLayout } from "./stage";
import { SB2_STAGE_CAPTURES } from "./sb2-stage-captures";
import { sb2NativeFramesAfterTicks, sb2NativeFramesOnTick } from "./sb2-native-clock";

/** As 12 arenas do Battle Mode de Super Bomberman 2, na ordem da seleção do jogo. */
export const SB2_STAGES = [
  "sb2-01", "sb2-02", "sb2-03", "sb2-04", "sb2-05", "sb2-06",
  "sb2-07", "sb2-08", "sb2-09", "sb2-10", "sb2-11", "sb2-12",
] as const;
export type Sb2StageId = (typeof SB2_STAGES)[number];
export function isSb2Stage(stage: string | undefined): stage is Sb2StageId {
  return stage === "sb2-01" || stage === "sb2-02" || stage === "sb2-03" || stage === "sb2-04" || stage === "sb2-05" || stage === "sb2-06" || stage === "sb2-07" || stage === "sb2-08" || stage === "sb2-09" || stage === "sb2-10" || stage === "sb2-11" || stage === "sb2-12";
}

export function sb2ArenaNumber(stage: Sb2StageId): 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 {
  return stage === "sb2-12" ? 12 : stage === "sb2-11" ? 11 : stage === "sb2-10" ? 10 : stage === "sb2-09" ? 9 : stage === "sb2-08" ? 8 : stage === "sb2-07" ? 7 : stage === "sb2-06" ? 6 : stage === "sb2-05" ? 5 : stage === "sb2-04" ? 4 : stage === "sb2-03" ? 3 : stage === "sb2-02" ? 2 : 1;
}

export const SB2_NORMAL_FUSE_FRAMES = 144;
export const SB2_FLAME_FRAMES = 26;
export const SB2_BLOCK_BURN_FRAMES = 35;

export function buildSb2Layout(width: number, height: number, stage: Sb2StageId = "sb2-01"): StageLayout {
  if (width !== 15 || height !== 13) throw new Error("SB2 requires the captured 15x13 arena");
  const tiles = SB2_STAGE_CAPTURES[sb2ArenaNumber(stage) - 1]!.current.flatMap(row => row.map(code => {
    switch (code & 0x3f) {
      case 0: case 4: case 7: case 8: case 9: case 11: case 12: case 14: case 15: case 16: return Tile.Empty;
      case 18: case 19: case 23: case 24: case 25: case 26: case 27: case 28: case 29: case 30: return Tile.Empty;
      case 20: return Tile.Empty;
      case 60: case 61: case 62: case 63: return Tile.Empty;
      case 2: return Tile.Block;
      case 5: case 6: return Tile.Wall;
      default: throw new Error(`Unmapped SB2 collision code: ${code}`);
    }
  }));
  return { tiles, floor: new Array(width * height).fill(Floor.Normal), warps: [], keepClear: new Set() };
}

export function sb2NativeCounter(s: Pick<MatchState, "tick" | "stageState">): number {
  return s.stageState?.sb2?.stoppedNativeCounter
    ?? sb2NativeFramesAfterTicks(s.tick) + (s.stageState?.sb2?.counterOffset ?? 0);
}

/** Mantém os eventos de botão do Bombtop até o próximo passo PAL. */
export function sb2TickInputs(s: MatchState, inputs: Record<string, PlayerInput>): Record<string, PlayerInput> | null {
  s.stageState ??= {};
  const runtime = s.stageState.sb2 ??= { counterOffset: 0, pendingInputs: {} };
  const merged: Record<string, PlayerInput> = {};
  for (const id of new Set([...Object.keys(runtime.pendingInputs), ...Object.keys(inputs)])) {
    const previous = runtime.pendingInputs[id];
    const current = inputs[id] ?? { dir: null, bomb: false };
    merged[id] = { ...current, bomb: current.bomb || !!previous?.bomb,
      ...(current.action || previous?.action ? { action: true } : {}),
      ...(current.special || previous?.special ? { special: true } : {}),
      ...(current.stopKick || previous?.stopKick ? { stopKick: true } : {}),
    };
  }
  if (!sb2NativeFramesOnTick(s.tick)) {
    runtime.pendingInputs = merged;
    return null;
  }
  runtime.pendingInputs = {};
  return merged;
}
