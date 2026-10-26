import { SB4_STAGE_DEFINITIONS, SB4_STAGES, type StageId } from "@bombtop/shared";

export const STAGE_NAMES = Object.fromEntries([
  ["classic", "Clássica"],
  ["conveyor", "Esteiras"],
  ["warp", "Teleportes"],
  ...SB4_STAGES.map((id, index) => {
    const definition = SB4_STAGE_DEFINITIONS[index]!;
    return [id, `SB4 ${String(definition.number).padStart(2, "0")} · ${definition.name}`];
  }),
  ["sb4-01", "SB4 01 · Usual"],
  ["sb4-02", "SB4 02 · Fast ’n Slow"],
]) as Record<StageId, string>;
