import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createMatch } from "../src/arena";
import { step } from "../src/step";
import { TILE } from "../src/constants";
import { sb2NativeFramesAfterTicks } from "../src/sb2-native-clock";
import { SELECTABLE_STAGES } from "../src/stage";
import { playerTile, Tile, type MatchState, type PlayerInput } from "../src/state";

interface NativeSample {
  sample: number;
  grids: { current: number[][] };
  candidate_regions?: { offset: number; raw_hex: string }[];
}
interface Observation { label: string; frame: number; rea_sample: number; players: { x: number; y: number; state_word: number }[] }
const read = (name: string) => JSON.parse(readFileSync(new URL(`../../../docs/sb2/${name}`, import.meta.url), "utf8"));
const bundle = read("SB2-REA-BOMB-CORE.json");
function load(name: string, source = bundle) {
  const report = read(name);
  const record = source.records.find((value: { evidence_id: string }) => value.evidence_id === report.evidence_id);
  if (!record || record.normalized_result.messages_truncated) throw new Error("Evidência de bombas incompleta");
  const samples: NativeSample[] = record.normalized_result.messages
    .filter((value: { script_id: string; type: string; payload?: { kind: string } }) =>
      value.script_id === report.script_id && value.type === "send" && value.payload?.kind === "arena-effects")
    .map((value: { payload: NativeSample }) => value.payload);
  const observations: Observation[] = report.samples;
  return { observations, get(label: string) {
    const observation = observations.find(value => value.label === label);
    const sample = samples.find(value => value.sample === observation?.rea_sample);
    if (!sample || !observation) throw new Error(`Amostra ausente: ${label}`);
    return { observation, sample };
  } };
}
const timing = load("SB2-BOMB-TIMING-COMPARISON.json");
const phase = load("SB2-BOMB-PHASE-COMPARISON.json");
const capacity = load("SB2-ITEM-CAPACITY-COMPARISON.json", read("SB2-REA-ITEMS.json"));
const chain = load("SB2-CHAIN-COMPARISON.json", read("SB2-REA-CHAIN.json"));
type Reference = ReturnType<typeof phase.get>;
function createNativeMatch(before: Reference) {
  const s = createMatch({ stage: "sb2-01", seed: 1, playerIds: ["p1", "p2"], maniacItems: {}, suddenDeath: false });
  const counter = before.sample.candidate_regions?.find(value => value.offset === 0);
  if (!counter) throw new Error("Contador nativo não observado pelo REA");
  s.stageState!.sb2!.counterOffset = Buffer.from(counter.raw_hex, "hex").readUInt16LE(0x32);
  const p = s.players[0]!, native = before.observation.players[0]!;
  p.px = (native.x - 8) * TILE / 16;
  p.py = (native.y - 24) * TILE / 16;
  return s;
}
function nativeTick(s: MatchState, input: PlayerInput) {
  const before = sb2NativeFramesAfterTicks(s.tick);
  do { step(s, { p1: input }); } while (sb2NativeFramesAfterTicks(s.tick) === before);
}
function assertReference(s: MatchState, reference: Reference) {
  const p = s.players[0]!, expected = reference.observation.players[0]!;
  expect({ x: p.px / (TILE / 16) + 8, y: p.py / (TILE / 16) + 24 }, reference.observation.label)
    .toEqual({ x: expected.x, y: expected.y });
  expect(p.alive, reference.observation.label).toBe(expected.state_word < 0x9800);
  const flames: string[] = [], bombs: string[] = [];
  const tiles = reference.sample.grids.current.flatMap((row, y) => row.map((code, x) => {
    if (code === 1) flames.push(`${x},${y}`);
    if ((code & 63) === 3) bombs.push(`${x},${y}`);
    const base = code & 63;
    if (base === 2) return Tile.Block;
    if (base === 5 || base === 6) return Tile.Wall;
    if ([0, 1, 3, 4].includes(base)) return Tile.Empty;
    throw new Error(`Código inesperado no ensaio: ${code}`);
  }));
  expect(s.grid.tiles, reference.observation.label).toEqual(tiles);
  expect(s.flames.filter(value => !value.block).map(value => `${value.x},${value.y}`).sort(), reference.observation.label).toEqual(flames.sort());
  expect(s.bombs.map(value => `${value.x},${value.y}`).sort(), reference.observation.label).toEqual(bombs.sort());
}
const neutral: PlayerInput = { dir: null, bomb: false };

