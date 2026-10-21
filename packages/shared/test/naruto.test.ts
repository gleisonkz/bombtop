import { describe, expect, it } from "vitest";
import {
  CHARACTERS,
  createMatch,
  placeBomb,
  placePlayerAt,
  playerTile,
  RASENGAN_PUSH,
  RASENGAN_RANGE,
  RASENGAN_STUN_TICKS,
  RASENGAN_TICKS,
  setTile,
  SHIELD_TICKS,
  SPECIAL_COOLDOWN,
  step,
  Tile,
  type MatchState,
} from "../src";
import { center, player, run } from "./helpers";

/** p1 (naruto) at (1,5) facing right; p2 (bomb) `gap` tiles in front of him. */
function duel(gap = 4, others: Record<string, "bomb" | "captain"> = {}): MatchState {
  const ids = ["p1", "p2", ...Object.keys(others)];
  const s = createMatch({ seed: 1, playerIds: ids, blockDensity: 0, characters: { p1: "naruto", p2: "bomb", ...others } });
  placePlayerAt(s, "p1", 1, 5);
  placePlayerAt(s, "p2", 1 + gap, 5);
  player(s).facing = "right";
  return s;
}

const cast = (s: MatchState) => step(s, { p1: { dir: null, bomb: false, special: true } });
/** Presses the special and waits out the dash. */
const rush = (s: MatchState) => {
  cast(s);
  run(s, RASENGAN_TICKS);
};

describe("naruto rasengan", () => {
  it("naruto is a playable character", () => {
    expect(CHARACTERS).toContain("naruto");
  });

  it(`dashes ${RASENGAN_RANGE} tiles straight ahead, deaf to the stick`, () => {
    const s = duel(RASENGAN_RANGE + 2);
    cast(s);
    expect(player(s).rasengan).toBeGreaterThan(0);
    run(s, RASENGAN_TICKS, { p1: { dir: "down", bomb: false } });
    expect(player(s).rasengan).toBe(0);
    expect(player(s).px).toBe(center(1 + RASENGAN_RANGE));
    expect(player(s).py).toBe(center(5));
    expect(player(s, "p2").stun).toBe(0);
  });

  it(`the first player hit is knocked back ${RASENGAN_PUSH} tiles and stunned`, () => {
    const s = duel(2);
    rush(s);
    expect(playerTile(player(s))).toEqual({ x: 2, y: 5 });
    expect(playerTile(player(s, "p2"))).toEqual({ x: 3 + RASENGAN_PUSH, y: 5 });
    expect(player(s, "p2").stun).toBeGreaterThan(RASENGAN_STUN_TICKS - RASENGAN_TICKS);
    expect(s.blasts).toEqual([expect.objectContaining({ ownerId: "p1", dir: "right", length: 1, kind: "rasengan" })]);
  });

  it("the knock-back stops at walls, blocks and bombs", () => {
    const s = duel(2);
    setTile(s, 5, 5, Tile.Block);
    rush(s);
    expect(playerTile(player(s, "p2"))).toEqual({ x: 4, y: 5 });
  });

  it("breaks a block in his way and stops there", () => {
    const s = duel(5);
    setTile(s, 3, 5, Tile.Block);
    rush(s);
    expect(s.grid.tiles[5 * s.grid.width + 3]).toBe(Tile.Empty);
    expect(playerTile(player(s))).toEqual({ x: 2, y: 5 });
    expect(player(s).rasengan).toBe(0);
  });

  it("walls and bombs stop him", () => {
    const s = duel(5);
    placePlayerAt(s, "p1", 2, 5);
    player(s).facing = "up";
    rush(s); // (2,4) is a pillar
    expect(player(s).py).toBe(center(5));

    const t = duel(5);
    placePlayerAt(t, "p2", 3, 5);
    placeBomb(t, "p2");
    placePlayerAt(t, "p2", 9, 7);
    rush(t);
    expect(playerTile(player(t))).toEqual({ x: 2, y: 5 });
    expect(t.bombs).toHaveLength(1);
  });

  it("a captain's shield stops him and stuns him instead", () => {
    const s = duel(5, { p3: "captain" });
    placePlayerAt(s, "p3", 3, 5);
    player(s, "p3").facing = "left";
    player(s, "p3").shield = SHIELD_TICKS;
    rush(s);
    expect(playerTile(player(s, "p3"))).toEqual({ x: 3, y: 5 });
    expect(player(s, "p3").stun).toBe(0);
    expect(player(s).stun).toBeGreaterThan(0);
  });

  it("a stun cuts the dash short", () => {
    const s = duel(5);
    cast(s);
    player(s).stun = 10;
    run(s, RASENGAN_TICKS + 10);
    expect(player(s).px).toBeLessThan(center(1 + RASENGAN_RANGE));
    expect(player(s).rasengan).toBe(0);
  });

  it(`recharges for ${SPECIAL_COOLDOWN / 60} seconds`, () => {
    const s = duel();
    cast(s);
    expect(player(s).specialCooldown).toBe(SPECIAL_COOLDOWN);
  });
});
