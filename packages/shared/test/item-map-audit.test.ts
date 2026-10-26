import { describe, expect, it } from "vitest";
import {
  BASE_SPEED,
  createMatch,
  Floor,
  ITEM_WEIGHTS,
  ItemKind,
  MAX_BOMB_CAPACITY,
  MAX_FIRE_RANGE,
  MAX_SPEED,
  MOUNTS,
  STAGES,
  step,
  TILE,
  Tile,
  type MatchState,
} from "../src";

const ids = ["p1", "p2", "p3", "p4", "p5"];
const densities = [0, 0.3, 0.75, 1] as const;

const classicCounts: Partial<Record<ItemKind, number>> = {
  [ItemKind.Bomb]: 8,
  [ItemKind.Fire]: 5,
  [ItemKind.Speed]: 3,
  [ItemKind.Egg]: 2,
  [ItemKind.Glove]: 2,
  [ItemKind.Punch]: 2,
  [ItemKind.Push]: 2,
  [ItemKind.Kick]: 3,
  [ItemKind.Skull]: 1,
};

function histogram(items: MatchState["items"]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) counts[item.kind] = (counts[item.kind] ?? 0) + 1;
  return counts;
}

describe("item generation audit per stage", () => {
  for (const stage of STAGES) {
    describe(stage, () => {
      for (const blockDensity of densities) {
        it(`keeps item placement valid and reproducible at density ${blockDensity}`, () => {
          for (let seed = 0; seed < 128; seed++) {
            const opts = { stage, blockDensity, seed, playerIds: ids };
            const a = createMatch(opts);
            const b = createMatch(opts);
            expect(a.grid).toEqual(b.grid);
            expect(a.items).toEqual(b.items);
            const blocks = a.grid.tiles.filter((tile) => tile === Tile.Block).length;
            expect(a.items.length).toBeLessThanOrEqual(blocks);
            expect(new Set(a.items.map(({ x, y }) => `${x},${y}`)).size).toBe(a.items.length);
            for (const item of a.items) {
              const index = item.y * a.grid.width + item.x;
              expect(a.grid.tiles[index]).toBe(Tile.Block);
              expect(a.grid.floor[index]).toBe(Floor.Normal);
              expect(item.kind).not.toBe(ItemKind.Picanha);
            }
            for (const player of a.players) {
              const index = Math.floor(player.py / TILE) * a.grid.width + Math.floor(player.px / TILE);
              expect(a.grid.tiles[index]).toBe(Tile.Empty);
            }
            if (blockDensity === 0) expect(a.items).toHaveLength(0);
          }
        });
      }
    });
  }

  it("preserves the 28-item classic distribution at full density", () => {
    for (let seed = 0; seed < 128; seed++) {
      const arena = createMatch({ stage: "classic", seed, playerIds: ids, blockDensity: 1 });
      expect(histogram(arena.items)).toEqual(classicCounts);
      expect(arena.items).toHaveLength(28);
    }
  });

  it.each(["conveyor", "warp"] as const)("keeps all positive-weight item kinds reachable on %s", (stage) => {
    const found = new Set<ItemKind>();
    for (let seed = 0; seed < 256; seed++) {
      for (const item of createMatch({ stage, seed, playerIds: ids }).items) found.add(item.kind);
    }
    const expected = Object.entries(ITEM_WEIGHTS).filter(([, weight]) => weight > 0).map(([kind]) => kind);
    expect(found).toEqual(new Set(expected));
  });

  it("does not change a seeded map or its hidden items when the number of players changes", () => {
    for (const stage of STAGES) {
      for (const seed of [0, 1, 20, 64, 72, 255]) {
        const duel = createMatch({ stage, seed, playerIds: ids.slice(0, 2) });
        const full = createMatch({ stage, seed, playerIds: ids });
        expect(duel.grid).toEqual(full.grid);
        expect(duel.items).toEqual(full.items);
      }
    }
  });
});

describe("all item effects", () => {
  const pick = (kind: ItemKind): MatchState => {
    const match = createMatch({ seed: 64, playerIds: ["p1", "p2"], blockDensity: 0 });
    match.items.push({ x: 1, y: 1, kind });
    step(match);
    return match;
  };

  const cases: Array<[ItemKind, (match: MatchState) => boolean]> = [
    [ItemKind.Bomb, (m) => m.players[0]!.bombCapacity === 2],
    [ItemKind.Fire, (m) => m.players[0]!.fireRange === 2],
    [ItemKind.FullFire, (m) => m.players[0]!.fireRange === MAX_FIRE_RANGE],
    [ItemKind.Speed, (m) => m.players[0]!.speed > BASE_SPEED && m.players[0]!.speed <= MAX_SPEED],
    [ItemKind.Kick, (m) => m.players[0]!.canKick],
    [ItemKind.Punch, (m) => m.players[0]!.canPunch],
    [ItemKind.Push, (m) => m.players[0]!.canPush === true],
    [ItemKind.Glove, (m) => m.players[0]!.canGlove],
    [ItemKind.Remote, (m) => m.players[0]!.bombType === "remote"],
    [ItemKind.Pierce, (m) => m.players[0]!.bombType === "pierce"],
    [ItemKind.Skull, (m) => m.players[0]!.curse !== null],
    [ItemKind.Egg, (m) => MOUNTS.includes(m.players[0]!.mount!)],
    [ItemKind.Picanha, (m) => m.players[0]!.stun > 0],
  ];

  it.each(cases)("applies and consumes %s", (kind, effect) => {
    const match = pick(kind);
    expect(effect(match)).toBe(true);
    expect(match.items).toHaveLength(0);
    expect(match.players[0]!.bombCapacity).toBeLessThanOrEqual(MAX_BOMB_CAPACITY);
  });
});
