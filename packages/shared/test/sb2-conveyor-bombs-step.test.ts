import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createMatch } from "../src/arena";
import { TILE } from "../src/constants";
import { sb2NativeFramesAfterTicks } from "../src/sb2-native-clock";
import { createSb2Stage8Controller } from "../src/sb2-stage8-controller";
import { step } from "../src/step";
import { ItemKind, Tile, type MatchState, type PlayerInput } from "../src/state";

interface Sample {
  label: string; buttons: string[]; buttons2?: string[]; phase: number; seed: number; word: number;
  speed: number; facing_code: number; control_word: number; grid: number[][];
  item_bag?: number[]; items?: { x: number; y: number; glyph: number }[];
  bomb: { state_word: number; x: number; y: number; table_state: number };
  players: { x: number; y: number; state_word: number }[];
  players_full?: { x: number; y: number; state_word: number; facing_code: number; speed: number }[];
  first_bombs?: { seat: number; moving: boolean; x?: number; y?: number; grid_x?: number; grid_y?: number }[];
}
interface Case { label: string; samples: Sample[] }
const read = (name: string): Case[] => JSON.parse(readFileSync(new URL(`../../../docs/sb2/${name}`, import.meta.url), "utf8")).cases;
const cases = [
  ...read("SB2-CONVEYOR-BOMBS-NEUTRAL-STEP-REPLAY.json").map(test => ({ ...test, label: `neutral-${test.label}` })),
  ...read("SB2-CONVEYOR-PLANTED-STEP-REPLAY.json").map(test => ({ ...test, label: `manual-${test.label}` })),
  ...read("SB2-CONVEYOR-BOMB-LIFECYCLE-REPLAY.json").map(test => ({ ...test, label: `lifecycle-${test.label}` })),
  ...read("SB2-CONVEYOR-MULTIPLAYER-VERIFIED-REPLAY.json").map(test => ({ ...test, label: `multiplayer-${test.label}` })),
  ...read("SB2-CONVEYOR-CHAIN-TIMINGS-REPLAY.json").map(test => ({ ...test, label: `timing-${test.label}` })),
  ...read("SB2-CONVEYOR-CHAIN-CANDIDATE-REPLAY.json").map(test => ({ ...test, label: `candidate-${test.label}` })),
  ...read("SB2-CONVEYOR-CHAIN-CANDIDATE80-REPLAY.json").map(test => ({ ...test, label: `candidate80-${test.label}` })),
  ...read("SB2-CONVEYOR-CHAIN-CANDIDATE105-VERIFIED-REPLAY.json").map(test => ({ ...test, label: `candidate105-${test.label}` })),
  ...read("SB2-CONVEYOR-CHAIN-EXPANSION-REPLAY.json").map(test => ({ ...test, label: `expansion-${test.label}` })),
];
const facings = { 2: "right", 4: "left", 8: "down", 16: "up" } as const;
function tick(s: MatchState, inputs: Record<string, PlayerInput>) {
  const prior = sb2NativeFramesAfterTicks(s.tick);
  do { step(s, inputs); } while (sb2NativeFramesAfterTicks(s.tick) === prior);
}
const tiles = (grid: number[][]) => grid.flatMap(row => row.map(code => (code & 63) === 2 ? Tile.Block
  : [5, 6].includes(code & 63) ? Tile.Wall : Tile.Empty));

