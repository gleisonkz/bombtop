import { describe, expect, it } from "vitest";
import { createMatch, hurt, ItemKind, MANIAC_ITEM_KINDS, MAX_MANIAC_ITEMS, normalizeManiac, Tile } from "../src";

describe("Super Bomberman 4 Maniac preset", () => {
  it("provides the original set of fifteen selectable power-up kinds", () => {
    expect(MANIAC_ITEM_KINDS).toEqual([
      ItemKind.Bomb, ItemKind.Fire, ItemKind.FullFire, ItemKind.Speed, ItemKind.Egg,
      ItemKind.Glove, ItemKind.Punch, ItemKind.Push, ItemKind.Kick, ItemKind.BombPass,
      ItemKind.BlockPass, ItemKind.Pierce, ItemKind.FireSuit, ItemKind.Heart, ItemKind.Skull,
    ]);
    expect(MANIAC_ITEM_KINDS).not.toContain(ItemKind.Remote);
    expect(MANIAC_ITEM_KINDS).not.toContain(ItemKind.Picanha);
  });

  it("validates each count between zero and nine, the total of sixty and player HP between one and five", () => {
    const members = ["p1", "p2"];
    expect(normalizeManiac({ items: { [ItemKind.Bomb]: 9, [ItemKind.Fire]: 9 }, hitPoints: { p1: 5 } }, members)).toMatchObject({
      items: { [ItemKind.Bomb]: 9, [ItemKind.Fire]: 9 }, hitPoints: { p1: 5, p2: 1 },
    });
    expect(MAX_MANIAC_ITEMS).toBe(60);
    for (const bad of [
      { items: { [ItemKind.Bomb]: 10 } },
      { items: { [ItemKind.Bomb]: -1 } },
      { items: { [ItemKind.Bomb]: 1.5 } },
      { items: { [ItemKind.Remote]: 1 } },
      { items: { [ItemKind.Picanha]: 1 } },
      { items: Object.fromEntries(MANIAC_ITEM_KINDS.map((kind) => [kind, 9])) },
      { items: { [ItemKind.Bomb]: "2" } },
      { items: { [ItemKind.Bomb]: 2 }, hitPoints: { p1: 0 } },
      { items: { [ItemKind.Bomb]: 2 }, hitPoints: { p1: 6 } },
      { items: { [ItemKind.Bomb]: 2 }, hitPoints: { unknown: 2 } },
    ]) {
      expect(normalizeManiac(bad, members), JSON.stringify(bad)).toBeNull();
    }
  });

  it("generates exactly the requested inventory under blocks, reproducibly by seed", () => {
    const items = { [ItemKind.Bomb]: 9, [ItemKind.Fire]: 9, [ItemKind.Speed]: 9, [ItemKind.Heart]: 9, [ItemKind.FireSuit]: 9, [ItemKind.BombPass]: 9, [ItemKind.BlockPass]: 6 };
    const opts = { seed: 64, playerIds: ["a", "b", "c", "d", "e"], blockDensity: 1, maniacItems: items };
    const a = createMatch(opts);
    const b = createMatch(opts);
    expect(a.items).toEqual(b.items);
    expect(a.items).toHaveLength(60);
    expect(new Set(a.items.map((item) => `${item.x},${item.y}`)).size).toBe(60);
    const distribution = Object.fromEntries(MANIAC_ITEM_KINDS.map((kind) => [kind, a.items.filter((item) => item.kind === kind).length]));
    for (const [kind, count] of Object.entries(items)) expect(distribution[kind]).toBe(count);
    for (const item of a.items) expect(a.grid.tiles[item.y * a.grid.width + item.x]).toBe(Tile.Block);
    const { maniacItems: _items, ...normalOpts } = opts;
    expect(createMatch(normalOpts).items).not.toEqual(a.items);
  });

  it("gives independently configured health to players without changing standard matches", () => {
    const s = createMatch({ seed: 1, playerIds: ["p1", "p2"], blockDensity: 0, startingHitPoints: { p1: 3, p2: 5 } });
    expect(s.players.map((p) => p.hitPoints)).toEqual([3, 5]);
    const p = s.players[0]!;
    expect(hurt(p)).toBe(false);
    expect(p.hitPoints).toBe(2);
    expect(p.alive).toBe(true);
    p.invuln = 0;
    expect(hurt(p)).toBe(false);
    expect(p.hitPoints).toBe(1);
    p.invuln = 0;
    expect(hurt(p)).toBe(true);
    expect(p.alive).toBe(false);
    const normal = createMatch({ seed: 1, playerIds: ["p1", "p2"], blockDensity: 0 });
    expect(normal.players.map((one) => one.hitPoints)).toEqual([undefined, undefined]);
    expect(hurt(normal.players[0]!)).toBe(true);
  });
});
