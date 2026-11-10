// Seleciona ensaios candidatos; a saída não constitui evidência do SNES.
import { readFileSync, writeFileSync } from "node:fs";
import { createMatch } from "../../packages/shared/src/arena";
import { step } from "../../packages/shared/src/step";
import { TILE } from "../../packages/shared/src/constants";
import { sb2NativeFramesAfterTicks } from "../../packages/shared/src/sb2-native-clock";
import { Tile, type Direction } from "../../packages/shared/src/state";
const root = new URL("../../", import.meta.url);
const source = JSON.parse(readFileSync(new URL("docs/sb2/SB2-CONVEYOR-MULTIPLAYER-VERIFIED-REPLAY.json", root), "utf8"));
const candidates: unknown[] = [];
let examined = 0;
for (const test of source.cases) for (const exit of [null, "up", "down", "left", "right"] as Direction[]) {
  for (let plant = 65; plant <= 160; plant += 5) {
    examined++;
    const first = test.samples[0];
    const s = createMatch({ stage: "sb2-08", seed: 1, playerIds: ["p1", "p2"], maniacItems: {}, suddenDeath: false });
    s.players.forEach((p, seat) => {
      p.px = (first.players[seat].x - 8) * TILE / 16;
      p.py = (first.players[seat].y - 24) * TILE / 16;
      p.speed = first.players_full[seat].speed * TILE / 16;
      p.facing = ({ 2: "right", 4: "left", 8: "down", 16: "up" } as const)[first.players_full[seat].facing_code as 2 | 4 | 8 | 16];
    });
    s.grid.tiles = first.grid.flatMap((row: number[]) => row.map(c => (c & 63) === 2 ? Tile.Block : [5, 6].includes(c & 63) ? Tile.Wall : Tile.Empty));
    Object.assign(s.stageState!.sb2!, { counterOffset: first.phase, randomSeed: first.seed, randomWord: first.word,
      conveyor: { control: { fast: !!(first.control_word & 1), reversed: !!(first.control_word & 2) }, pending: null, players: {} } });
    let placed = false;
    for (let frame = 1; frame <= 240; frame++) {
      const prior = sb2NativeFramesAfterTicks(s.tick);
      const inputs = { p1: { dir: frame > 53 && frame <= 105 ? exit : null, bomb: frame === 53 },
        p2: { dir: frame <= 26 ? "up" : frame <= 52 ? "left" : null, bomb: frame === plant } } as const;
      const before = s.bombs.find(b => b.ownerId === "p2");
      const beforeFuse = before?.fuse ?? 0;
      do { step(s, inputs); } while (sb2NativeFramesAfterTicks(s.tick) === prior);
      const after = s.bombs.find(b => b.ownerId === "p2");
      if (after) placed = true;
      if (placed && before && !after && beforeFuse > 10) {
        candidates.push({ state: test.label, p1Plant: 53, p1Exit: exit, p1ExitFrames: [54, 105], p2Plant: plant,
          earlyRemovalFrame: frame, previousFuse: beforeFuse, alive: s.players.map(p => p.alive) });
        break;
      }
    }
  }
}
const report = { hypothesis_only: true, method: "Busca no modelo atual, sem modificar RAM ou gameplay; requer replay independente no SNES.", examined, candidates };
writeFileSync(new URL("docs/sb2/SB2-CONVEYOR-CHAIN-CANDIDATES.json", root), JSON.stringify(report, null, 2) + "\n");
console.log({ examined, candidates: candidates.length, first: candidates.slice(0, 3) });
