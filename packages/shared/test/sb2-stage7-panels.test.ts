import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sb2NativeNumberedPadSpeed, sb2NextPadNumber, type Sb2PadNumber } from "../src/sb2-numbered-pad";
import { sb2NativePauseInput, type Sb2PauseInput } from "../src/sb2-pause-panel";

interface NativeSample {
  sample: number;
  grids: { current: number[][]; background: number[][] };
  players: { seat: number; raw_hex: string }[];
  pad_glyphs: { offset: number; value: number }[];
  pad_random_word_0400: number;
}
interface Observation {
  label: string;
  frame: number;
  rea_sample: number;
  players: { x: number; y: number; state_word: number }[];
}
const bundle = JSON.parse(readFileSync(new URL("../../../docs/sb2/SB2-REA-STAGE7-PANELS.json", import.meta.url), "utf8"));

function loadReport(path: string) {
  const report = JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
  const record = bundle.records.find((value: { evidence_id: string }) => value.evidence_id === report.evidence_id);
  if (!record || record.normalized_result.messages_truncated) throw new Error("Evidência REA incompleta");
  const samples: NativeSample[] = record.normalized_result.messages
    .filter((message: { script_id: string; type: string; payload?: { kind: string } }) =>
      message.script_id === report.script_id && message.type === "send" && message.payload?.kind === "arena-effects")
    .map((message: { payload: NativeSample }) => message.payload);
  return (label: string) => {
    const observation = (report.samples as Observation[]).find(value => value.label === label);
    const sample = samples.find(value => value.sample === observation?.rea_sample);
    if (!observation || !sample) throw new Error(`Amostra ausente: ${label}`);
    return { observation, sample };
  };
}
const pause = loadReport("../../../docs/sb2/SB2-PAUSE-PANEL-COMPARISON.json");
const panels = loadReport("../../../docs/sb2/SB2-STAGE7-PANELS-FINAL-COMPARISON.json");
const up: Sb2PauseInput = { dir: "up", bomb: false };
const down: Sb2PauseInput = { dir: "down", bomb: false };
const neutral: Sb2PauseInput = { dir: null, bomb: false };
const bomb: Sb2PauseInput = { dir: null, bomb: true };
const glyphs: Record<Sb2PadNumber, number> = { 1: 0x1c28, 2: 0x1c2a, 3: 0x1c2c, 4: 0x1c2e, 5: 0x1c48 };

function moveY(y: number, input: Sb2PauseInput | null): number {
  return y + (input?.dir === "up" ? -1.25 : input?.dir === "down" ? 1.25 : 0);
}

