import { describe, expect, it } from "vitest";
import { FUSE_TICKS, hasFlame, ItemKind, placeBomb, placePlayerAt, setTile, step, Tile } from "../src";
import { emptyMatch, hold, player, run } from "./helpers";

function withKick() {
  const s = emptyMatch();
  player(s).canKick = true;
  return s;
}

/** p2 drops a bomb at (x,y) and walks away to its corner. */
function bombAt(s: ReturnType<typeof emptyMatch>, x: number, y: number) {
  placePlayerAt(s, "p2", x, y);
  placeBomb(s, "p2");
  placePlayerAt(s, "p2", 11, 9);
  return s.bombs.at(-1)!;
}

describe("kick", () => {
  it("the kick item grants the ability", () => {
    const s = emptyMatch();
    s.items.push({ x: 1, y: 1, kind: ItemKind.Kick });
    step(s);
    expect(player(s).canKick).toBe(true);
  });

  it("players cannot kick without the ability", () => {
    const s = emptyMatch();
    const b = bombAt(s, 3, 1);
    hold(s, "right", 30);
    expect(b.x).toBe(3);
    expect(b.slide).toBeNull();
  });

  it("walking into a bomb kicks it until it hits a wall", () => {
    const s = withKick();
    const b = bombAt(s, 3, 1);
    hold(s, "right", 20);
    expect(b.slide).toBe("right");
    hold(s, null, 90);
    expect(b.x).toBe(11);
    expect(b.slide).toBeNull();
  });

  it("stops before a block", () => {
    const s = withKick();
    setTile(s, 7, 1, Tile.Block);
    const b = bombAt(s, 3, 1);
    hold(s, "right", 20);
    hold(s, null, 90);
    expect(b.x).toBe(6);
  });

  it("stops before another bomb", () => {
    const s = withKick();
    player(s, "p2").bombCapacity = 2;
    bombAt(s, 8, 1);
    const b = bombAt(s, 3, 1);
    hold(s, "right", 20);
    hold(s, null, 90);
    expect(b.x).toBe(7);
  });

  it("stops before a player", () => {
    const s = withKick();
    const b = bombAt(s, 3, 1);
    placePlayerAt(s, "p2", 9, 1);
    hold(s, "right", 20);
    hold(s, null, 90);
    expect(b.x).toBe(8);
  });

  it("kicked bombs keep their fuse and explode where they are", () => {
    const s = withKick();
    const b = bombAt(s, 3, 1);
    hold(s, "right", 20);
    run(s, FUSE_TICKS);
    expect(s.bombs).not.toContain(b);
    expect(hasFlame(s, 11, 1)).toBe(true);
  });

  it("kicks vertically too", () => {
    const s = withKick();
    const b = bombAt(s, 1, 3);
    hold(s, "down", 20);
    hold(s, null, 90);
    expect(b.y).toBe(9);
  });

  it("kicks a bomb reached off-lane, lining up first", () => {
    const s = withKick();
    const b = bombAt(s, 2, 1);
    hold(s, "down", 3); // a little below row 1's center; (2,2) is a pillar
    hold(s, "right", 10);
    expect(b.slide).toBe("right");
  });
});
