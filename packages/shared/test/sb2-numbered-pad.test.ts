import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sb2NativeNumberedPadSpeed, sb2NextPadNumber, type Sb2PadNumber } from "../src/sb2-numbered-pad";
import { createMatch } from "../src/arena";
import { step } from "../src/step";
import { TILE } from "../src/constants";
import { sb2NativeFramesAfterTicks } from "../src/sb2-native-clock";

interface Sample {
  sample: number;
  players: { seat: number; raw_hex: string }[];
  pad_glyphs: { offset: number; value: number }[];
  pad_random_word_0400?: number;
}
interface Observation {
  label: string;
  frame: number;
  rea_sample: number;
  players: { x: number; y: number }[];
}

const bundle = JSON.parse(readFileSync(new URL("../../../docs/sb2/SB2-REA-PAD-CHOICE.json", import.meta.url), "utf8"));
const comparison = JSON.parse(readFileSync(new URL("../../../docs/sb2/SB2-PAD-GLYPHS-COMPARISON.json", import.meta.url), "utf8"));
const evidence = bundle.records.find((record: { evidence_id: string }) => record.evidence_id === comparison.evidence_id);
if (!evidence || evidence.normalized_result.messages_truncated) throw new Error("Evidência REA incompleta");
const native: Sample[] = evidence.normalized_result.messages
  .filter((message: { script_id: string; type: string; payload?: { kind: string } }) =>
    message.script_id === comparison.script_id && message.type === "send" && message.payload?.kind === "arena-effects")
  .map((message: { payload: Sample }) => message.payload);
const observations = comparison.samples as Observation[];

function observed(label: string) {
  const observation = observations.find(value => value.label === label);
  const sample = native.find(value => value.sample === observation?.rea_sample);
  if (!observation || !sample) throw new Error(`Amostra ausente: ${label}`);
  return { observation, sample };
}

describe("velocidades das placas SB2 conferidas por REA e Snes9x", () => {
  it("executa as 64 escolhas da placa esquerda pelo step principal", () => {
    const report = JSON.parse(readFileSync(new URL("../../../docs/sb2/SB2-PAD-CHOICE-COMPARISON.json", import.meta.url), "utf8"));
    const record = bundle.records.find((value: { evidence_id: string }) => value.evidence_id === report.evidence_id);
    const samples: Sample[] = record.normalized_result.messages
      .filter((message: { script_id: string; payload?: { kind: string } }) => message.script_id === report.script_id && message.payload?.kind === "arena-effects")
      .map((message: { payload: Sample }) => message.payload);
    const glyphs = { 1: 0x1c28, 2: 0x1c2a, 3: 0x1c2c, 4: 0x1c2e, 5: 0x1c48 };
    for (let delay = 0; delay < 64; delay++) {
      const before = report.samples.find((row: Observation) => row.label === `choice-${delay}-before`) as Observation;
      const after = report.samples.find((row: Observation) => row.label === `choice-${delay}-after`) as Observation;
      const source = samples.find(row => row.sample === before.rea_sample)!;
      const result = samples.find(row => row.sample === after.rea_sample)!;
      const s = createMatch({ stage: "sb2-07", seed: 1, playerIds: ["p1", "p2"], maniacItems: {}, suddenDeath: false });
      const p = s.players[0]!;
      p.px = (before.players[0]!.x - 8) * TILE / 16;
      p.py = (before.players[0]!.y - 24) * TILE / 16;
      if (source.pad_random_word_0400 === undefined) throw new Error("Palavra nativa ausente");
      s.stageState!.sb2!.randomWord = source.pad_random_word_0400;
      const prior = sb2NativeFramesAfterTicks(s.tick);
      do { step(s, { p1: { dir: "right", bomb: false } }); } while (sb2NativeFramesAfterTicks(s.tick) === prior);
      expect({ x: p.px / (TILE / 16) + 8, y: p.py / (TILE / 16) + 24 }, after.label)
        .toEqual({ x: after.players[0]!.x, y: after.players[0]!.y });
      expect(glyphs[s.stageState!.sb2!.stage7!.numbers.left], after.label).toBe(result.pad_glyphs[0]!.value);
      expect(s.stageState!.sb2!.stage7!.numbers.right).toBe(3);
    }
  });

  it("reproduz 64 escolhas observadas e cobre os oito índices da tabela nativa", () => {
    const report = JSON.parse(readFileSync(new URL("../../../docs/sb2/SB2-PAD-CHOICE-COMPARISON.json", import.meta.url), "utf8"));
    const record = bundle.records.find((value: { evidence_id: string }) => value.evidence_id === report.evidence_id);
    if (!record || record.normalized_result.messages_truncated) throw new Error("Escolhas REA incompletas");
    const samples: Sample[] = record.normalized_result.messages
      .filter((message: { script_id: string; type: string; payload?: { kind: string } }) =>
        message.script_id === report.script_id && message.type === "send" && message.payload?.kind === "arena-effects")
      .map((message: { payload: Sample }) => message.payload);
    expect(samples).toHaveLength(128);
    const glyphs: Record<Sb2PadNumber, number> = { 1: 0x1c28, 2: 0x1c2a, 3: 0x1c2c, 4: 0x1c2e, 5: 0x1c48 };
    const indices = new Set<number>();
    for (let delay = 0; delay < 64; delay++) {
      const before = report.samples.find((value: Observation) => value.label === `choice-${delay}-before`) as Observation;
      const after = report.samples.find((value: Observation) => value.label === `choice-${delay}-after`) as Observation;
      const source = samples.find(value => value.sample === before.rea_sample)!;
      const result = samples.find(value => value.sample === after.rea_sample)!;
      const randomWord = source.pad_random_word_0400;
      if (randomWord === undefined) throw new Error("Palavra nativa ausente");
      indices.add((randomWord & 14) >>> 1);
      expect(after.frame - before.frame).toBe(1);
      const number = sb2NextPadNumber(randomWord);
      expect(result.pad_glyphs.map(value => value.value)).toEqual([glyphs[number], glyphs[number]]);
    }
    expect([...indices].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it.each<[Sb2PadNumber, number, number]>([
    [1, 1, 0x1c28],
    [2, 4, 0x1c2a],
    [3, 8, 0x1c2c],
    [4, 7, 0x1c2e],
    [5, 0, 0x1c48],
  ])("aplica a velocidade da placa %i antes da troca de glifo", (number, delay, glyph) => {
    const before = observed(`glyph-${delay}-before`);
    const entered = observed(`glyph-${delay}-entered`);
    const idle = observed(`glyph-${delay}-idle`);
    const after = observed(`glyph-${delay}-after-four`);
    expect(before.sample.pad_glyphs.map(value => value.value)).toEqual([glyph, glyph]);
    const raw = Buffer.from(entered.sample.players[0]!.raw_hex, "hex");
    const nativeSpeed = raw.readUInt16LE(0xa0) + raw.readUInt16LE(0xa2) / 65536;
    const speed = sb2NativeNumberedPadSpeed(number);
    expect(speed).toBe(nativeSpeed);
    expect(entered.observation.frame - before.observation.frame).toBe(1);
    expect(before.observation.players[0]!.x - entered.observation.players[0]!.x).toBe(speed);
    expect(idle.observation.frame - entered.observation.frame).toBe(120);
    expect(idle.observation.players[0]).toEqual(entered.observation.players[0]);
    expect(idle.sample.pad_glyphs).toEqual(entered.sample.pad_glyphs);
    expect(after.observation.frame - idle.observation.frame).toBe(4);
    expect(idle.observation.players[0]!.x - after.observation.players[0]!.x).toBe(4 * speed);
  });
});