describe("pausa central e placa direita de SB2, conferidas no REA", () => {
  it.each<[string, Sb2PauseInput]>([
    ["opposite", down], ["neutral", neutral], ["same", up], ["bomb", bomb],
  ])("reproduz a recuperação com comando %s recebido depois da entrada", (mode, current) => {
    let y = pause("entered").observation.players[0]!.y;
    for (let elapsed = 1; elapsed <= 130; elapsed++) {
      const input = sb2NativePauseInput(elapsed, up, current);
      y = moveY(y, input);
      if (elapsed < 125 && mode !== "opposite") continue;
      const reference = pause(`${mode}-${elapsed}`);
      expect(y).toBe(reference.observation.players[0]!.y);
      if (mode === "bomb" && elapsed >= 125) {
        expect(reference.sample.grids.current[6]![7] === 67).toBe(elapsed >= 128);
        expect(input?.bomb === true).toBe(elapsed >= 128);
      }
    }
  });

  it.each<[string, Sb2PauseInput]>([
    ["up", up], ["down", down], ["neutral", neutral], ["bomb", bomb],
  ])("preserva o comando %s escolhido no próprio frame de entrada", (mode, entry) => {
    let y = pause("before-entry").observation.players[0]!.y;
    const first = panels(`entry-${mode}-entered`);
    for (let elapsed = 0; elapsed <= 127; elapsed++) {
      const input = sb2NativePauseInput(elapsed, entry, entry);
      y = moveY(y, input);
      if (![0, 126, 127].includes(elapsed)) continue;
      const reference = elapsed === 0 ? first : panels(`entry-${mode}-${elapsed}`);
      expect(y).toBe(reference.observation.players[0]!.y);
      const raw = Buffer.from(reference.sample.players[0]!.raw_hex, "hex");
      expect((raw.readUInt16LE(0x0e) & 8) !== 0).toBe(input === null);
      expect(reference.sample.grids.current[6]![7] === 67).toBe(mode === "bomb" && elapsed === 127);
    }
  });

  it("executa na liberação a bomba pressionada somente no frame de entrada", () => {
    for (const [label, elapsed] of [["pulse-bomb-entry", 0], ["pulse-bomb-last-frozen", 126],
      ["pulse-bomb-release", 127], ["pulse-bomb-ready", 128]] as const) {
      const reference = panels(label);
      const input = sb2NativePauseInput(elapsed, bomb, neutral);
      expect(input?.bomb === true).toBe(elapsed === 127);
      expect(reference.sample.grids.current[6]![7] === 67).toBe(elapsed >= 127);
    }
  });

  it.each<[Sb2PadNumber, number]>([[1, 4], [2, 2], [3, 10], [4, 3], [5, 0]])(
    "aplica a velocidade %i também na placa direita, sem trocar a esquerda", (number, delay) => {
      const prefix = `confirmed-right-${delay}`;
      const beforeFirst = panels(`${prefix}-before-first`);
      const selected = panels(`${prefix}-selected`);
      const before = panels(`${prefix}-before-entry`);
      const entered = panels(`${prefix}-entered`);
      const idle = panels(`${prefix}-idle`);
      const glyph = (sample: NativeSample, offset: number) => sample.pad_glyphs.find(value => value.offset === offset)!.value;
      expect(glyph(before.sample, 0x1a25a)).toBe(glyphs[number]);
      expect(glyph(selected.sample, 0x1a25a)).toBe(glyphs[sb2NextPadNumber(beforeFirst.sample.pad_random_word_0400)]);
      expect(glyph(entered.sample, 0x1a25a)).toBe(glyphs[sb2NextPadNumber(before.sample.pad_random_word_0400)]);
      const speed = sb2NativeNumberedPadSpeed(number);
      const raw = Buffer.from(entered.sample.players[0]!.raw_hex, "hex");
      expect(raw.readUInt16LE(0xa0) + raw.readUInt16LE(0xa2) / 65536).toBe(speed);
      expect(entered.observation.players[0]!.x - before.observation.players[0]!.x).toBe(speed);
      expect(idle.observation.players[0]).toEqual(entered.observation.players[0]);
      for (const value of [beforeFirst, selected, before, entered, idle]) {
        expect(glyph(value.sample, 0x1b246)).toBe(glyphs[3]);
        expect(glyph(value.sample, 0x1b250)).toBe(0x1c4a);
      }
    },
  );

  it("mantém dano ativo enquanto os comandos estão bloqueados", () => {
    const entered = panels("damage-entered");
    const flame = panels("damage-fine-5");
    const hit = panels("damage-fine-6");
    const elapsed = hit.observation.frame - entered.observation.frame;
    expect(sb2NativePauseInput(elapsed, up, neutral)).toBeNull();
    expect(flame.sample.grids.current[6]![7]).toBe(1);
    expect(flame.observation.players[0]!.state_word).toBe(0x9002);
    expect(hit.observation.frame - flame.observation.frame).toBe(1);
    expect(hit.observation.players[0]!.state_word).toBe(0x9802);
    expect(hit.sample.grids.current[6]![7]).toBe(1);
  });

  it("reinicia a pausa depois de sair e entrar novamente", () => {
    const first = panels("confirmed-reentry-entered");
    let y = first.observation.players[0]!.y;
    const last = panels("confirmed-reentry-last-frozen");
    const released = panels("confirmed-reentry-released");
    const ready = panels("confirmed-reentry-ready");
    for (let elapsed = 0; elapsed <= ready.observation.frame - first.observation.frame; elapsed++) {
      const input = sb2NativePauseInput(elapsed, up, neutral);
      y = moveY(y, input);
      for (const reference of [first, last, released, ready]) {
        if (reference.observation.frame - first.observation.frame !== elapsed) continue;
        expect(y).toBe(reference.observation.players[0]!.y);
        const raw = Buffer.from(reference.sample.players[0]!.raw_hex, "hex");
        expect((raw.readUInt16LE(0x0e) & 8) !== 0).toBe(input === null);
      }
    }
  });
});
