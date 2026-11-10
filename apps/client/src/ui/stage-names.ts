import { SB4_STAGE_DEFINITIONS, SB4_STAGES, type StageId } from "@bombtop/shared";

export const STAGE_NAMES = Object.fromEntries([
  ["classic", "Clássica"],
  ["conveyor", "Esteiras"],
  ["warp", "Teleportes"],
  ...SB4_STAGES.map((id, index) => {
    const definition = SB4_STAGE_DEFINITIONS[index]!;
    return [id, `SB4 ${String(definition.number).padStart(2, "0")} · ${definition.name}`];
  }),
  ["sb2-01", "SB2 01 · Clássica"],
  ["sb2-02", "SB2 02 · Gelo"],
  ["sb2-03", "SB2 03 · Túneis"],
  ["sb2-04", "SB2 04 · Canaleta"],
  ["sb2-05", "SB2 05 · Placas"],
  ["sb2-06", "SB2 06 · Teleportes"],
  ["sb2-07", "SB2 07 · Painéis"],
  ["sb2-08", "SB2 08 · Esteira"],
  ["sb2-09", "SB2 09 · Setas"],
  ["sb2-10", "SB2 10 · Pulo"],
  ["sb2-11", "SB2 11 · Lançadores"],
  ["sb2-12", "SB2 12 · Molas"],
  ["sb4-01", "SB4 01 · Usual"],
  ["sb4-02", "SB4 02 · Fast ’n Slow"],
]) as Record<StageId, string>;
