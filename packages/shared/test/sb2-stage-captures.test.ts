import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SB2_CAPTURE_SIZE, SB2_STAGE_CAPTURES } from "../src/sb2-stage-captures";

interface GridMessage {
  type: string;
  payload?: { kind: string; selection_byte_1ccd: number; grids: { current: number[][]; background: number[][] } };
}

function observedStages(file: string, evidenceId: string) {
  const bundle = JSON.parse(readFileSync(new URL(`../../../docs/sb2/${file}`, import.meta.url), "utf8"));
  const record = bundle.records.find((entry: { evidence_id: string }) => entry.evidence_id === evidenceId);
  if (!record || record.normalized_result.messages_truncated) throw new Error("Evidência REA ausente ou truncada");
  return (record.normalized_result.messages as GridMessage[])
    .flatMap(message => message.type === "send" && message.payload?.kind === "wram-grids" ? [message.payload] : []);
}

const observed = [
  ...observedStages("SB2-REA-RUNTIME-GRIDS.json", "ev_faa7e410ff15ad5b9d160880de72082c74647af0d738a9065b32a6531e685976"),
  ...observedStages("SB2-REA-HIDDEN-GRIDS.json", "ev_9f39f0de633679a14f5f1e839c7591cfb8d2237aec3db6b27e7f0b9670606ba7"),
];

describe("capturas de SB2 conferidas com REA", () => {
  it("cobre exatamente as 12 seleções originais", () => {
    expect(SB2_STAGE_CAPTURES.map(stage => stage.number)).toEqual(Array.from({ length: 12 }, (_, index) => index + 1));
    expect(observed.map(stage => stage.selection_byte_1ccd)).toEqual(Array.from({ length: 12 }, (_, index) => index));
  });

  for (const stage of SB2_STAGE_CAPTURES) {
    it(`preserva todas as células das duas grades da arena ${stage.number}`, () => {
      const observation = observed.find(value => value.selection_byte_1ccd === stage.number - 1);
      expect(observation).toBeDefined();
      for (const grid of ["current", "background"] as const) {
        expect(stage[grid]).toHaveLength(SB2_CAPTURE_SIZE.height);
        for (const row of stage[grid]) expect(row).toHaveLength(SB2_CAPTURE_SIZE.width);
        expect(stage[grid]).toEqual(observation!.grids[grid]);
      }
    });
  }
});
