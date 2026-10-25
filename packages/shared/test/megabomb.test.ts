import { describe, expect, it } from "vitest";
import { createMatch, FLAME_TICKS, FUSE_TICKS, getTile, MEGA_COOLDOWN, placeBomb, placePlayerAt, setTile, step, Tile, TICK_RATE, type MatchState } from "../src";
import { hold, player, run } from "./helpers";

/** p1 (the bomb mascot) at (3,5), p2 (thor) far away. */
function arena(): MatchState {
  const s = createMatch({ seed: 1, playerIds: ["p1", "p2"], blockDensity: 0, characters: { p1: "bomb", p2: "thor" } });
  placePlayerAt(s, "p1", 3, 5);
  placePlayerAt(s, "p2", 11, 1);
  return s;
}

const cast = (s: MatchState, id = "p1") => step(s, { [id]: { dir: null, bomb: false, special: true } });

describe("bomb mascot's mega bomb", () => {
  it("plants a mega bomb on his tile: piercing, twice his fire, with a 25 s recharge", () => {
    const s = arena();
    const range = player(s).fireRange;
    cast(s);
    expect(s.bombs).toEqual([expect.objectContaining({ ownerId: "p1", x: 3, y: 5, type: "pierce", range: range * 2, mega: true })]);
    expect(player(s).specialCooldown).toBeGreaterThanOrEqual(MEGA_COOLDOWN - 1);
    expect(MEGA_COOLDOWN).toBe(25 * TICK_RATE);
  });

  it("does not take one of his normal bomb slots", () => {
    const s = arena();
    player(s).bombCapacity = 1;
    cast(s);
    hold(s, "right", 20);
    expect(placeBomb(s, "p1")).toBe(true);
  });

  it("burns through blocks, twice as far as his own bombs", () => {
    const s = arena();
    const range = player(s).fireRange;
    setTile(s, 4, 5, Tile.Block);
    setTile(s, 5, 5, Tile.Block);
    cast(s);
    run(s, FUSE_TICKS);
    expect(s.flames).toContainEqual(expect.objectContaining({ x: 3 + range * 2, y: 5 }));
    expect(s.flames).not.toContainEqual(expect.objectContaining({ x: 4 + range * 2, y: 5 }));
    run(s, FLAME_TICKS); // the blocks burn away with their flames
    expect(getTile(s, 4, 5)).toBe(Tile.Empty);
    expect(getTile(s, 5, 5)).toBe(Tile.Empty);
  });

  it("does nothing while a bomb already sits on his tile, and keeps the recharge", () => {
    const s = arena();
    placeBomb(s, "p1");
    cast(s);
    expect(s.bombs).toHaveLength(1);
    expect(s.bombs[0]!.mega).toBeFalsy();
    expect(player(s).specialCooldown).toBe(0);
  });
});
