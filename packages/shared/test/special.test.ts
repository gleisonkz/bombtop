import { describe, expect, it } from "vitest";
import {
  createMatch,
  FREEZE_TICKS,
  ICE_RANGE,
  placeBomb,
  placePlayerAt,
  sanitizeInput,
  setTile,
  SPECIAL_COOLDOWN,
  step,
  Tile,
  type MatchState,
} from "../src";
import { center, hold, player, run } from "./helpers";

/** p1 (ninja) at (3,5) facing right; p2 (bomb) `gap` tiles in front of it. */
function duel(gap = 2): MatchState {
  const s = createMatch({ seed: 1, playerIds: ["p1", "p2"], blockDensity: 0, characters: { p1: "ninja", p2: "bomb" } });
  placePlayerAt(s, "p1", 3, 5);
  placePlayerAt(s, "p2", 3 + gap, 5);
  player(s).facing = "right";
  return s;
}

const cast = (s: MatchState, id = "p1") => step(s, { [id]: { dir: null, bomb: false, special: true } });

describe("ninja ice blast", () => {
  it("players know their character (the bomb unless told otherwise)", () => {
    const s = createMatch({ seed: 1, playerIds: ["a", "b"], characters: { b: "ninja" } });
    expect(s.players.map((p) => p.character)).toEqual(["bomb", "ninja"]);
  });

  it(`freezes the first player within ${ICE_RANGE} tiles in front for 5 seconds`, () => {
    const s = duel(ICE_RANGE);
    cast(s);
    expect(player(s, "p2").frozen).toBe(FREEZE_TICKS);
    expect(FREEZE_TICKS).toBe(5 * 60);
  });

  it("misses players out of range, behind, or past a block, a wall or a bomb", () => {
    const far = duel(ICE_RANGE + 1);
    cast(far);
    expect(player(far, "p2").frozen).toBe(0);

    const behind = duel(-2);
    cast(behind);
    expect(player(behind, "p2").frozen).toBe(0);

    const blocked = duel(3);
    setTile(blocked, 4, 5, Tile.Block);
    cast(blocked);
    expect(player(blocked, "p2").frozen).toBe(0);

    const walled = duel(2);
    player(walled).facing = "up";
    placePlayerAt(walled, "p1", 2, 5);
    placePlayerAt(walled, "p2", 2, 3);
    cast(walled);
    expect(player(walled, "p2").frozen).toBe(0); // (2,4) is a pillar

    const bombed = duel(3);
    placePlayerAt(bombed, "p1", 4, 5);
    placeBomb(bombed, "p1");
    placePlayerAt(bombed, "p1", 3, 5);
    cast(bombed);
    expect(player(bombed, "p2").frozen).toBe(0);
  });

  it("leaves a blast behind for clients to draw, up to what it hit", () => {
    const s = duel(2);
    cast(s);
    expect(s.blasts).toEqual([expect.objectContaining({ ownerId: "p1", x: 3, y: 5, dir: "right", length: 2 })]);
    run(s, 60);
    expect(s.blasts).toEqual([]);
  });

  it("a frozen player can neither move nor drop bombs, and thaws after 5 seconds", () => {
    const s = duel(2);
    cast(s);
    const p2 = player(s, "p2");
    const px = p2.px;
    run(s, 30, { p2: { dir: "right", bomb: true } });
    expect(p2.px).toBe(px);
    expect(s.bombs.filter((b) => b.ownerId === "p2")).toHaveLength(0);
    run(s, FREEZE_TICKS);
    expect(p2.frozen).toBe(0);
    hold(s, "right", 10, "p2");
    expect(p2.px).toBeGreaterThan(px);
  });

  it("still burns in a blast while frozen", () => {
    const s = duel(2);
    cast(s);
    s.flames.push({ x: 5, y: 5, ttl: 10 });
    step(s);
    expect(player(s, "p2").alive).toBe(false);
  });

  it(`recharges for ${SPECIAL_COOLDOWN / 60} seconds after each use`, () => {
    const s = duel(2);
    cast(s);
    expect(player(s).specialCooldown).toBe(SPECIAL_COOLDOWN);
    player(s, "p2").frozen = 0;
    cast(s);
    expect(player(s, "p2").frozen).toBe(0);
    run(s, SPECIAL_COOLDOWN);
    placePlayerAt(s, "p2", 5, 5);
    cast(s);
    expect(player(s, "p2").frozen).toBe(FREEZE_TICKS);
  });

  it("only the ninja has it (for now)", () => {
    const s = duel(2);
    player(s, "p2").facing = "left";
    cast(s, "p2");
    expect(player(s).frozen).toBe(0);
    expect(s.blasts).toEqual([]);
  });

  it("can't be cast while frozen", () => {
    const s = duel(2);
    player(s).frozen = 10;
    cast(s);
    expect(player(s, "p2").frozen).toBe(0);
  });

  it("the special button survives network sanitizing", () => {
    expect(sanitizeInput({ dir: null, bomb: false, special: true }).special).toBe(true);
    expect(sanitizeInput({ special: "yes" }).special).toBeFalsy();
  });
});

describe("blast geometry", () => {
  it("starts on the tile in front of the caster's center", () => {
    const s = duel(1);
    player(s).px = center(3) + 5;
    cast(s);
    expect(player(s, "p2").frozen).toBe(FREEZE_TICKS);
  });
});
