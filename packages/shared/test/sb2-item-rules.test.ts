import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createMatch } from "../src/arena";
import { collectItems } from "../src/items";
import { effectiveCapacity, effectiveRange, effectiveSpeed } from "../src/curse";
import { SB2_ITEM_SPEEDS, SB2_SKULL_MODES, SB2_STAGE7_SKULL_MODES, SB2_HEART_SKULL_MODES } from "../src/sb2-items";
import { sb2NativeFramesAfterTicks } from "../src/sb2-native-clock";
import { step } from "../src/step";
import { TILE } from "../src/constants";
import { ItemKind, Tile, playerTile, type Player } from "../src/state";

interface Native {
  inventory: number[]; x: number; y: number; speed: number; word: number; phase: number; bombs: number[][];
}
const rules = JSON.parse(readFileSync(new URL("../../../docs/sb2/SB2-ITEM-RULES.json", import.meta.url), "utf8"));
const transitions: { label: string; before: Native; after: Native }[] = rules.transitions;
const actions: (Native & { label: string })[] = rules.actions;
function restore(p: Player, native: Native) {
  p.px = (native.x - 8) * TILE / 16;
  p.py = (native.y - 24) * TILE / 16;
  p.bombCapacity = native.inventory[1]!;
  p.fireRange = native.inventory[2]! + 1;
  p.speed = SB2_ITEM_SPEEDS[native.inventory[0]!]! * TILE / 16;
}

describe("itens e sorteio Skull SB2 observados no original", () => {
  it("confronta as tabelas implementadas com os bytes da ROM", () => {
    expect(SB2_ITEM_SPEEDS).toEqual(rules.speeds);
    expect(SB2_SKULL_MODES).toEqual(rules.skull_modes);
    expect(SB2_STAGE7_SKULL_MODES).toEqual(rules.arena_internal_8_skull_modes);
    expect(SB2_HEART_SKULL_MODES).toEqual(rules.heart_skull_modes);
  });

  it.each(transitions)("reproduz o modo e os atributos na coleta $label", ({ before, after }) => {
    const s = createMatch({ stage: "sb2-01", seed: 1, playerIds: ["p1", "p2"], maniacItems: {}, suddenDeath: false });
    const p = s.players[0]!;
    restore(p, before);
    p.px = (after.x - 8) * TILE / 16;
    p.py = (after.y - 24) * TILE / 16;
    s.stageState!.sb2!.randomWord = before.word;
    const cell = playerTile(p);
    s.grid.tiles[cell.y * s.grid.width + cell.x] = Tile.Empty;
    s.items = [{ ...cell, kind: ItemKind.Skull }];
    collectItems(s);
    expect(p.curse?.sb2Status).toBe(after.inventory[21]);
    expect(effectiveSpeed(p) / (TILE / 16)).toBe(after.speed);
    expect(effectiveCapacity(p)).toBe(after.inventory[17]);
    expect(effectiveRange(p)).toBe(after.inventory[18]! + 1);
    expect(p.bombCapacity).toBe(after.inventory[1]);
    expect(p.fireRange).toBe(after.inventory[2]! + 1);
    expect(s.items).toEqual([]);
  });

  it("coloca automaticamente nos mesmos frames dos 24 passos neutros nativos sem luva", () => {
    const before = actions.find(row => row.label === "action-2-before")!;
    const s = createMatch({ stage: "sb2-01", seed: 1, playerIds: ["p1", "p2"], maniacItems: {}, suddenDeath: false });
    restore(s.players[0]!, before);
    s.stageState!.sb2!.counterOffset = before.phase;
    s.players[0]!.curse = { kind: "diarrhea", sb2Status: 2, elapsed: 0 };
    const cell = playerTile(s.players[0]!);
    s.grid.tiles[cell.y * s.grid.width + cell.x] = Tile.Empty;
    for (let frame = 1; frame <= 24; frame++) {
      const prior = sb2NativeFramesAfterTicks(s.tick);
      do { step(s, { p1: { dir: null, bomb: false } }); } while (sb2NativeFramesAfterTicks(s.tick) === prior);
      const native = actions.find(row => row.label === `action-2-neutral-${frame}`)!;
      expect(s.bombs.map(b => [b.x, b.y]), native.label).toEqual(native.bombs);
    }
  });
});
