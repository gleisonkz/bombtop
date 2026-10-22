import { describe, expect, it } from "vitest";
import {
  CHARACTERS,
  createMatch,
  MAGNET_RANGE,
  placePlayerAt,
  playerTile,
  setTile,
  SPECIAL_COOLDOWN,
  SPECIAL_STUN_TICKS,
  step,
  Tile,
  type MatchState,
} from "../src";
import { player } from "./helpers";

/** p1 (static) at (3,5) facing right; p2 `gap` tiles in front of him. */
function duel(gap = 3, p2: "bomb" | "captain" = "bomb"): MatchState {
  const s = createMatch({ seed: 1, playerIds: ["p1", "p2"], blockDensity: 0, characters: { p1: "static", p2 } });
  placePlayerAt(s, "p1", 3, 5);
  placePlayerAt(s, "p2", 3 + gap, 5);
  player(s).facing = "right";
  return s;
}

const cast = (s: MatchState, id = "p1") => step(s, { [id]: { dir: null, bomb: false, special: true } });

describe("static magnet pull", () => {
  it("static is a playable character", () => {
    expect(CHARACTERS).toContain("static");
  });

  it(`pulls the first player within ${MAGNET_RANGE} tiles in front to the tile next to him, stunned`, () => {
    const s = duel(MAGNET_RANGE);
    cast(s);
    expect(playerTile(player(s, "p2"))).toEqual({ x: 4, y: 5 });
    expect(player(s, "p2").stun).toBeGreaterThanOrEqual(SPECIAL_STUN_TICKS - 1);
  });

  it("misses players out of range or past a block", () => {
    const far = duel(MAGNET_RANGE + 1);
    cast(far);
    expect(playerTile(player(far, "p2"))).toEqual({ x: 3 + MAGNET_RANGE + 1, y: 5 });
    expect(player(far, "p2").stun).toBe(0);

    const blocked = duel(3);
    setTile(blocked, 4, 5, Tile.Block);
    cast(blocked);
    expect(playerTile(player(blocked, "p2"))).toEqual({ x: 6, y: 5 });
    expect(player(blocked, "p2").stun).toBe(0);
  });

  it("leaves a magnet blast behind for clients to draw", () => {
    const s = duel(3);
    cast(s);
    expect(s.blasts).toEqual([expect.objectContaining({ ownerId: "p1", dir: "right", length: 3, kind: "magnet" })]);
  });

  it("a raised shield sends the pull back: static is dragged to the captain, stunned", () => {
    const s = duel(3, "captain");
    player(s, "p2").facing = "left";
    player(s, "p2").shield = 60;
    cast(s);
    expect(playerTile(player(s, "p2"))).toEqual({ x: 6, y: 5 });
    expect(playerTile(player(s))).toEqual({ x: 5, y: 5 });
    expect(player(s).stun).toBeGreaterThanOrEqual(SPECIAL_STUN_TICKS - 1);
  });

  it(`recharges for ${SPECIAL_COOLDOWN / 60} seconds`, () => {
    const s = duel(2);
    cast(s);
    expect(player(s).specialCooldown).toBe(SPECIAL_COOLDOWN);
  });
});
