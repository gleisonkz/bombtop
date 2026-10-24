import { describe, expect, it } from "vitest";
import {
  CHARACTERS,
  createMatch,
  FLAME_TICKS,
  placeBomb,
  placePlayerAt,
  playerTile,
  setTile,
  SHIELD_TICKS,
  SPECIAL_STUN_TICKS,
  step,
  Tile,
  TRUCK_COOLDOWN,
  TRUCK_RANGE,
  TRUCK_SHIFT,
  TRUCK_TICKS,
  type MatchState,
} from "../src";
import { BOT_NAMES } from "../src/room/session";
import { center, player, run } from "./helpers";

/** p1 (optimus) at (1,5) facing right; p2 (bomb) `gap` tiles in front of him. */
function duel(gap = 8, others: Record<string, "bomb" | "captain"> = {}): MatchState {
  const ids = ["p1", "p2", ...Object.keys(others)];
  const s = createMatch({ seed: 1, playerIds: ids, blockDensity: 0, characters: { p1: "optimus", p2: "bomb", ...others } });
  placePlayerAt(s, "p1", 1, 5);
  placePlayerAt(s, "p2", 1 + gap, 5);
  player(s).facing = "right";
  return s;
}

const cast = (s: MatchState) => step(s, { p1: { dir: null, bomb: false, special: true } });
/** Presses the special and waits out the transformation and the drive. */
const roll = (s: MatchState) => {
  cast(s);
  run(s, TRUCK_SHIFT + TRUCK_TICKS);
};

describe("optimus: autobots, roll out", () => {
  it("optimus is a playable character, with bot names", () => {
    expect(CHARACTERS).toContain("optimus");
    expect(BOT_NAMES.optimus.length).toBeGreaterThan(0);
  });

  it(`transforms where he stands, then drives ${TRUCK_RANGE} tiles straight ahead, deaf to the stick`, () => {
    const s = duel(TRUCK_RANGE + 3);
    cast(s);
    expect(player(s).truck).toBe(TRUCK_SHIFT + TRUCK_TICKS);
    run(s, TRUCK_SHIFT - 1, { p1: { dir: "down", bomb: false } });
    expect(player(s).px).toBe(center(1)); // still turning into the truck
    run(s, TRUCK_TICKS + 1, { p1: { dir: "down", bomb: false } });
    expect(player(s).truck).toBe(0);
    expect(player(s).px).toBe(center(1 + TRUCK_RANGE));
    expect(player(s).py).toBe(center(5));
    expect(player(s, "p2").stun).toBe(0);
    expect(player(s).specialCooldown).toBeGreaterThan(TRUCK_COOLDOWN - 100);
    expect(s.blasts).toContainEqual(expect.objectContaining({ ownerId: "p1", kind: "truck", x: 1 + TRUCK_RANGE, y: 5, dir: "right" }));
  });

  it("shoves a player along in front of the bumper, stunned, and drops them where he stops", () => {
    const s = duel(2);
    roll(s);
    expect(playerTile(player(s))).toEqual({ x: 1 + TRUCK_RANGE, y: 5 });
    expect(playerTile(player(s, "p2"))).toEqual({ x: 2 + TRUCK_RANGE, y: 5 });
    expect(player(s, "p2").px).toBe(center(2 + TRUCK_RANGE));
    expect(player(s, "p2").stun).toBeGreaterThan(SPECIAL_STUN_TICKS - 10);
  });

  it("a player pinned against a wall is stunned and stops him", () => {
    const s = duel(3);
    setTile(s, 5, 5, Tile.Wall);
    roll(s);
    expect(playerTile(player(s, "p2"))).toEqual({ x: 4, y: 5 });
    expect(playerTile(player(s))).toEqual({ x: 3, y: 5 });
    expect(player(s, "p2").stun).toBeGreaterThan(0);
    expect(player(s).truck).toBe(0);
  });

  it("crushes a block in his way and stops there: it burns away like a blown-up block", () => {
    const s = duel();
    setTile(s, 4, 5, Tile.Block);
    roll(s);
    expect(playerTile(player(s))).toEqual({ x: 3, y: 5 });
    expect(s.flames).toContainEqual(expect.objectContaining({ x: 4, y: 5, block: true }));
    run(s, FLAME_TICKS);
    expect(s.grid.tiles[5 * s.grid.width + 4]).toBe(Tile.Empty);
  });

  it("rams a bomb in his way, which slides off ahead, and stops", () => {
    const s = duel();
    placePlayerAt(s, "p2", 3, 7);
    placeBomb(s, "p2");
    s.bombs[0]!.x = 4;
    s.bombs[0]!.y = 5;
    roll(s);
    expect(playerTile(player(s))).toEqual({ x: 3, y: 5 });
    expect(s.bombs[0]!.slide === "right" || s.bombs[0]!.x > 4).toBe(true);
  });

  it("walls stop him", () => {
    const s = duel();
    setTile(s, 3, 5, Tile.Wall);
    roll(s);
    expect(playerTile(player(s))).toEqual({ x: 2, y: 5 });
  });

  it("a shield facing him stops him in front of it, stunned himself", () => {
    const s = duel(8, { p3: "captain" });
    placePlayerAt(s, "p3", 4, 5);
    player(s, "p3").facing = "left";
    player(s, "p3").shield = SHIELD_TICKS;
    roll(s);
    expect(playerTile(player(s))).toEqual({ x: 3, y: 5 });
    expect(playerTile(player(s, "p3"))).toEqual({ x: 4, y: 5 });
    expect(player(s).stun).toBeGreaterThan(0);
    expect(player(s, "p3").stun).toBe(0);
  });

  it("a stun while he transforms or drives cuts it short", () => {
    const s = duel();
    cast(s);
    player(s).stun = 10;
    step(s, {});
    expect(player(s).truck).toBe(0);
  });

  it("waits out his recharge", () => {
    const s = duel();
    roll(s);
    cast(s);
    expect(player(s).truck).toBe(0);
  });
});
