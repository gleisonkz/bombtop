import { describe, expect, it } from "vitest";
import { FLAME_TICKS, FUSE_TICKS, getTile, hasFlame, ItemKind, placeBomb, placePlayerAt, setTile, step, Tile } from "../src";
import { emptyMatch, player, run } from "./helpers";

function pierceBomb(range: number) {
  const s = emptyMatch();
  player(s).bombType = "pierce";
  player(s).fireRange = range;
  return s;
}

function detonateAt(s: ReturnType<typeof emptyMatch>, x: number, y: number) {
  placePlayerAt(s, "p1", x, y);
  placeBomb(s, "p1");
  placePlayerAt(s, "p1", 1, 9);
  run(s, FUSE_TICKS);
}

describe("pierce bombs", () => {
  it("the pierce item switches the bomb type, replacing remote", () => {
    const s = emptyMatch();
    player(s).bombType = "remote";
    s.items.push({ x: 1, y: 1, kind: ItemKind.Pierce });
    step(s);
    expect(player(s).bombType).toBe("pierce");
  });

  it("flames pass through blocks, destroying every block in range", () => {
    const s = pierceBomb(4);
    setTile(s, 6, 5, Tile.Block);
    setTile(s, 7, 5, Tile.Block);
    setTile(s, 9, 5, Tile.Block);
    setTile(s, 10, 5, Tile.Block);
    detonateAt(s, 5, 5);
    expect(hasFlame(s, 8, 5)).toBe(true);
    run(s, FLAME_TICKS); // the blocks burn away with their flames
    expect(getTile(s, 6, 5)).toBe(Tile.Empty);
    expect(getTile(s, 7, 5)).toBe(Tile.Empty);
    expect(getTile(s, 9, 5)).toBe(Tile.Empty);
    expect(getTile(s, 10, 5)).toBe(Tile.Block); // out of range
  });

  it("are still stopped by walls", () => {
    const s = pierceBomb(4);
    detonateAt(s, 3, 2); // pillars at (2,2) and (4,2)
    expect(hasFlame(s, 1, 2)).toBe(false);
    expect(hasFlame(s, 5, 2)).toBe(false);
  });

  it("keep items revealed under pierced blocks", () => {
    const s = pierceBomb(3);
    setTile(s, 6, 5, Tile.Block);
    s.items.push({ x: 6, y: 5, kind: ItemKind.Fire });
    detonateAt(s, 5, 5);
    expect(s.items).toHaveLength(1);
  });

  it("burn exposed items and keep going", () => {
    const s = pierceBomb(3);
    s.items.push({ x: 6, y: 5, kind: ItemKind.Fire });
    detonateAt(s, 5, 5);
    expect(s.items).toEqual([]);
    expect(hasFlame(s, 8, 5)).toBe(true);
  });
});
