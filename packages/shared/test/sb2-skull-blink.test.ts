import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createMatch } from "../src/arena";
import { step } from "../src/step";
import { SB2_SKULL_BLINK_WORDS, SB2_SKULL_BLINK_PERIOD, sb2SkullHidden } from "../src/sb2-skull-blink";
import { sb2NativeFramesAfterTicks } from "../src/sb2-native-clock";
import type { MatchState } from "../src/state";

const read = (name: string) => JSON.parse(readFileSync(new URL(`../../../docs/sb2/${name}`, import.meta.url), "utf8"));
const rules = read("SB2-ITEM-RULES.json");
const report = read("SB2-SKULL-BLINK-COMPARISON.json");
interface Sample { label: string; players: { flags: number; skull_mode: number }[] }
const samples: Sample[] = report.samples;

describe("invisibilidade Skull SB2 no relógio PAL", () => {
  it("confronta a tabela implementada com as palavras extraídas da ROM", () => {
    expect([...SB2_SKULL_BLINK_WORDS, 0xffff]).toEqual(rules.blink_words);
    expect(SB2_SKULL_BLINK_PERIOD).toBe(352);
  });

  it("reproduz as 709 observações REA/MCP de dois ciclos completos pelo step", () => {
    let s = createMatch({ stage: "sb2-01", seed: 1, playerIds: ["p1", "p2"], maniacItems: {}, suddenDeath: false });
    s.players[0]!.curse = { kind: "invisible", sb2Status: 1, elapsed: 0 };
    for (let frame = 0; frame < samples.length; frame++) {
      if (frame) {
        const prior = sb2NativeFramesAfterTicks(s.tick);
        do { step(s, { p1: { dir: null, bomb: false } }); } while (sb2NativeFramesAfterTicks(s.tick) === prior);
      }
      const sample = samples[frame]!, curse = s.players[0]!.curse!;
      expect(sample.label).toBe(`blink-${frame}`);
      expect(sample.players[0]!.skull_mode).toBe(1);
      expect(curse.elapsed, sample.label).toBe(frame);
      expect(sb2SkullHidden(curse.elapsed!), sample.label).toBe((sample.players[0]!.flags & 64) !== 0);
      // A restauração ocorre dentro do trecho longo invisível, sem reiniciar o ciclo.
      if (frame === 250) s = JSON.parse(JSON.stringify(s)) as MatchState;
    }
  });

  it("mantém a piscada no tick de 60 Hz sem atualização PAL", () => {
    const s = createMatch({ stage: "sb2-01", seed: 1, playerIds: ["p1", "p2"], maniacItems: {} });
    s.players[0]!.curse = { kind: "invisible", sb2Status: 1, elapsed: 0 };
    step(s);
    expect(s.players[0]!.curse!.elapsed).toBe(0);
    step(s);
    expect(s.players[0]!.curse!.elapsed).toBe(1);
    expect(sb2SkullHidden(s.players[0]!.curse!.elapsed!)).toBe(true);
  });
});
