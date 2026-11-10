import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TILE } from "../src/constants";
import { advanceSb2Stage7Controller, createSb2Stage7Controller, type Sb2Stage7Controller } from "../src/sb2-stage7-controller";
import type { Sb2PauseInput } from "../src/sb2-pause-panel";
import type { Player } from "../src/state";
import { createMatch } from "../src/arena";
import { step } from "../src/step";
import { sb2NativeFramesAfterTicks } from "../src/sb2-native-clock";
import { Tile, type MatchState } from "../src/state";

interface Sample {
  sample: number;
  grids: { current: number[][] };
  pad_random_word_0400: number;
  pad_glyphs: { offset: number; value: number }[];
}
interface Observation {
  label: string;
  frame: number;
  rea_sample: number;
  players: { x: number; y: number }[];
}
type Actor = Pick<Player, "id" | "px" | "py" | "alive">;
const read = (name: string) => JSON.parse(readFileSync(new URL(`../../../docs/sb2/${name}`, import.meta.url), "utf8"));
const bundle = read("SB2-REA-STAGE7-PANELS.json");
function load(name: string) {
  const report = read(name);
  const record = bundle.records.find((value: { evidence_id: string }) => value.evidence_id === report.evidence_id);
  if (!record || record.normalized_result.messages_truncated) throw new Error("Evidência REA incompleta");
  const samples: Sample[] = record.normalized_result.messages
    .filter((value: { script_id: string; type: string; payload?: { kind: string } }) =>
      value.script_id === report.script_id && value.type === "send" && value.payload?.kind === "arena-effects")
    .map((value: { payload: Sample }) => value.payload);
  const observations = report.samples as Observation[];
  return { observations, get(label: string) {
    const observation = observations.find(value => value.label === label);
    const sample = samples.find(value => value.sample === observation?.rea_sample);
    if (!sample || !observation) throw new Error(`Amostra ausente: ${label}`);
    return { observation, sample };
  } };
}
const pause = load("SB2-PAUSE-PANEL-COMPARISON.json");
const panels = load("SB2-STAGE7-PANELS-FINAL-COMPARISON.json");
const starts = read("SB2-STAGE7-RNG-STARTS.json").samples;
const up: Sb2PauseInput = { dir: "up", bomb: false };
const neutral: Sb2PauseInput = { dir: null, bomb: false };
const noRandom: () => number = () => { throw new Error("Sorteio inesperado"); };
function actor(x: number, y: number): Actor {
  return { id: "p1", px: (x - 8) * TILE / 16, py: (y - 24) * TILE / 16, alive: true };
}
function position(player: Actor) {
  return { x: player.px / (TILE / 16) + 8, y: player.py / (TILE / 16) + 24 };
}
// Aplicação da saída em trecho livre; colisões e alinhamento não são simulados.
function tick(state: Sb2Stage7Controller, player: Actor, input: Sb2PauseInput, random = noRandom) {
  const control = advanceSb2Stage7Controller(state, [player], { p1: input }, random).p1!;
  const speed = control.nativeSpeed * TILE / 16;
  if (control.input?.dir === "up") player.py -= speed;
  if (control.input?.dir === "down") player.py += speed;
  if (control.input?.dir === "left") player.px -= speed;
  if (control.input?.dir === "right") player.px += speed;
  return control;
}
function nativeTick(state: Sb2Stage7Controller, player: Actor, input: Sb2PauseInput, random = noRandom) {
  const before = state.nativeFrame;
  let control;
  do { control = tick(state, player, input, random); } while (state.nativeFrame === before);
  return control;
}

