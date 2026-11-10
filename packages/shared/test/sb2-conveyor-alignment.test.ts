import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sb2NativeConveyorStep, type Sb2NativeConveyorPosition } from "../src/sb2-conveyor";
import { createMatch } from "../src/arena";
import { step } from "../src/step";
import { TILE } from "../src/constants";
import { sb2NativeFramesAfterTicks } from "../src/sb2-native-clock";
import { createSb2Stage8Controller } from "../src/sb2-stage8-controller";

interface NativeSample { sample: number; players: { raw_hex: string }[] }
interface Reference { label: string; frame: number; rea_sample: number }
const read = (name: string) => JSON.parse(readFileSync(new URL(`../../../docs/sb2/${name}`, import.meta.url), "utf8"));
const report = read("SB2-CONVEYOR-ALIGNMENT-COMPARISON.json");
const evidence = read("SB2-REA-CONVEYOR-ALIGNMENT.json").records
  .find((record: { evidence_id: string }) => record.evidence_id === report.evidence_id);
if (!evidence || evidence.normalized_result.messages_truncated) throw new Error("Evidência REA incompleta");
const samples: NativeSample[] = evidence.normalized_result.messages
  .filter((message: { type: string; payload?: { kind: string } }) => message.type === "send" && message.payload?.kind === "native-players")
  .map((message: { payload: NativeSample }) => message.payload);
const references = report.samples as Reference[];

function position(reference: Reference): Sb2NativeConveyorPosition {
  const sample = samples.find(value => value.sample === reference.rea_sample);
  if (!sample) throw new Error("Amostra REA ausente");
  const raw = Buffer.from(sample.players[0]!.raw_hex, "hex");
  return { x: raw.readUInt16LE(0x10) + raw.readUInt16LE(0x12) / 65536,
    y: raw.readUInt16LE(0x18) + raw.readUInt16LE(0x1a) / 65536 };
}

describe.each(["model", "step"] as const)("alinhamento da correia SB2 sem entrada manual por %s", runner => {
  for (const prefix of ["fast-cw", "fast-ccw", "normal-cw", "normal-ccw", "fine-normal-cw", "fine-normal-ccw"]) {
    it(`reproduz continuamente todas as posições nativas de ${prefix}`, () => {
      const observations = references.filter(value => value.label.startsWith(`${prefix}-`));
      expect(observations.length).toBeGreaterThan(20);
      const control = { fast: prefix.startsWith("fast"), reversed: prefix.endsWith("ccw") };
      let predicted = position(observations[0]!);
      const match = createMatch({ stage: "sb2-08", seed: 1, playerIds: ["p1", "p2"], maniacItems: {}, suddenDeath: false });
      const state = match.stageState!.sb2!.conveyor = createSb2Stage8Controller();
      state.control = control;
      match.players[0]!.px = (predicted.x - 8) * TILE / 16;
      match.players[0]!.py = (predicted.y - 24) * TILE / 16;
      for (let index = 1; index < observations.length; index++) {
        const previous = observations[index - 1]!, current = observations[index]!;
        for (let frame = previous.frame; frame < current.frame; frame++) {
          if (runner === "model") predicted = sb2NativeConveyorStep(predicted, control);
          else {
            const prior = sb2NativeFramesAfterTicks(match.tick);
            do { step(match); } while (sb2NativeFramesAfterTicks(match.tick) === prior);
            predicted = { x: match.players[0]!.px / (TILE / 16) + 8, y: match.players[0]!.py / (TILE / 16) + 24 };
          }
        }
        expect(predicted, current.label).toEqual(position(current));
      }
    });
  }
});
