import { describe, expect, it } from "vitest";
import { FIRE_SUIT_TICKS, FLAME_TICKS, getTile, INVULN_TICKS, ItemKind, placePlayerAt, setTile, step, Tile } from "../src";
import { emptyMatch, player, run } from "./helpers";

function pickup(kind: ItemKind) {
  const s = emptyMatch();
  placePlayerAt(s, "p1", 5, 5);
  s.items.push({ x: 5, y: 5, kind });
  step(s);
  return s;
}

function flame(s: ReturnType<typeof emptyMatch>) {
  s.flames.push({ x: 5, y: 5, ttl: FLAME_TICKS, ownerId: "p2" });
}

describe("Super Bomberman 4 Maniac protection items", () => {
  it("Heart prevents one lethal hit and grants the existing brief post-hit immunity", () => {
    const s = pickup(ItemKind.Heart);
    expect(player(s).hasHeart).toBe(true);
    flame(s);
    step(s);
    expect(player(s).alive).toBe(true);
    expect(player(s).hasHeart).toBe(false);
    expect(player(s).invuln).toBe(INVULN_TICKS);
    run(s, INVULN_TICKS);
    flame(s);
    step(s);
    expect(player(s).alive).toBe(false);
  });

  it("collecting a second Heart while protected does not stack extra lives", () => {
    const s = pickup(ItemKind.Heart);
    s.items.push({ x: 5, y: 5, kind: ItemKind.Heart });
    step(s);
    expect(player(s).hasHeart).toBe(true);
    flame(s);
    step(s);
    expect(player(s).hasHeart).toBe(false);
  });

  it("Fire Suit prevents blast damage during its timed protection window", () => {
    const s = pickup(ItemKind.FireSuit);
    expect(player(s).fireSuitTicks).toBe(FIRE_SUIT_TICKS);
    flame(s);
    run(s, 10);
    expect(player(s).alive).toBe(true);
    expect(player(s).fireSuitTicks).toBe(FIRE_SUIT_TICKS - 10);
    s.flames = [];
    run(s, FIRE_SUIT_TICKS - 10);
    expect(player(s).fireSuitTicks).toBe(0);
    flame(s);
    step(s);
    expect(player(s).alive).toBe(false);
  });

  it("Fire Suit and Heart never protect against a falling sudden-death wall", () => {
    const s = pickup(ItemKind.Heart);
    s.items.push({ x: 5, y: 5, kind: ItemKind.FireSuit });
    step(s);
    s.tick = s.pressureAt;
    s.pressure = 0;
    placePlayerAt(s, "p1", 1, 1);
    s.grid.tiles[1 * s.grid.width + 1] = Tile.Empty;
    step(s);
    expect(getTile(s, 1, 1)).toBe(Tile.Wall);
    expect(player(s).alive).toBe(false);
  });

  it("a player with a Heart still loses its mount before spending the Heart", () => {
    const s = pickup(ItemKind.Heart);
    player(s).mount = "dasher";
    flame(s);
    step(s);
    expect(player(s).mount).toBeNull();
    expect(player(s).hasHeart).toBe(true);
  });
});
