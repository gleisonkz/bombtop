import { SELECTABLE_STAGES, STAGES, type StageId } from "./stage";

export interface StageRotationEntry {
  stage: StageId;
}

export const MAX_STAGE_ROTATION = 12;

export const DEFAULT_STAGE_ROTATION: readonly Readonly<StageRotationEntry>[] = Object.freeze(
  STAGES.map((stage) => Object.freeze({ stage })),
);

const stageIds = new Set<unknown>(SELECTABLE_STAGES);

export function validateStageRotation(raw: unknown): StageRotationEntry[] | null {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_STAGE_ROTATION) return null;
  const rotation: StageRotationEntry[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") return null;
    const { stage } = entry as Record<string, unknown>;
    if (!stageIds.has(stage)) return null;
    rotation.push({ stage: stage as StageId });
  }
  return rotation;
}