function mainTick(s: MatchState, input: Sb2PauseInput) {
  const prior = sb2NativeFramesAfterTicks(s.tick);
  do { step(s, { p1: input }); } while (sb2NativeFramesAfterTicks(s.tick) === prior);
}
function nativeMatch(label: string) {
  const reference = panels.get(label), rng = starts[label];
  const s = createMatch({ stage: "sb2-07", seed: 1, playerIds: ["p1", "p2"], maniacItems: {}, suddenDeath: false });
  Object.assign(s.players[0]!, actor(reference.observation.players[0]!.x, reference.observation.players[0]!.y));
  s.grid.tiles = reference.sample.grids.current.flatMap(row => row.map(code => {
    const cell = code & 63;
    return cell === 2 ? Tile.Block : cell === 5 || cell === 6 ? Tile.Wall : Tile.Empty;
  }));
  Object.assign(s.stageState!.sb2!, { counterOffset: rng.phase, randomSeed: rng.seed, randomWord: rng.word });
  return s;
}

describe("arena 7 no step principal", () => {
  it("recebe o dano nativo durante a pausa sem executar o comando de bomba", () => {
    const first = panels.get("damage-entered"), reference = panels.get("damage-fine-6");
    const s = nativeMatch("damage-fine-5");
    const controller = s.stageState!.sb2!.stage7 = createSb2Stage7Controller();
    controller.players.p1 = { cell: { x: 7, y: 6 }, nativeSpeed: 1.25, pendingBomb: false,
      pause: { enteredAt: starts["damage-entered"].phase, input: up } };
    const native = panels.get("damage-fine-5");
    expect(native.sample.grids.current[6]![7]).toBe(1);
    expect(native.observation.frame - first.observation.frame).toBeGreaterThan(0);
    s.flames = [{ x: 7, y: 6, ownerId: "p2", ttl: 26 }];
    mainTick(s, { dir: "down", bomb: true });
    expect(s.players[0]!.alive).toBe(false);
    expect(position(s.players[0]!)).toEqual({ x: reference.observation.players[0]!.x, y: reference.observation.players[0]!.y });
    expect(s.bombs).toEqual([]);
  });

  it.each([0, 2, 3, 4, 10])("reproduz ida, nova velocidade e RNG da placa direita no ensaio %i", delay => {
    const prefix = `confirmed-right-${delay}`, s = nativeMatch(`${prefix}-before-first`);
    mainTick(s, { dir: "left", bomb: false });
    const selected = panels.get(`${prefix}-selected`);
    const glyphs = { 1: 0x1c28, 2: 0x1c2a, 3: 0x1c2c, 4: 0x1c2e, 5: 0x1c48 };
    expect(glyphs[s.stageState!.sb2!.stage7!.numbers.right]).toBe(selected.sample.pad_glyphs.find(value => value.offset === 0x1a25a)!.value);
    for (let frame = 0; frame < 12; frame++) mainTick(s, { dir: "left", bomb: false });
    mainTick(s, { dir: "right", bomb: false });
    const before = panels.get(`${prefix}-before-entry`);
    expect(position(s.players[0]!)).toEqual({ x: before.observation.players[0]!.x, y: before.observation.players[0]!.y });
    expect(s.stageState!.sb2!.randomWord).toBe(before.sample.pad_random_word_0400);
    mainTick(s, { dir: "right", bomb: false });
    const entered = panels.get(`${prefix}-entered`);
    expect(position(s.players[0]!)).toEqual({ x: entered.observation.players[0]!.x, y: entered.observation.players[0]!.y });
    expect(s.stageState!.sb2!.randomWord).toBe(entered.sample.pad_random_word_0400);
    expect(glyphs[s.stageState!.sb2!.stage7!.numbers.right]).toBe(entered.sample.pad_glyphs.find(value => value.offset === 0x1a25a)!.value);
    expect(s.stageState!.sb2!.stage7!.numbers.left).toBe(3);
    for (let frame = 0; frame < 120; frame++) mainTick(s, neutral);
    expect(position(s.players[0]!)).toEqual({ x: entered.observation.players[0]!.x, y: entered.observation.players[0]!.y });
    expect(s.stageState!.sb2!.randomWord).toBe(panels.get(`${prefix}-idle`).sample.pad_random_word_0400);
  });

  it("executa a bomba retida na entrada da pausa e restaura o estado completo", () => {
    let s = nativeMatch("pulse-bomb-entry");
    // A captura já está no primeiro frame congelado; restaura o comando de entrada.
    const controller = s.stageState!.sb2!.stage7 = createSb2Stage7Controller();
    const initial = starts["pulse-bomb-entry"];
    controller.nativeFrame = initial.phase;
    controller.players.p1 = { cell: { x: 7, y: 6 }, nativeSpeed: 1.25, pendingBomb: false,
      pause: { enteredAt: initial.phase, input: { dir: null, bomb: true } } };
    for (let elapsed = 1; elapsed <= 128; elapsed++) {
      mainTick(s, neutral);
      if (elapsed === 60) s = JSON.parse(JSON.stringify(s));
      if (![126, 127, 128].includes(elapsed)) continue;
      const label = elapsed === 126 ? "pulse-bomb-last-frozen" : elapsed === 127 ? "pulse-bomb-release" : "pulse-bomb-ready";
      const reference = panels.get(label);
      expect(position(s.players[0]!)).toEqual({ x: reference.observation.players[0]!.x, y: reference.observation.players[0]!.y });
      expect(s.bombs.some(b => b.x === 7 && b.y === 6)).toBe(reference.sample.grids.current[6]![7] === 67);
    }
  });
});