describe("SB2 executado pelo step real do Bombtop", () => {
  it.each(["chain", "adjacent-0", "adjacent-1"])("reproduz o atraso e a chama sobreposta em %s", prefix => {
    const reference = chain.get(`${prefix}-before`);
    const s = createNativeMatch(reference), p = s.players[0]!;
    // Restaura somente o cenário já escavado da captura; coletas foram validadas separadamente.
    s.grid.tiles = reference.sample.grids.current.flatMap(row => row.map(code => {
      const value = code & 63;
      return value === 2 ? Tile.Block : value === 5 || value === 6 ? Tile.Wall : Tile.Empty;
    }));
    p.bombCapacity = 2;
    p.fireRange = 3;
    const separation = prefix === "chain" ? 26 : 13;
    const references = new Map(chain.observations.filter(value => value.label.startsWith(`${prefix}-`) && /^\d+$/.test(value.label.slice(prefix.length + 1)))
      .map(value => [Number(value.label.slice(prefix.length + 1)), value.label]));
    nativeTick(s, { dir: null, bomb: true });
    assertReference(s, chain.get(`${prefix}-0`));
    for (let frame = 1; frame <= (prefix === "chain" ? 185 : 180); frame++) {
      const placing = frame === separation + 1;
      const dir = frame <= separation || frame > separation + 1 && frame <= 66
        ? "up" : frame >= 67 && frame <= 79 ? "right" : null;
      nativeTick(s, { dir, bomb: placing });
      const label = references.get(frame);
      if (label) assertReference(s, chain.get(label));
    }
  });

  it.each([138, 139, 140, 141, 142, 143, 144, 145])("reproduz a capacidade nativa na tentativa ao frame %i", elapsed => {
    const s = createNativeMatch(phase.get("phase-0-before"));
    nativeTick(s, { dir: null, bomb: true });
    for (let frame = 1; frame < elapsed; frame++) {
      nativeTick(s, { dir: frame <= 13 ? "up" : frame <= 26 ? "right" : null, bomb: false });
    }
    assertReference(s, capacity.get(`capacity-${elapsed}-before`));
    nativeTick(s, { dir: null, bomb: true });
    assertReference(s, capacity.get(`capacity-${elapsed}-after`));
    expect(s.bombs.some(value => value.x === 2 && value.y === 1)).toBe(elapsed >= 143);
  });

  it.each([["sb2-01", 0], ["sb2-02", 1], ["sb2-03", 2], ["sb2-04", 3], ["sb2-05", 4], ["sb2-06", 5], ["sb2-07", 6], ["sb2-08", 7], ["sb2-09", 8], ["sb2-10", 9], ["sb2-11", 10], ["sb2-12", 11]] as const)("cria as quatro posições iniciais de %s observadas pelo REA", (stage, selection) => {
    const original = bundle.records.find((value: { evidence_id: string }) => value.evidence_id === "ev_67648619c804019bae10fe8d6ecec3e581c261249431469bc4b603fba8d70329");
    if (!original || original.normalized_result.messages_truncated) throw new Error("Posições REA incompletas");
    const first = original.normalized_result.messages.find((value: { payload?: { kind: string; selection_byte_1ccd: number } }) =>
      value.payload?.kind === "native-players" && value.payload.selection_byte_1ccd === selection).payload;
    const s = createMatch({ stage, seed: 1, playerIds: ["1", "2", "3", "4"], maniacItems: {}, suddenDeath: false });
    expect(s.players.map(p => ({ x: p.px / (TILE / 16) + 8, y: p.py / (TILE / 16) + 24 })))
      .toEqual(first.players.map((p: { x: number; y: number }) => ({ x: p.x, y: p.y })));
    expect(s.players.every(p => p.sb2Coordinates === true)).toBe(true);
  });

  it("reproduz os 211 frames da bomba isolada, incluindo movimento, fogo e bloco", () => {
    const s = createNativeMatch(phase.get("phase-0-before"));
    nativeTick(s, { dir: null, bomb: true });
    assertReference(s, timing.get("fuse-0"));
    for (let frame = 1; frame <= 210; frame++) {
      nativeTick(s, { dir: frame <= 13 ? "up" : frame <= 26 ? "right" : null, bomb: false });
      assertReference(s, timing.get(`fuse-${frame}`));
    }
  });

  it.each([0, 1, 2, 3])("preserva a fase de colocação %i no fuse, na chama e no bloco", shift => {
    const prefix = `phase-${shift}`, s = createNativeMatch(phase.get(`${prefix}-before`));
    const references = new Map(phase.observations.filter(value => value.label.startsWith(`${prefix}-`) && /^\d+$/.test(value.label.slice(prefix.length + 1)))
      .map(value => [Number(value.label.slice(prefix.length + 1)), value.label]));
    nativeTick(s, { dir: null, bomb: true });
    assertReference(s, phase.get(`${prefix}-0`));
    for (let frame = 1; frame <= 181; frame++) {
      nativeTick(s, { dir: frame <= 13 ? "up" : frame <= 26 ? "right" : null, bomb: false });
      const label = references.get(frame);
      if (label) assertReference(s, phase.get(label));
    }
  });

  it.each(["stay", "enter-fire", "leave-fire"])("preserva a ordem nativa de dano em %s", mode => {
    const s = createNativeMatch(phase.get("phase-0-before"));
    nativeTick(s, { dir: null, bomb: true });
    for (let frame = 1; frame <= 146; frame++) {
      let dir: PlayerInput["dir"] = null;
      if (mode !== "stay" && frame <= 13) dir = "up";
      else if (mode !== "stay" && frame <= (mode === "enter-fire" ? 26 : 19)) dir = "right";
      else if (mode === "enter-fire" && frame <= 32) dir = "left";
      if (frame === 145) dir = mode === "enter-fire" ? "left" : mode === "leave-fire" ? "right" : null;
      nativeTick(s, { dir, bomb: false });
      if (frame >= 143) assertReference(s, phase.get(`${mode}-${frame}`));
    }
  });

  it("retém um toque no tick sem passo PAL e permite restaurar a partida inteira", () => {
    const s = createNativeMatch(phase.get("phase-0-before"));
    step(s, { p1: { dir: null, bomb: true } });
    expect(s.bombs).toHaveLength(0);
    const restored: MatchState = JSON.parse(JSON.stringify(s));
    for (let tick = 0; tick < 40; tick++) {
      step(s, { p1: neutral });
      step(restored, { p1: neutral });
      expect(restored).toEqual(s);
    }
    expect(s.bombs).toHaveLength(1);
  });

  it("oferece a arena na seleção e inicializa a bolsa nativa por padrão", () => {
    expect(SELECTABLE_STAGES).toContain("sb2-01");
    const native = createMatch({ stage: "sb2-01", seed: 1, playerIds: ["p1", "p2"] });
    expect(native.stageState!.sb2!.itemBag!.slots).toHaveLength(64);
    expect(native.items).toEqual([]);
    expect(createMatch({ stage: "sb2-01", seed: 1, playerIds: ["1", "2", "3", "4", "5"], maniacItems: {} }).players).toHaveLength(5);
    const s = createNativeMatch(phase.get("phase-0-before"));
    s.players[0]!.px = (128.25 - 8) * TILE / 16;
    s.players[0]!.py = (136.75 - 24) * TILE / 16;
    expect(playerTile(s.players[0]!)).toEqual({ x: 7, y: 6 });
  });
});
