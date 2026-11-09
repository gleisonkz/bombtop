import { describe, expect, it } from "vitest";
import { createMatch } from "../src/arena";
import { buildStage } from "../src/stage";
import { Tile } from "../src/state";

// Measured on Super Bomberman 4 in Snes9x (E:/Projetos/bombtop-src/sb4-evidence/layout): every cell that is not a wall
// or a gimmick starts as a block, only the seats in play are cleared, then a few random blocks are taken out.
const CLEARS = [
  [[1, 1], [2, 1], [1, 2]],
  [[13, 11], [12, 11], [13, 10]],
  [[13, 1], [12, 1], [13, 2]],
  [[1, 11], [2, 11], [1, 10]],
  [[7, 6], [6, 5], [7, 5], [8, 5], [6, 7], [7, 7], [8, 7]],
] as const;
const ids = ["p1", "p2", "p3", "p4", "p5"];

describe.each([
  { stage: "sb4-01", holes: 14, blocks: { 2: 93, 5: 80 } },
  { stage: "sb4-09", holes: 4, blocks: { 2: 91, 3: 88, 4: 85, 5: 78 } },
] as const)("SB4 rolled layout of $stage", ({ stage, holes, blocks }) => {
  const layout = buildStage(stage, 15, 13);

  it.each(Object.entries(blocks))("with %s players: blocks everywhere but the seats in play and the random holes", (players, count) => {
    const n = Number(players);
    for (const seed of [0, 1, 7, 42, 1234, 99999]) {
      const s = createMatch({ stage, seed, playerIds: ids.slice(0, n) });
      expect(s.grid.tiles.filter(tile => tile === Tile.Block), `seed ${seed}`).toHaveLength(count);
      const cleared = new Set(CLEARS.slice(0, n).flat().map(([x, y]) => y * 15 + x));
      for (const index of cleared) expect(s.grid.tiles[index]).toBe(Tile.Empty);
      const opened = s.grid.tiles.filter((tile, index) => tile === Tile.Empty && !cleared.has(index) && !layout.keepClear.has(index));
      expect(opened, `seed ${seed}`).toHaveLength(holes);
      for (let index = 0; index < 195; index++) {
        if (layout.tiles![index] === Tile.Wall) expect(s.grid.tiles[index]).toBe(Tile.Wall);
        if (layout.keepClear.has(index)) expect(s.grid.tiles[index]).toBe(Tile.Empty);
      }
    }
  });

  it("keeps an absent seat's corner full of blocks, apart from a hole landing there", () => {
    let filled = 0;
    for (let seed = 0; seed < 20; seed++) {
      const s = createMatch({ stage, seed, playerIds: ["p1", "p2"] });
      filled += [...CLEARS[2], ...CLEARS[3]].filter(([x, y]) => s.grid.tiles[y * 15 + x] === Tile.Block).length;
    }
    expect(filled).toBeGreaterThan(20 * 6 * 0.8);
  });

  it("rolls a new layout for each round's seed, the same for the same seed", () => {
    const a = createMatch({ stage, seed: 5, playerIds: ["p1", "p2"] });
    expect(createMatch({ stage, seed: 5, playerIds: ["p1", "p2"] }).grid).toEqual(a.grid);
    expect(createMatch({ stage, seed: 6, playerIds: ["p1", "p2"] }).grid.tiles).not.toEqual(a.grid.tiles);
  });

  it("hides the stage's items under its blocks", () => {
    const s = createMatch({ stage, seed: 3, playerIds: ["p1", "p2"] });
    expect(s.items.length).toBeGreaterThan(0);
    for (const item of s.items) expect(s.grid.tiles[item.y * 15 + item.x]).toBe(Tile.Block);
  });
});
