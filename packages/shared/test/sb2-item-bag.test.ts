import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createSb2ItemBag, takeSb2Item } from "../src/sb2-item-bag";
import { nextSb2RandomWord } from "../src/sb2-rng";
import { SB2_ITEM_COUNTS, SB2_ITEM_GLYPHS } from "../src/sb2-item-tables";
import type { Sb2ArenaNumber } from "../src/sb2-stage-captures";
import { createMatch } from "../src/arena";
import { step } from "../src/step";
import { sb2NativeFramesAfterTicks } from "../src/sb2-native-clock";

const read = (name: string) => JSON.parse(readFileSync(new URL(`../../../docs/sb2/${name}`, import.meta.url), "utf8"));
interface Capture {
  arena: Sb2ArenaNumber;
  initial_seed: number;
  phase_at_capture: number;
  seed_at_capture: number;
  word_at_capture: number;
  slots: number[];
}
const captures: Capture[] = read("SB2-ITEM-BAG-COMPARISON.json").samples;
const tables = read("SB2-ITEM-ROM-TABLES.json");

describe("bolsa SB2 observada no Snes9x por REA e MCP", () => {
  it.each([["sb2-01", 1], ["sb2-02", 2], ["sb2-04", 4], ["sb2-06", 6], ["sb2-07", 7], ["sb2-08", 8]] as const)("inicializa bolsa e RNG de %s no step até o frame nativo observado", (stage, arena) => {
    const capture = captures.find(value => value.arena === arena)!;
    const s = createMatch({ stage, seed: capture.initial_seed, playerIds: ["p1", "p2"], suddenDeath: false });
    while (sb2NativeFramesAfterTicks(s.tick) < capture.phase_at_capture) step(s);
    expect(s.stageState!.sb2!.itemBag!.slots).toEqual(capture.slots);
    expect(s.stageState!.sb2!.randomSeed).toBe(capture.seed_at_capture);
    expect(s.stageState!.sb2!.randomWord).toBe(capture.word_at_capture);
  });

  it.each(captures)("reproduz as 64 entradas da arena $arena e a sequência RNG até a captura", capture => {
    const bag = createSb2ItemBag(capture.arena, capture.initial_seed);
    expect(bag.slots).toEqual(capture.slots);
    let seed = bag.seed, word = 0;
    // Uma chamada inicial na fase zero, seguida de uma por frame nativo.
    for (let frame = 0; frame <= capture.phase_at_capture; frame++) {
      ({ seed, word } = nextSb2RandomWord(seed));
    }
    expect(seed).toBe(capture.seed_at_capture);
    expect(word).toBe(capture.word_at_capture);
    expect(bag.draws).toBeGreaterThan(SB2_ITEM_COUNTS[capture.arena].reduce<number>((sum, count) => sum + count, 0));
  });

  it("preserva as contagens e a ordem das seleções extraídas da ROM", () => {
    expect(SB2_ITEM_GLYPHS).toEqual(tables.glyphs);
    for (const arena of tables.arenas) {
      expect(SB2_ITEM_COUNTS[arena.number as Sb2ArenaNumber]).toEqual(arena.counts);
      const bag = captures.find(value => value.arena === arena.number)!;
      for (const [index, glyph] of SB2_ITEM_GLYPHS.entries()) {
        expect(bag.slots.filter(value => value === glyph)).toHaveLength(arena.counts[index]);
      }
    }
  });

  it("consome Bomb Up, Fire Up e a entrada sem item na ordem observada", () => {
    const bag = createSb2ItemBag(1, captures[0]!.initial_seed);
    expect(takeSb2Item(bag)).toBe(0x1600);
    expect(takeSb2Item(bag)).toBe(0x1602);
    expect(takeSb2Item(bag)).toBeNull();
    expect(bag.slots.slice(0, 3)).toEqual([0, 0, 0]);
    const remaining = bag.slots.slice(3).map(value => value & 0x8000 ? null : value);
    for (const expected of remaining) expect(takeSb2Item(bag)).toBe(expected);
    expect(bag.slots.every(value => value === 0)).toBe(true);
    expect(takeSb2Item(bag)).toBeNull();
  });
});
