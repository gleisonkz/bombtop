import { SB4_STAGES, SELECTABLE_STAGES, STAGES, type StageId } from "./stage";

export interface StageRotationEntry {
  stage: StageId;
}

export const MAX_STAGE_ROTATION = 12;

export const DEFAULT_STAGE_ROTATION: readonly Readonly<StageRotationEntry>[] = Object.freeze(
  STAGES.map((stage) => Object.freeze({ stage })),
);

/** How many stages a new room's rotation draws. */
export const DEFAULT_ROTATION_LENGTH = 5;

/** A new room's rotation: DEFAULT_ROTATION_LENGTH different SB4 stages in a random order. */
export function randomStageRotation(random: () => number = Math.random): StageRotationEntry[] {
  const pool: StageId[] = [...SB4_STAGES];
  const rotation: StageRotationEntry[] = [];
  while (rotation.length < DEFAULT_ROTATION_LENGTH && pool.length > 0) {
    const [stage] = pool.splice(Math.floor(random() * pool.length), 1);
    rotation.push({ stage: stage! });
  }
  return rotation;
}

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
