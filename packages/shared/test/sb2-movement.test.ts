import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createMatch } from "../src/arena";
import { TILE } from "../src/constants";
import { advanceSb2Stage7Movement, createSb2Stage7Controller } from "../src/sb2-stage7-controller";
import { SB2_STAGE_CAPTURES } from "../src/sb2-stage-captures";
import { Tile, type Facing } from "../src/state";
import type { Sb2PauseInput } from "../src/sb2-pause-panel";
import { step } from "../src/step";

interface Sample { sample: number; players: { raw_hex: string }[] }
interface Reference { label: string; frame: number; rea_sample: number }
const read = (name: string) => JSON.parse(readFileSync(new URL(`../../../docs/sb2/${name}`, import.meta.url), "utf8"));
const report = read("SB2-MANUAL-MOTION-FINAL-COMPARISON.json");
const bundle = read("SB2-REA-MANUAL-MOTION.json");
const record = bundle.records
  .find((value: { evidence_id: string }) => value.evidence_id === report.evidence_id);
if (!record || record.normalized_result.messages_truncated) throw new Error("Movimento REA incompleto");
const samples: Sample[] = record.normalized_result.messages
  .filter((value: { type: string; payload?: { kind: string } }) => value.type === "send" && value.payload?.kind === "native-players")
  .map((value: { payload: Sample }) => value.payload);
function native(reference: Reference) {
  const sample = samples.find(value => value.sample === reference.rea_sample);
  if (!sample) throw new Error("Amostra nativa ausente");
  const raw = Buffer.from(sample.players[0]!.raw_hex, "hex");
  return { x: raw.readUInt16LE(0x10) + raw.readUInt16LE(0x12) / 65536,
    y: raw.readUInt16LE(0x18) + raw.readUInt16LE(0x1a) / 65536,
    speed: raw.readUInt16LE(0xa0) + raw.readUInt16LE(0xa2) / 65536 };
}
const probes: [string, Facing][] = [
  ["down", "down"], ["up", "up"], ["wall", "right"],
  ...[1, 2, 3, 4].map(value => [`lane-${value}`, "down"] as [string, Facing]),
  ...(["LEFT", "UP", "RIGHT", "DOWN"] as const).map(value => [`border-${value}`, value.toLowerCase()] as [string, Facing]),
  ...[6, 7, 8, 9, 10].map(value => [`corner-${value}`, "down"] as [string, Facing]),
  ["fast-lane", "down"], ["fast-wall", "left"], ["slow-corner", "up"],
  ["horizontal-right", "right"], ["horizontal-left-high", "left"],
  ["horizontal-left-low", "left"], ["horizontal-corner", "right"],
];

function createProbeMatch(mode: "adapter" | "step") {
  const match = createMatch({ seed: 1, playerIds: ["p1", "p2"], blockDensity: 0,
    ...(mode === "step" && { stage: "sb2-07" as const, maniacItems: {} }) });
  if (mode === "step") return match;
  // Grade do ensaio: não define itens, pisos ou inicialização de partida SB2.
  match.grid.tiles = SB2_STAGE_CAPTURES[6].current.flatMap(row => row.map(code => {
    const base = code & 0x3f;
    if (base === 0 || base === 15) return Tile.Empty;
    if (base === 2) return Tile.Block;
    if (base === 5 || base === 6) return Tile.Wall;
    throw new Error(`Código sem semântica de colisão no ensaio: ${code}`);
  }));
  return match;
}

describe.each(["adapter", "step"] as const)("movimento SB2 aplicado ao MatchState a 60 Hz por %s", runner => {
  it.each(probes)("reproduz todas as posições nativas do ensaio %s", (prefix, dir) => {
    const references: Reference[] = report.samples.filter((value: Reference) => value.label.startsWith(`${prefix}-`));
    expect(references.length).toBeGreaterThan(5);
    const first = references[0]!, initial = native(first);
    const match = createProbeMatch(runner);
    const p = match.players[0]!;
    p.px = (initial.x - 8) * TILE / 16;
    p.py = (initial.y - 24) * TILE / 16;
    const state = createSb2Stage7Controller();
    state.players.p1 = { cell: { x: Math.floor(p.px / TILE), y: Math.floor((p.py - TILE / 16) / TILE) },
      nativeSpeed: initial.speed, pendingBomb: false, pause: null };
    if (runner === "step") match.stageState!.sb2!.stage7 = state;
    const byFrame = new Map(references.map(value => [value.frame - first.frame, value]));
    const seen = new Set<number>();
    const last = references.at(-1)!.frame - first.frame;
    while (state.nativeFrame < last) {
      if (runner === "step") step(match, { p1: { dir, bomb: false } });
      else advanceSb2Stage7Movement(state, match, { p1: { dir, bomb: false } }, () => { throw new Error("Sorteio inesperado"); });
      const reference = byFrame.get(state.nativeFrame);
      if (!reference) continue;
      const expected = native(reference);
      expect({ x: p.px / (TILE / 16) + 8, y: p.py / (TILE / 16) + 24 }, reference.label)
        .toEqual({ x: expected.x, y: expected.y });
      seen.add(state.nativeFrame);
    }
    expect(seen.size).toBe(references.length);
  });

  it.each<[string, Sb2PauseInput]>([
    ["opposite", { dir: "down", bomb: false }], ["neutral", { dir: null, bomb: false }],
    ["same", { dir: "up", bomb: false }], ["bomb", { dir: null, bomb: true }],
  ])("compõe a pausa %s com a colisão real da grade capturada", (mode, input) => {
    const report = read("SB2-PAUSE-PANEL-COMPARISON.json");
    const proof = bundle.records.find((value: { evidence_id: string }) => value.evidence_id === report.evidence_id);
    if (!proof || proof.normalized_result.messages_truncated) throw new Error("Pausa REA incompleta");
    const observations: (Reference & { players: { x: number; y: number }[] })[] = report.samples;
    const first = observations.find(value => value.label === "before-entry")!;
    const references = observations.filter(value => value.label === "entered" ||
      value.label.startsWith(`${mode}-`) && /^\d+$/.test(value.label.slice(mode.length + 1)) ||
      mode === "same" && value.label === "same-stay");
    const byFrame = new Map(references.map(value => [value.frame - first.frame, value]));
    const match = createProbeMatch(runner), p = match.players[0]!;
    p.px = (first.players[0]!.x - 8) * TILE / 16;
    p.py = (first.players[0]!.y - 24) * TILE / 16;
    const state = createSb2Stage7Controller(), seen = new Set<number>();
    if (runner === "step") match.stageState!.sb2!.stage7 = state;
    while (state.nativeFrame < Math.max(...byFrame.keys())) {
      const inputs = { p1: state.nativeFrame === 0 ? { dir: "up" as const, bomb: false } : input };
      if (runner === "step") step(match, inputs);
      else advanceSb2Stage7Movement(state, match, inputs, () => { throw new Error("Sorteio inesperado"); });
      const reference = byFrame.get(state.nativeFrame);
      if (!reference) continue;
      expect({ x: p.px / (TILE / 16) + 8, y: p.py / (TILE / 16) + 24 }, reference.label)
        .toEqual({ x: reference.players[0]!.x, y: reference.players[0]!.y });
      seen.add(state.nativeFrame);
    }
    expect(seen.size).toBe(references.length);
  });
});
