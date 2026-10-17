import { describe, expect, it } from "vitest";
import {
  BASE_SPEED,
  createMatch,
  FLAME_TICKS,
  FUSE_TICKS,
  getTile,
  hasFlame,
  ItemKind,
  MAX_BOMB_CAPACITY,
  MAX_FIRE_RANGE,
  MAX_SPEED,
  placeBomb,
  placePlayerAt,
  setTile,
  SPEED_STEP,
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

  it("produces every power-up kind", () => {
    const kinds = new Set<ItemKind>();
    for (let seed = 1; seed <= 200; seed++) {
      for (const i of createMatch({ seed, playerIds: ids }).items) kinds.add(i.kind);
    }
    expect(kinds).toEqual(new Set(Object.values(ItemKind)));
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

describe("picking up items", () => {
  function pickup(kind: ItemKind, times = 1): MatchState {
    const s = emptyMatch();
    placePlayerAt(s, "p1", 3, 3);
    for (let i = 0; i < times; i++) {
      s.items.push({ x: 3, y: 3, kind });
      step(s);
    }
    return s;
  }

  it("fire increases the fire range", () => {
    const s = pickup(ItemKind.Fire);
    expect(s.players[0]!.fireRange).toBe(2);
    expect(s.items).toEqual([]);
  });

  it("bomb increases the bomb capacity", () => {
    expect(pickup(ItemKind.Bomb).players[0]!.bombCapacity).toBe(2);
  });

  it("speed increases the movement speed", () => {
    expect(pickup(ItemKind.Speed).players[0]!.speed).toBe(BASE_SPEED + SPEED_STEP);
  });

  it("caps every stat", () => {
    expect(pickup(ItemKind.Fire, 20).players[0]!.fireRange).toBe(MAX_FIRE_RANGE);
    expect(pickup(ItemKind.Bomb, 20).players[0]!.bombCapacity).toBe(MAX_BOMB_CAPACITY);
    expect(pickup(ItemKind.Speed, 20).players[0]!.speed).toBe(MAX_SPEED);
  });

  it("is picked up by walking onto it", () => {
    const s = emptyMatch();
    s.items.push({ x: 3, y: 1, kind: ItemKind.Fire });
    placePlayerAt(s, "p1", 1, 1);
    for (let i = 0; i < 40; i++) step(s, { p1: { dir: "right", bomb: false } });
    expect(s.players[0]!.fireRange).toBe(2);
  });

  it("is not picked up by dead players", () => {
    const s = emptyMatch();
    s.players[0]!.alive = false;
    placePlayerAt(s, "p1", 3, 3);
    s.items.push({ x: 3, y: 3, kind: ItemKind.Fire });
    step(s);
    expect(s.items).toHaveLength(1);
  });

  it("cannot be picked up while still hidden under a block", () => {
    const s = emptyMatch();
    setTile(s, 3, 3, Tile.Block);
    s.items.push({ x: 3, y: 3, kind: ItemKind.Fire });
    placePlayerAt(s, "p1", 3, 3);
    step(s);
    expect(s.items).toHaveLength(1);
  });
});

describe("burning items", () => {
  it("destroys an exposed item caught in an explosion and stops the flame there", () => {
    const s = emptyMatch();
    s.players[0]!.fireRange = 4;
    s.items.push({ x: 7, y: 5, kind: ItemKind.Bomb });
    placePlayerAt(s, "p1", 5, 5);
    placeBomb(s, "p1");
    placePlayerAt(s, "p1", 1, 1);
    run(s, FUSE_TICKS);
    expect(s.items).toEqual([]);
    expect(hasFlame(s, 7, 5)).toBe(true);
    expect(hasFlame(s, 8, 5)).toBe(false);
  });

  it("does not burn the item revealed by the same explosion, even as flames linger", () => {
    const s = emptyMatch();
    setTile(s, 6, 5, Tile.Block);
    s.items.push({ x: 6, y: 5, kind: ItemKind.Speed });
    placePlayerAt(s, "p1", 5, 5);
    placeBomb(s, "p1");
    placePlayerAt(s, "p1", 1, 1);
    run(s, FUSE_TICKS + FLAME_TICKS);
    expect(s.items).toHaveLength(1);
  });
});
