import { describe, expect, it } from "vitest";
import {
  createMatch,
  FUSE_TICKS,
  getTile,
  ItemKind,
  placeBomb,
  placePlayerAt,
  setTile,
  step,
  Tile,
  type MatchState,
} from "../src";

const ids = ["p1", "p2", "p3", "p4", "p5"];

function emptyMatch(): MatchState {
  return createMatch({ seed: 1, playerIds: ["p1", "p2"], blockDensity: 0 });
}

function run(s: MatchState, ticks: number) {
  for (let i = 0; i < ticks; i++) step(s);
}

describe("item generation", () => {
  it("hides items only under blocks", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = createMatch({ seed, playerIds: ids });
      expect(s.items.length).toBeGreaterThan(0);
      for (const item of s.items) {
        expect(getTile(s, item.x, item.y)).toBe(Tile.Block);
      }
    }
  });

  it("never puts two items on the same tile", () => {
    const s = createMatch({ seed: 7, playerIds: ids, blockDensity: 1 });
    const keys = s.items.map((i) => `${i.x},${i.y}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("generates items deterministically by seed", () => {
    const a = createMatch({ seed: 42, playerIds: ids });
    const b = createMatch({ seed: 42, playerIds: ids });
    const c = createMatch({ seed: 43, playerIds: ids });
    expect(a.items).toEqual(b.items);
    expect(a.items).not.toEqual(c.items);
  });

  it("produces every basic power-up kind", () => {
    const kinds = new Set<ItemKind>();
    for (let seed = 1; seed <= 20; seed++) {
      for (const i of createMatch({ seed, playerIds: ids }).items) kinds.add(i.kind);
    }
    expect(kinds).toEqual(new Set([ItemKind.Fire, ItemKind.Bomb, ItemKind.Speed]));
  });

  it("has no items in an arena without blocks", () => {
    expect(emptyMatch().items).toEqual([]);
  });
});

describe("revealing items", () => {
  it("keeps the item when the block above it is destroyed", () => {
    const s = emptyMatch();
    setTile(s, 6, 5, Tile.Block);
    s.items.push({ x: 6, y: 5, kind: ItemKind.Fire });
    placePlayerAt(s, "p1", 5, 5);
    placeBomb(s, "p1");
    placePlayerAt(s, "p1", 1, 1);
    run(s, FUSE_TICKS);
    expect(getTile(s, 6, 5)).toBe(Tile.Empty);
    expect(s.items).toEqual([{ x: 6, y: 5, kind: ItemKind.Fire }]);
  });
});
