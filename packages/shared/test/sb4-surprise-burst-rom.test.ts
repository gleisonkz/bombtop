import { describe, expect, it } from "vitest";
import { createMatch } from "../src/arena";
import { updateBombs } from "../src/bombs";
import { beginSurpriseBurst } from "../src/stage-surprise-flames";
import { Floor, Tile } from "../src/state";
import { buildStage } from "../src/stage";

describe("SB4 surprise explosion event order", () => {
  it("marks all 113 non-wall cells as surprise floor, including beneath blocks", () => {
    const layout = buildStage("sb4-06", 15, 13);
    expect(layout.floor.filter(f => f === Floor.Surprise)).toHaveLength(113);
    expect(layout.tiles!.every((tile, index) => tile === Tile.Wall || layout.floor[index] === Floor.Surprise)).toBe(true);
  });
  it("draws the four native ray samples up/right/down/left before emitting any ray", () => {
    const s = createMatch({ stage: "sb4-06", seed: 7, playerIds: ["a", "b"] });
    s.rng = 32307;
    expect(beginSurpriseBurst(s)).toEqual({ up: 12, right: 14, down: 1, left: 11 });
    expect(s.rng).toBe(48163);
  });

  it("replays the measured two arms and thirteen center selections with no extra RNG draws", () => {
    const s = createMatch({ stage: "sb4-06", seed: 7, playerIds: ["a", "b"], blockDensity: 0 });
    s.grid.tiles.fill(Tile.Wall);
    const index = s.grid.width + 2;
    s.grid.tiles[index] = Tile.Empty;
    s.grid.tiles[index - 1] = Tile.Empty;
    s.grid.tiles[index + 1] = Tile.Block;
    s.rng = 32307;
    s.stageState!.surpriseCounter = 69;
    s.bombs.push({ ownerId: "a", x: 2, y: 1, fuse: 0, range: 2, type: "normal", slide: null, offset: 0, air: null, heldBy: null });
    const kinds = [];
    for (let tick = 0; tick <= 24; tick++) {
      s.tick = tick;
      updateBombs(s);
      if (tick % 2 === 0) kinds.push(s.stageState!.surprise![index]!.kind);
    }
    expect(kinds).toEqual(["sticky", "normal", "ice", "normal", "normal", "normal", "normal", "normal", "sticky", "normal", "ice", "normal", "normal"]);
    expect(s.stageState!.surprise![index]!.hits).toBe(13);
    expect(s.stageState!.surprise![index - 1]).toEqual({ kind: "ice", hits: 1 });
    expect(s.stageState!.surprise![index + 1]).toEqual({ kind: "ice", hits: 1 });
    expect(s.stageState!.surpriseCounter).toBe(54);
    expect(s.rng).toBe(39513);
    expect(s.stageState!.surpriseCenters).toEqual([]);
  });

  it("shares samples across long rays instead of drawing per cell", () => {
    const s = createMatch({ stage: "sb4-06", seed: 7, playerIds: ["a", "b"], blockDensity: 0 });
    s.grid.tiles.fill(Tile.Empty);
    s.rng = 32307;
    s.stageState!.surpriseCounter = 100;
    s.bombs.push({ ownerId: "a", x: 7, y: 5, fuse: 0, range: 3, type: "normal", slide: null, offset: 0, air: null, heldBy: null });
    updateBombs(s);
    expect(s.rng).toBe(44777); // Four arm draws plus one center draw, for thirteen cells.
    expect(s.stageState!.surpriseCounter).toBe(87);
    expect(Object.values(s.stageState!.surprise!).reduce((count, floor) => count + floor.hits, 0)).toBe(13);
    const replay = structuredClone(s);
    for (let tick = 1; tick <= 24; tick++) {
      s.tick = replay.tick = tick;
      updateBombs(s); updateBombs(replay);
    }
    expect(s).toEqual(replay);
  });
});