describe("composição do relógio e dos pisos da arena 7", () => {
  it.each<[string, Sb2PauseInput]>([
    ["opposite", { dir: "down", bomb: false }], ["neutral", neutral],
    ["same", up], ["bomb", { dir: null, bomb: true }],
  ])("reproduz o trecho nativo de pausa %s usando posições do MatchState a 60 Hz", (mode, input) => {
    const state = createSb2Stage7Controller();
    const before = pause.get("before-entry").observation;
    const player = actor(before.players[0]!.x, before.players[0]!.y);
    const byFrame = new Map(pause.observations.filter(value => value.label === "entered" ||
      value.label.startsWith(`${mode}-`) && /^\d+$/.test(value.label.slice(mode.length + 1)))
      .map(value => [value.frame - before.frame, value]));
    const seen = new Set<number>();
    while (state.nativeFrame < Math.max(...byFrame.keys())) {
      const control = tick(state, player, state.nativeFrame === 0 ? up : input);
      const reference = byFrame.get(state.nativeFrame);
      if (reference) {
        expect(position(player)).toEqual({ x: reference.players[0]!.x, y: reference.players[0]!.y });
        seen.add(state.nativeFrame);
      }
      if (mode === "bomb" && control.input?.bomb) expect(state.nativeFrame).toBeGreaterThanOrEqual(129);
    }
    expect(seen.size).toBe(mode === "opposite" ? 131 : 8);
  });

  it.each([0, 2, 3, 4, 10])("compõe a ida e a reentrada direita do ensaio %i", delay => {
    const state = createSb2Stage7Controller();
    const prefix = `confirmed-right-${delay}`;
    const first = panels.get(`${prefix}-before-first`);
    const before = panels.get(`${prefix}-before-entry`);
    const entered = panels.get(`${prefix}-entered`);
    const player = actor(first.observation.players[0]!.x, first.observation.players[0]!.y);
    const words = [first.sample.pad_random_word_0400, before.sample.pad_random_word_0400];
    const random = () => { const value = words.shift(); if (value === undefined) throw new Error("Sorteio extra"); return value; };
    nativeTick(state, player, { dir: "left", bomb: false }, random);
    for (let frame = 0; frame < 12; frame++) nativeTick(state, player, { dir: "left", bomb: false }, random);
    nativeTick(state, player, { dir: "right", bomb: false }, random);
    expect(position(player)).toEqual({ x: before.observation.players[0]!.x, y: before.observation.players[0]!.y });
    nativeTick(state, player, { dir: "right", bomb: false }, random);
    expect(position(player)).toEqual({ x: entered.observation.players[0]!.x, y: entered.observation.players[0]!.y });
    expect(words).toEqual([]);
    const glyphs = { 1: 0x1c28, 2: 0x1c2a, 3: 0x1c2c, 4: 0x1c2e, 5: 0x1c48 };
    expect(glyphs[state.numbers.right]).toBe(entered.sample.pad_glyphs.find(value => value.offset === 0x1a25a)!.value);
    expect(state.numbers.left).toBe(3);
    for (let frame = 0; frame < 120; frame++) nativeTick(state, player, neutral, random);
    expect(position(player)).toEqual({ x: entered.observation.players[0]!.x, y: entered.observation.players[0]!.y });
  });

  it("preserva um toque de bomba recebido num tick sem passo PAL e o consome uma vez", () => {
    const state = createSb2Stage7Controller(), player = actor(32, 48);
    expect(tick(state, player, { dir: null, bomb: true }).input).toBeNull();
    expect(tick(state, player, neutral).input?.bomb).toBe(true);
    expect(tick(state, player, neutral).input?.bomb).toBe(false);
  });

  it("descarta toques durante a pausa em vez de executá-los depois", () => {
    const state = createSb2Stage7Controller(), player = actor(128.25, 136.75);
    nativeTick(state, player, up);
    expect(tick(state, player, { dir: null, bomb: true }).input).toBeNull();
    while (state.nativeFrame < 130) expect(tick(state, player, neutral).input?.bomb ?? false).toBe(false);
  });

  it("preserva fase e comando guardado após serialização", () => {
    const state = createSb2Stage7Controller(), player = actor(128.25, 136.75);
    nativeTick(state, player, up);
    while (state.nativeFrame < 70) tick(state, player, neutral);
    const restored: { state: Sb2Stage7Controller; player: Actor } = JSON.parse(JSON.stringify({ state, player }));
    while (state.nativeFrame < 135) {
      expect(tick(restored.state, restored.player, neutral)).toEqual(tick(state, player, neutral));
      expect(restored.state).toEqual(state);
      expect(restored.player).toEqual(player);
    }
  });

  it("guarda na pausa o toque preservado entre ticks e o libera no frame nativo medido", () => {
    const state = createSb2Stage7Controller(), player = actor(128.25, 136.75);
    expect(tick(state, player, { dir: null, bomb: true }).input).toBeNull();
    const first = panels.get("pulse-bomb-entry").observation;
    const release = panels.get("pulse-bomb-release").observation;
    const seen = new Set<number>();
    while (state.nativeFrame < 129) {
      const previous = state.nativeFrame;
      const control = tick(state, player, neutral);
      if (control.input?.bomb) {
        expect(state.nativeFrame).not.toBe(previous);
        expect(state.nativeFrame - 1).toBe(release.frame - first.frame);
        seen.add(state.nativeFrame);
      }
    }
    expect([...seen]).toEqual([128]);
    expect(position(player)).toEqual({ x: release.players[0]!.x, y: release.players[0]!.y });
  });

  it("preserva o toque ainda pendente quando o estado é serializado antes do passo PAL", () => {
    const state = createSb2Stage7Controller(), player = actor(32, 48);
    tick(state, player, { dir: null, bomb: true });
    const restored: { state: Sb2Stage7Controller; player: Actor } = JSON.parse(JSON.stringify({ state, player }));
    const resumed = tick(restored.state, restored.player, neutral);
    expect(resumed.input?.bomb).toBe(true);
    expect(resumed).toEqual(tick(state, player, neutral));
    expect(restored.state).toEqual(state);
    expect(tick(restored.state, restored.player, neutral).input?.bomb).toBe(false);
  });

  it("descarta o controle de um jogador morto sem suspender o relógio da arena", () => {
    const state = createSb2Stage7Controller(), player = actor(128.25, 136.75);
    nativeTick(state, player, up);
    player.alive = false;
    const before = state.tick;
    expect(tick(state, player, { dir: null, bomb: true }).input).toBeNull();
    expect(state.players.p1).toBeUndefined();
    expect(state.tick).toBe(before + 1);
  });
});
