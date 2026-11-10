import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createMatch } from "../src/arena";
import { step } from "../src/step";
import { TILE } from "../src/constants";
import { sb2NativeFramesAfterTicks } from "../src/sb2-native-clock";
import { Tile, ItemKind, type MatchState, type PlayerInput } from "../src/state";

const replay = JSON.parse(readFileSync(new URL("../../../docs/sb2/SB2-NATIVE-PICKUP-REPLAY.json", import.meta.url), "utf8"));
const kinds: Record<number, ItemKind> = {
  0x1600: ItemKind.Bomb, 0x1602: ItemKind.Fire, 0x1622: ItemKind.Speed,
  0x160a: ItemKind.Skull, 0x1626: ItemKind.Glove, 0x1624: ItemKind.Kick,
};
const tiles = (grid: number[][]) => grid.flatMap(row => row.map(code => {
  const cell = code & 63;
  return cell === 2 ? Tile.Block : cell === 5 || cell === 6 ? Tile.Wall : Tile.Empty;
}));
function nativeTick(s: MatchState, input: PlayerInput) {
  const before = sb2NativeFramesAfterTicks(s.tick);
  do { step(s, { p1: input }); } while (sb2NativeFramesAfterTicks(s.tick) === before);
}

describe("bolsa e coletas no step real SB2", () => {
  it("confere os 13 frames adicionais de alinhamento ao sair de uma bomba", () => {
    const before = replay.events.find((event: { label: string }) => event.label === "dig-04-before-bomb");
    const report = JSON.parse(readFileSync(new URL("../../../docs/sb2/SB2-PICKUP-MOTION-COMPARISON.json", import.meta.url), "utf8"));
    const s = createMatch({ stage: "sb2-01", seed: 1, playerIds: ["p1", "p2"], maniacItems: {}, suddenDeath: false });
    const p = s.players[0]!;
    s.grid.tiles = tiles(before.grid);
    s.stageState!.sb2!.counterOffset = before.phase;
    p.px = (before.players[0].x - 8) * TILE / 16;
    p.py = (before.players[0].y - 24) * TILE / 16;
    p.bombCapacity = before.inventory[1];
    p.fireRange = before.inventory[2] + 1;
    nativeTick(s, { dir: null, bomb: true });
    for (let frame = 1; frame <= 13; frame++) {
      nativeTick(s, { dir: "left", bomb: false });
      const sample = report.samples.find((row: { label: string }) => row.label === `dig4-${frame}`);
      expect({ x: p.px / (TILE / 16) + 8, y: p.py / (TILE / 16) + 24 }, sample.label)
        .toEqual({ x: sample.players[0].x, y: sample.players[0].y });
    }
  });

  it("restaura a bolsa e a sequência RNG por JSON antes de revelar um item", () => {
    const s = createMatch({ stage: "sb2-01", seed: 45483, playerIds: ["p1", "p2"], suddenDeath: false });
    s.players[0]!.py = (64.25 - 24) * TILE / 16;
    s.stageState!.sb2!.counterOffset = 143;
    nativeTick(s, { dir: null, bomb: true });
    for (let frame = 1; frame <= 140; frame++) nativeTick(s, { dir: frame <= 13 ? "up" : frame <= 26 ? "right" : null, bomb: false });
    const restored: MatchState = JSON.parse(JSON.stringify(s));
    for (let frame = 0; frame < 50; frame++) {
      nativeTick(s, { dir: null, bomb: false });
      nativeTick(restored, { dir: null, bomb: false });
      expect(restored).toEqual(s);
    }
    expect(s.items).toEqual([{ x: 1, y: 4, kind: ItemKind.Bomb }]);
    expect(s.stageState!.sb2!.itemBag!.slots[0]).toBe(0);
  });

  it("reexecuta 15 escavações e todas as 220 leituras observadas por REA/MCP", () => {
    const first = replay.events[0];
    const s = createMatch({ stage: "sb2-01", seed: 45483, playerIds: ["p1", "p2"], suddenDeath: false });
    const p = s.players[0]!, runtime = s.stageState!.sb2!;
    s.grid.tiles = tiles(first.grid);
    runtime.counterOffset = first.phase;
    runtime.itemBag!.slots = first.bag.slice();
    runtime.randomSeed = first.seed;
    runtime.randomWord = first.word;
    p.px = (first.players[0].x - 8) * TILE / 16;
    p.py = (first.players[0].y - 24) * TILE / 16;
    p.bombCapacity = first.inventory[1];
    p.fireRange = first.inventory[2] + 1;
    p.speed = first.speed * TILE / 16;
    for (const event of replay.events) {
      if (event.kind === "advance") {
        const buttons: string[] = event.buttons ?? [];
        const dir = buttons.find(value => ["UP", "DOWN", "LEFT", "RIGHT"].includes(value))?.toLowerCase() as PlayerInput["dir"] | undefined;
        for (let frame = 0; frame < event.frames; frame++) nativeTick(s, { dir: dir ?? null, bomb: buttons.includes("A") });
        continue;
      }
      expect({ x: p.px / (TILE / 16) + 8, y: p.py / (TILE / 16) + 24 }, event.label)
        .toEqual({ x: event.players[0].x, y: event.players[0].y });
      expect(s.grid.tiles, event.label).toEqual(tiles(event.grid));
      expect(runtime.itemBag!.slots, event.label).toEqual(event.bag);
      expect(runtime.randomSeed, event.label).toBe(event.seed);
      expect(runtime.randomWord, event.label).toBe(event.word);
      expect({ cap: p.bombCapacity, range: p.fireRange, speed: p.speed / (TILE / 16), kick: p.canKick, glove: p.canGlove }, event.label)
        .toEqual({ cap: event.inventory[1], range: event.inventory[2] + 1, speed: event.speed,
          kick: event.inventory[31] > 0, glove: event.inventory[30] > 0 });
      expect(s.items.map(item => `${item.x},${item.y}:${item.kind}`).sort(), event.label)
        .toEqual(event.items.map((item: { x: number; y: number; glyph: number }) => `${item.x},${item.y}:${kinds[item.glyph]}`).sort());
    }
  });
});