describe("bombas nas correias da arena 8 pelo step completo", () => {
  it.each(cases)("reproduz o percurso $label", test => {
    const first = test.samples[0]!;
    let s = createMatch({ stage: "sb2-08", seed: 1, playerIds: ["p1", "p2"], maniacItems: {}, suddenDeath: false });
    for (let index = 0; index < s.players.length; index++) {
      const p = s.players[index]!, native = first.players[index]!;
      p.px = (native.x - 8) * TILE / 16; p.py = (native.y - 24) * TILE / 16;
      if (first.players_full) {
        p.speed = first.players_full[index]!.speed * TILE / 16;
        p.facing = facings[first.players_full[index]!.facing_code as keyof typeof facings];
      }
    }
    s.players[0]!.speed = first.speed * TILE / 16;
    s.players[0]!.facing = facings[first.facing_code as keyof typeof facings];
    s.grid.tiles = tiles(first.grid);
    Object.assign(s.stageState!.sb2!, { counterOffset: first.phase, randomSeed: first.seed, randomWord: first.word });
    if (first.item_bag) s.stageState!.sb2!.itemBag = { slots: [...first.item_bag], seed: first.seed, draws: 0 };
    s.stageState!.sb2!.conveyor = createSb2Stage8Controller();
    s.stageState!.sb2!.conveyor.control = { fast: !!(first.control_word & 1), reversed: !!(first.control_word & 2) };
    for (let index = 1; index < test.samples.length; index++) {
      const sample = test.samples[index]!;
      const dir = sample.buttons.find(button => ["UP", "DOWN", "LEFT", "RIGHT"].includes(button))?.toLowerCase() as PlayerInput["dir"] | undefined;
      const buttons2 = sample.buttons2 ?? [];
      const dir2 = buttons2.find(button => ["UP", "DOWN", "LEFT", "RIGHT"].includes(button))?.toLowerCase() as PlayerInput["dir"] | undefined;
      tick(s, { p1: { dir: dir ?? null, bomb: sample.buttons.includes("A") }, p2: { dir: dir2 ?? null, bomb: buttons2.includes("A") } });
      if (index === 11 || index === 200) s = JSON.parse(JSON.stringify(s));
      const player = s.players[0]!;
      expect({ x: player.px / (TILE / 16) + 8, y: player.py / (TILE / 16) + 24 }, sample.label)
        .toEqual({ x: sample.players[0]!.x, y: sample.players[0]!.y });
      expect(player.alive, sample.label).toBe(sample.players[0]!.state_word < 0x9800);
      expect(player.facing, sample.label).toBe(facings[sample.facing_code as keyof typeof facings]);
      if (sample.players_full) for (let seat = 0; seat < s.players.length; seat++) {
        const actual = s.players[seat]!, expected = sample.players_full[seat]!;
        expect({ x: actual.px / (TILE / 16) + 8, y: actual.py / (TILE / 16) + 24, alive: actual.alive,
          facing: actual.facing }, `${sample.label} seat=${seat}`).toEqual({ x: expected.x, y: expected.y,
          alive: expected.state_word < 0x9800, facing: facings[expected.facing_code as keyof typeof facings] });
      }
      expect(s.grid.tiles, sample.label).toEqual(tiles(sample.grid));
      expect(s.stageState!.sb2!.conveyor!.control, sample.label)
        .toEqual({ fast: !!(sample.control_word & 1), reversed: !!(sample.control_word & 2) });
      expect(s.stageState!.sb2!.randomSeed, sample.label).toBe(sample.seed);
      expect(s.stageState!.sb2!.randomWord, sample.label).toBe(sample.word);
      if (sample.item_bag) expect(s.stageState!.sb2!.itemBag!.slots, sample.label).toEqual(sample.item_bag);
      if (sample.items) {
        const kinds: Record<number, ItemKind> = { 0x1600: ItemKind.Bomb, 0x1602: ItemKind.Fire, 0x1622: ItemKind.Speed,
          0x160a: ItemKind.Skull, 0x1626: ItemKind.Glove, 0x1624: ItemKind.Kick, 0x1606: ItemKind.FullFire,
          0x1628: ItemKind.BombPass, 0x162a: ItemKind.BlockPass };
        expect(s.items.map(item => `${item.x},${item.y}:${item.kind}`).sort(), sample.label)
          .toEqual(sample.items.map(item => `${item.x},${item.y}:${kinds[item.glyph]}`).sort());
      }
      if (sample.first_bombs) {
        expect(s.bombs.length, sample.label).toBe(sample.first_bombs.length);
        for (const expected of sample.first_bombs) {
          const actual = s.bombs.find(b => b.ownerId === `p${expected.seat + 1}`);
          expect(actual, sample.label).toBeDefined();
          if (expected.moving) expect(actual?.sb2Motion && { x: actual.sb2Motion.px / (TILE / 16) + 8,
            y: actual.sb2Motion.py / (TILE / 16) + 24 }, sample.label).toEqual({ x: expected.x, y: expected.y });
          else {
            expect(actual, sample.label).toMatchObject({ x: expected.grid_x, y: expected.grid_y });
            expect(actual?.sb2Motion, sample.label).toBeUndefined();
          }
        }
      } else {
        const present = sample.bomb.table_state === 0x9000 || sample.grid.some(row => row.some(code => (code & 63) === 3));
        expect(s.bombs.length, sample.label).toBe(present ? 1 : 0);
        if (sample.bomb.state_word) {
          const position = s.bombs[0]?.sb2Motion;
          expect(position && { x: position.px / (TILE / 16) + 8, y: position.py / (TILE / 16) + 24 }, sample.label)
            .toEqual({ x: sample.bomb.x, y: sample.bomb.y });
        } else expect(s.bombs[0]?.sb2Motion, sample.label).toBeUndefined();
      }
      const flames = sample.grid.flatMap((row, y) => row.flatMap((code, x) => (code & 63) === 1 ? [`${x},${y}`] : []));
      expect(s.flames.filter(f => !f.block).map(f => `${f.x},${f.y}`).sort(), sample.label).toEqual(flames.sort());
    }
  });
});
