import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createMatch } from "../src/arena";
import { step } from "../src/step";
import { TILE } from "../src/constants";
import { sb2NativeFramesAfterTicks } from "../src/sb2-native-clock";
import { createSb2Stage8Controller } from "../src/sb2-stage8-controller";
import { Tile, type MatchState, type PlayerInput } from "../src/state";

interface Sample {
  kind: "sample"; label: string; frame: number; phase: number; seed: number; word: number;
  speed: number; control_word: number; grid: number[][];
  facing_code: number;
  players: { x: number; y: number; state_word: number }[];
}
interface Advance { kind: "advance"; frames: number; buttons?: string[] }
interface Case { label: string; events: (Sample | Advance)[] }
const read = (name: string) => JSON.parse(readFileSync(new URL(`../../../docs/sb2/${name}`, import.meta.url), "utf8"));
const cases: Case[] = [...read("SB2-CONVEYOR-MANUAL-REPLAY.json").cases, ...read("SB2-CONVEYOR-CONTROL-REPLAY.json").cases,
  ...read("SB2-CONVEYOR-SEQUENCES-REPLAY.json").cases,
  ...read("SB2-CONVEYOR-UNPLANTED-REPLAY.json").cases];
function tick(s: MatchState, input: PlayerInput) {
  const prior = sb2NativeFramesAfterTicks(s.tick);
  do { step(s, { p1: input }); } while (sb2NativeFramesAfterTicks(s.tick) === prior);
}

describe("correias da arena 8 no step real", () => {
  it.each(cases)("reproduz posição, comandos e RNG do ensaio $label", test => {
    const first = test.events[0] as Sample;
    let s = createMatch({ stage: "sb2-08", seed: 1, playerIds: ["p1", "p2"], maniacItems: {}, suddenDeath: false });
    const p = s.players[0]!;
    p.px = (first.players[0]!.x - 8) * TILE / 16;
    p.py = (first.players[0]!.y - 24) * TILE / 16;
    p.speed = first.speed * TILE / 16;
    p.facing = ({ 2: "right", 4: "left", 8: "down", 16: "up" } as const)[first.facing_code as 2 | 4 | 8 | 16];
    s.grid.tiles = first.grid.flatMap(row => row.map(code => {
      const value = code & 63;
      return value === 2 ? Tile.Block : value === 5 || value === 6 ? Tile.Wall : Tile.Empty;
    }));
    Object.assign(s.stageState!.sb2!, { counterOffset: first.phase, randomSeed: first.seed, randomWord: first.word });
    const initial = s.stageState!.sb2!.conveyor = createSb2Stage8Controller();
    initial.control = { fast: (first.control_word & 1) !== 0, reversed: (first.control_word & 2) !== 0 };
    let nativeFrames = 0;
    for (const event of test.events) {
      if (event.kind === "advance") {
        const buttons = event.buttons ?? [];
        const dir = buttons.find(value => ["UP", "DOWN", "LEFT", "RIGHT"].includes(value))?.toLowerCase() as PlayerInput["dir"] | undefined;
        for (let frame = 0; frame < event.frames; frame++) {
          tick(s, { dir: dir ?? null, bomb: buttons.includes("A") });
          if (++nativeFrames === 11) s = JSON.parse(JSON.stringify(s));
        }
        continue;
      }
      const player = s.players[0]!, runtime = s.stageState!.sb2!;
      expect({ x: player.px / (TILE / 16) + 8, y: player.py / (TILE / 16) + 24 }, event.label)
        .toEqual({ x: event.players[0]!.x, y: event.players[0]!.y });
      expect(player.facing, event.label).toBe(({ 2: "right", 4: "left", 8: "down", 16: "up" } as const)[event.facing_code as 2 | 4 | 8 | 16]);
      expect(runtime.conveyor!.control, event.label).toEqual({ fast: (event.control_word & 1) !== 0, reversed: (event.control_word & 2) !== 0 });
      expect(runtime.randomSeed, event.label).toBe(event.seed);
      expect(runtime.randomWord, event.label).toBe(event.word);
    }
  });
});
