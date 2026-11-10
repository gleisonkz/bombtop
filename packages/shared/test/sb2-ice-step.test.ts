import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { createMatch } from "../src/arena";
import { TILE } from "../src/constants";
import { sb2NativeFramesAfterTicks } from "../src/sb2-native-clock";
import { step } from "../src/step";
import { Tile, type Direction } from "../src/state";

interface Sample {
  index: number;
  frame: number;
  buttons: string[];
  player: { x: number; y: number; vx: number; vy: number; flags: number };
  grid: number[][];
}
const reference: { cases: Record<string, Sample[]> } = JSON.parse(readFileSync(
  new URL("../../../docs/sb2/SB2-ICE-INPUT-REPLAY.json", import.meta.url), "utf8"));
const tiles = (grid: number[][]) => grid.flatMap(row => row.map(code => {
  const base = code & 63;
  return base === 2 ? Tile.Block : base === 5 || base === 6 ? Tile.Wall : Tile.Empty;
}));

it.each(Object.entries(reference.cases))("reproduz todo o percurso nativo de gelo %s no step", (name, samples) => {
  const initial = samples[0]!;
  let s = createMatch({ stage: "sb2-02", seed: 1, playerIds: ["p1", "p2"], maniacItems: {}, suddenDeath: false });
  s.grid.tiles = tiles(initial.grid);
  s.players[0]!.px = (initial.player.x - 8) * TILE / 16;
  s.players[0]!.py = (initial.player.y - 24) * TILE / 16;
  for (const sample of samples.slice(1)) {
    const dir = sample.buttons.find(button => ["UP", "DOWN", "LEFT", "RIGHT"].includes(button))?.toLowerCase() as Direction | undefined;
    const prior = sb2NativeFramesAfterTicks(s.tick);
    // Omitir P1 ao soltar também precisa conservar a inércia entre passos PAL.
    do { step(s, dir ? { p1: { dir, bomb: false } } : {}); } while (sb2NativeFramesAfterTicks(s.tick) === prior);
    s = JSON.parse(JSON.stringify(s));
    const player = s.players[0]!;
    expect({ x: player.px / (TILE / 16) + 8, y: player.py / (TILE / 16) + 24 }, `${name}: ${sample.index}`)
      .toEqual({ x: sample.player.x, y: sample.player.y });
    expect(s.stageState!.sb2!.ice!.p1, `velocidade ${name}: ${sample.index}`)
      .toEqual({ vx: sample.player.vx || 0, vy: sample.player.vy || 0 });
    expect(player.alive).toBe(sample.player.flags < 0x9800);
    expect(s.grid.tiles).toEqual(tiles(sample.grid));
  }
});
