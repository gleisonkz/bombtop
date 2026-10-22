import { describe, expect, it } from "vitest";
import {
  createMatch,
  FLAME_TICKS,
  FUSE_TICKS,
  getTile,
  hasFlame,
  placeBomb,
  placePlayerAt,
  setTile,
  step,
  Tile,
  type MatchState,
} from "../src";

function emptyMatch(ids = ["p1", "p2"]): MatchState {
  return createMatch({ seed: 1, playerIds: ids, blockDensity: 0 });
}

function moveTo(s: MatchState, id: string, x: number, y: number) {
  placePlayerAt(s, id, x, y);
}

function run(s: MatchState, ticks: number) {
  for (let i = 0; i < ticks; i++) step(s);
}

describe("placing bombs", () => {
  it("places a bomb on the player's tile", () => {
    const s = emptyMatch();
    moveTo(s, "p1", 3, 3);
    expect(placeBomb(s, "p1")).toBe(true);
    expect(s.bombs).toEqual([
      expect.objectContaining({ ownerId: "p1", x: 3, y: 3, fuse: FUSE_TICKS, range: 1 }),
    ]);
  });

  it("does not stack two bombs on the same tile", () => {
    const s = emptyMatch();
    s.players[0]!.bombCapacity = 3;
    moveTo(s, "p1", 3, 3);
    placeBomb(s, "p1");
    expect(placeBomb(s, "p1")).toBe(false);
    expect(s.bombs).toHaveLength(1);
  });

  it("respects bomb capacity", () => {
    const s = emptyMatch();
    moveTo(s, "p1", 3, 3);
    placeBomb(s, "p1");
    moveTo(s, "p1", 5, 3);
    expect(placeBomb(s, "p1")).toBe(false);
  });

  it("uses the player's current fire range", () => {
    const s = emptyMatch();
    s.players[0]!.fireRange = 4;
    moveTo(s, "p1", 3, 3);
    placeBomb(s, "p1");
    expect(s.bombs[0]!.range).toBe(4);
  });

  it("dead players cannot place bombs", () => {
    const s = emptyMatch();
    s.players[0]!.alive = false;
    expect(placeBomb(s, "p1")).toBe(false);
  });
});

describe("explosions", () => {
  it("detonates remote bombs with flames after three seconds", () => {
    const s = emptyMatch();
    s.players[0]!.bombType = "remote";
    moveTo(s, "p1", 5, 5);
    expect(placeBomb(s, "p1")).toBe(true);
    moveTo(s, "p1", 1, 1);
    run(s, FUSE_TICKS - 1);
    expect(s.bombs).toHaveLength(1);
    expect(s.bombs[0]!.fuse).toBe(1);
    step(s);
    expect(s.bombs).toHaveLength(0);
    for (const [x, y] of [[5, 5], [4, 5], [6, 5], [5, 4], [5, 6]]) {
      expect(hasFlame(s, x!, y!)).toBe(true);
    }
  });
  it("explodes when the fuse runs out", () => {
    const s = emptyMatch();
    moveTo(s, "p1", 5, 5);
    placeBomb(s, "p1");
    moveTo(s, "p1", 1, 1);
    run(s, FUSE_TICKS - 1);
    expect(s.bombs).toHaveLength(1);
    step(s);
    expect(s.bombs).toHaveLength(0);
    expect(hasFlame(s, 5, 5)).toBe(true);
  });

  it("spreads flames in a cross up to the bomb range", () => {
    const s = emptyMatch();
    s.players[0]!.fireRange = 2;
    moveTo(s, "p1", 5, 5);
    placeBomb(s, "p1");
    moveTo(s, "p1", 1, 1);
    run(s, FUSE_TICKS);
    for (const [x, y] of [[5, 5], [6, 5], [7, 5], [4, 5], [3, 5], [5, 3], [5, 7]]) {
      expect(hasFlame(s, x!, y!), `flame at ${x},${y}`).toBe(true);
    }
    expect(hasFlame(s, 8, 5)).toBe(false);
    expect(hasFlame(s, 6, 6)).toBe(false);
  });

  it("is stopped by walls", () => {
    const s = emptyMatch();
    s.players[0]!.fireRange = 3;
    moveTo(s, "p1", 3, 2); // pillars at (2,2) and (4,2)
    placeBomb(s, "p1");
    moveTo(s, "p1", 1, 1);
    run(s, FUSE_TICKS);
    expect(hasFlame(s, 2, 2)).toBe(false);
    expect(hasFlame(s, 1, 2)).toBe(false);
    expect(hasFlame(s, 3, 1)).toBe(true);
    expect(hasFlame(s, 3, 3)).toBe(true);
  });

  it("destroys the first block it hits and stops there", () => {
    const s = emptyMatch();
    s.players[0]!.fireRange = 5;
    setTile(s, 7, 5, Tile.Block);
    setTile(s, 8, 5, Tile.Block);
    moveTo(s, "p1", 5, 5);
    placeBomb(s, "p1");
    moveTo(s, "p1", 1, 1);
    run(s, FUSE_TICKS);
    expect(getTile(s, 7, 5)).toBe(Tile.Empty);
    expect(getTile(s, 8, 5)).toBe(Tile.Block);
    expect(hasFlame(s, 8, 5)).toBe(false);
  });

  it("detonates other bombs caught in the flames (chain reaction)", () => {
    const s = emptyMatch();
    s.players[0]!.bombCapacity = 2;
    s.players[0]!.fireRange = 2;
    moveTo(s, "p1", 5, 5);
    placeBomb(s, "p1");
    run(s, 10);
    moveTo(s, "p1", 7, 5);
    placeBomb(s, "p1");
    moveTo(s, "p1", 1, 1);
    run(s, FUSE_TICKS - 10);
    expect(s.bombs).toHaveLength(0);
    expect(hasFlame(s, 9, 5)).toBe(true);
  });

  it("kills players standing in flames", () => {
    const s = emptyMatch();
    moveTo(s, "p1", 5, 5);
    placeBomb(s, "p1");
    moveTo(s, "p1", 1, 1);
    moveTo(s, "p2", 6, 5);
    run(s, FUSE_TICKS);
    expect(s.players[1]!.alive).toBe(false);
    expect(s.players[0]!.alive).toBe(true);
  });

  it("kills players who walk into lingering flames", () => {
    const s = emptyMatch();
    moveTo(s, "p1", 5, 5);
    placeBomb(s, "p1");
    moveTo(s, "p1", 1, 1);
    run(s, FUSE_TICKS);
    moveTo(s, "p2", 6, 5);
    step(s);
    expect(s.players[1]!.alive).toBe(false);
  });

  it("flames disappear after FLAME_TICKS", () => {
    const s = emptyMatch();
    moveTo(s, "p1", 5, 5);
    placeBomb(s, "p1");
    moveTo(s, "p1", 1, 1);
    run(s, FUSE_TICKS + FLAME_TICKS);
    expect(s.flames).toHaveLength(0);
  });

  it("returns bomb capacity to the owner after exploding", () => {
    const s = emptyMatch();
    moveTo(s, "p1", 5, 5);
    placeBomb(s, "p1");
    moveTo(s, "p1", 1, 1);
    run(s, FUSE_TICKS);
    moveTo(s, "p1", 3, 3);
    expect(placeBomb(s, "p1")).toBe(true);
  });
});
