import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { createMatch } from "../src/arena";
import { TILE } from "../src/constants";
import { sb2NativeFramesAfterTicks } from "../src/sb2-native-clock";
import { step } from "../src/step";
import { Tile } from "../src/state";

interface Sample { index: number; phase: number; seed: number; word: number;
  random_history: number[]; item_bag: number[]; buttons: string[]; grid: number[][];
  players: { x: number; y: number; state_word: number }[] }
const replay: { cases: Record<string, Sample[]> } = JSON.parse(readFileSync(
  new URL("../../../docs/sb2/SB2-STAGE12-SPRING-FIRE-CLASSIFIED-REPLAY.json", import.meta.url), "utf8"));

// Verifica a regra de dano; o replay estrito separado mantem a divergencia
// conhecida da grade/animacao do piso12 e nao e substituido por este teste.
it.each(Object.entries(replay.cases))("confere vida durante preparo,voo e pouso: %s", (_name, samples) => {
  const first = samples[0]!;
  let s = createMatch({ stage: "sb2-12", seed: 1, playerIds: ["p1", "p2"], maniacItems: {}, suddenDeath: false });
  s.grid.tiles = first.grid.flatMap(row => row.map(code => (code & 63) === 2 ? Tile.Block
    : [5, 6].includes(code & 63) ? Tile.Wall : Tile.Empty));
  Object.assign(s.stageState!.sb2!, { counterOffset: first.phase, randomSeed: first.seed, randomWord: first.word,
    randomHistory: [...first.random_history], itemBag: { slots: [...first.item_bag], seed: first.seed, draws: 0 } });
  s.players.forEach((player, seat) => {
    player.px = (first.players[seat]!.x - 8) * TILE / 16;
    player.py = (first.players[seat]!.y - 24) * TILE / 16;
    if (seat === 0) player.fireRange = 3;
  });
  for (const sample of samples.slice(1)) {
    const dir = (["up", "down", "left", "right"] as const)
      .find(direction => sample.buttons.includes(direction.toUpperCase())) ?? null;
    const before = sb2NativeFramesAfterTicks(s.tick);
    do { step(s, { p1: { dir, bomb: sample.buttons.includes("A") }, p2: { dir: null, bomb: false } }); }
    while (sb2NativeFramesAfterTicks(s.tick) === before);
    s = JSON.parse(JSON.stringify(s));
    expect(s.players.map(player => player.alive), `vida ${sample.index}`)
      .toEqual(sample.players.map(player => player.state_word < 0x9800));
    expect(s.players[0]!.fireRange).toBe(3);
  }
});
