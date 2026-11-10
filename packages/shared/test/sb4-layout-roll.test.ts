import { describe, expect, it } from "vitest";
import { createMatch } from "../src/arena";
import { buildStage } from "../src/stage";
import { Floor, Tile } from "../src/state";

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
  { stage: "sb4-02", holes: 14, blocks: { 2: 93, 5: 80 } },
  { stage: "sb4-03", holes: 12, blocks: { 2: 93, 5: 80 } },
  { stage: "sb4-04", holes: 4, blocks: { 2: 83, 5: 70 } },
  { stage: "sb4-06", holes: 14, blocks: { 2: 93, 5: 80 } },
  { stage: "sb4-07", holes: 4, blocks: { 2: 75, 5: 62 } },
  { stage: "sb4-09", holes: 4, blocks: { 2: 91, 3: 88, 4: 85, 5: 78 } },
  { stage: "sb4-10", holes: 14, blocks: { 2: 93, 5: 80 } },
  { stage: "sb4-11", holes: 16, blocks: { 2: 77, 5: 68 } },
  { stage: "sb4-12", holes: 14, blocks: { 2: 90, 5: 80 } },
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
    const kept = [...CLEARS[2], ...CLEARS[3]].filter(([x, y]) => layout.keepClear.has(y * 15 + x)).length;
    expect(filled).toBeGreaterThan(20 * (6 - kept) * 0.8);
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

describe("SB4 stage 4 (Push and Fall)", () => {
  it("has its pits where the original has them: two rows deep at the top, bottom and sides", () => {
    const layout = buildStage("sb4-04", 15, 13);
    const pits = new Set<string>();
    for (let index = 0; index < 195; index++) if (layout.floor![index] === Floor.Pit) pits.add(`${index % 15},${Math.floor(index / 15)}`);
    const expected = new Set<string>();
    for (const y of [1, 2, 10, 11]) for (const x of [6, 7, 8]) expected.add(`${x},${y}`);
    for (const y of [5, 6]) for (const x of [1, 2, 3, 4, 10, 11, 12, 13]) expected.add(`${x},${y}`);
    expect([...pits].sort()).toEqual([...expected].sort());
  });
});

describe("SB4 stage 7 (Ambush)", () => {
  const cells = (layout: ReturnType<typeof buildStage>, floor: Floor) => {
    const out: string[] = [];
    for (let index = 0; index < 195; index++) if (layout.floor![index] === floor) out.push(`${index % 15},${Math.floor(index / 15)}`);
    return out.sort();
  };

  it("has its foliage where the original has it, over its paths and the pillars among them", () => {
    const layout = buildStage("sb4-07", 15, 13);
    const expected: string[] = [];
    const add = (xs: number[], ys: number[]) => { for (const y of ys) for (const x of xs) expected.push(`${x},${y}`); };
    add([6, 7, 8], [2, 3, 8, 9]);
    add([7], [4, 10]);
    add([2, 4, 10, 12], [4]);
    add([2, 3, 4, 10, 11, 12], [5, 6, 7]);
    expect(cells(layout, Floor.Foliage)).toEqual(expected.sort());
    for (const [x, y] of [[6, 2], [8, 2], [6, 8], [8, 8], [2, 4], [4, 4], [2, 6], [4, 6], [10, 4], [12, 4], [10, 6], [12, 6]]) {
      expect(layout.tiles![y! * 15 + x!], `${x},${y}`).toBe(Tile.Wall);
    }
  });

  it("has its four arrows going round clockwise", () => {
    const layout = buildStage("sb4-07", 15, 13);
    expect(cells(layout, Floor.ConveyorRight)).toEqual(["3,3"]);
    expect(cells(layout, Floor.ConveyorDown)).toEqual(["11,3"]);
    expect(cells(layout, Floor.ConveyorLeft)).toEqual(["11,9"]);
    expect(cells(layout, Floor.ConveyorUp)).toEqual(["3,9"]);
  });
});

describe("SB4 stages 11 (Trolley) and 12 (Flag Tag)", () => {
  const open = (stage: "sb4-11" | "sb4-12") => {
    const layout = buildStage(stage, 15, 13);
    return [...layout.keepClear].map(index => `${index % 15},${Math.floor(index / 15)}`).sort();
  };

  it("keeps the cross round each of the trolley's three stations open, as the original", () => {
    const expected: string[] = [];
    for (const [x, y] of [[7, 5], [11, 7], [7, 11]]) {
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if (y! + dy! <= 11) expected.push(`${x! + dx!},${y! + dy!}`);
    }
    expect(open("sb4-11")).toEqual(expected.sort());
  });

  it("keeps each seat's flag post open, a seat in play or not", () => {
    expect(open("sb4-12")).toEqual(["12,1", "12,11", "2,1", "2,11", "7,7"]);
  });
});
