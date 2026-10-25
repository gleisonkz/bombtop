import { describe, expect, it } from "vitest";
import { createMatch, getTile, ItemKind, playerTile, SPAWN_POINTS, Tile } from "../src";

const ids = ["p1", "p2", "p3", "p4", "p5"];

describe("arena", () => {
  it("distributes the classic battle item inventory including two eggs", () => {
    const match = createMatch({ seed: 17, playerIds: ids, blockDensity: 1 });
    const counts = Object.fromEntries(
      [...new Set(match.items.map((item) => item.kind))].map((kind) => [kind, match.items.filter((item) => item.kind === kind).length]),
    );

    expect(counts).toEqual({
      [ItemKind.Bomb]: 8,
      [ItemKind.Fire]: 5,
      [ItemKind.Speed]: 3,
      [ItemKind.Egg]: 2,
      [ItemKind.Glove]: 2,
      [ItemKind.Punch]: 2,
      [ItemKind.Kick]: 3,
      [ItemKind.Skull]: 1,
    });
    expect(match.items).toHaveLength(26);
    expect(new Set(match.items.map((item) => `${item.x},${item.y}`)).size).toBe(match.items.length);
    expect(match.items.every(({ x, y }) => getTile(match, x, y) === Tile.Block)).toBe(true);
  });

  it("keeps hidden item placement deterministic and bounded by existing blocks", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const opts = { seed, playerIds: ids, blockDensity: 0.3 };
      const a = createMatch(opts);
      const b = createMatch(opts);
      expect(a.items).toEqual(b.items);
      expect(a.items.length).toBeLessThanOrEqual(a.grid.tiles.filter((tile) => tile === Tile.Block).length);
      expect(new Set(a.items.map(({ x, y }) => `${x},${y}`)).size).toBe(a.items.length);
    }
  });

  it("gives the dead no revenge carts unless asked", () => {
    expect(createMatch({ seed: 1, playerIds: ids }).revenge).toBe(false);
    expect(createMatch({ seed: 1, playerIds: ids, revenge: true }).revenge).toBe(true);
  });

  it("creates a 15x13 arena by default: 13x11 to play in inside its walls, as in Super Bomberman 4", () => {
    const s = createMatch({ seed: 1, playerIds: ids });
    expect(s.grid.width).toBe(15);
    expect(s.grid.height).toBe(13);
  });

  it("surrounds the arena with indestructible walls", () => {
    const s = createMatch({ seed: 1, playerIds: ids });
    for (let x = 0; x < 15; x++) {
      expect(getTile(s, x, 0)).toBe(Tile.Wall);
      expect(getTile(s, x, 12)).toBe(Tile.Wall);
    }
    for (let y = 0; y < 13; y++) {
      expect(getTile(s, 0, y)).toBe(Tile.Wall);
      expect(getTile(s, 14, y)).toBe(Tile.Wall);
    }
  });

  it("places pillars on even interior coordinates", () => {
    const s = createMatch({ seed: 1, playerIds: ids });
    expect(getTile(s, 2, 2)).toBe(Tile.Wall);
    expect(getTile(s, 12, 10)).toBe(Tile.Wall);
    expect(getTile(s, 1, 1)).not.toBe(Tile.Wall);
    expect(getTile(s, 3, 2)).not.toBe(Tile.Wall);
  });

  it("treats out-of-bounds as wall", () => {
    const s = createMatch({ seed: 1, playerIds: ids });
    expect(getTile(s, -1, 3)).toBe(Tile.Wall);
    expect(getTile(s, 15, 3)).toBe(Tile.Wall);
  });

  it("spawns up to 5 players on distinct spawn points", () => {
    const s = createMatch({ seed: 1, playerIds: ids });
    expect(s.players).toHaveLength(5);
    s.players.forEach((p, i) => {
      expect(playerTile(p)).toEqual(SPAWN_POINTS[i]);
      expect(p.alive).toBe(true);
    });
  });

  it("rejects more than 5 players", () => {
    expect(() => createMatch({ seed: 1, playerIds: [...ids, "p6"] })).toThrow();
  });

  it("keeps spawn points and their neighbours free of blocks", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const s = createMatch({ seed, playerIds: ids, blockDensity: 1 });
      for (const pl of s.players) {
        const p = playerTile(pl);
        expect(getTile(s, p.x, p.y)).toBe(Tile.Empty);
        const free = [
          [p.x + 1, p.y],
          [p.x - 1, p.y],
          [p.x, p.y + 1],
          [p.x, p.y - 1],
        ].filter(([x, y]) => getTile(s, x!, y!) === Tile.Empty);
        expect(free.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("fills free tiles with destructible blocks deterministically by seed", () => {
    const a = createMatch({ seed: 42, playerIds: ids });
    const b = createMatch({ seed: 42, playerIds: ids });
    const c = createMatch({ seed: 43, playerIds: ids });
    expect(a.grid.tiles).toEqual(b.grid.tiles);
    expect(a.grid.tiles).not.toEqual(c.grid.tiles);
    expect(a.grid.tiles.filter((t) => t === Tile.Block).length).toBeGreaterThan(0);
  });

  it("creates an empty arena when blockDensity is 0", () => {
    const s = createMatch({ seed: 1, playerIds: ids, blockDensity: 0 });
    expect(s.grid.tiles.includes(Tile.Block)).toBe(false);
  });
});
