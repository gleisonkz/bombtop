import { describe, expect, it } from "vitest";
import { createMatch, placePlayerAt, sanitizeInput, SPECIAL_STUN_TICKS, step, type MatchState } from "../src";
import { center, player, run } from "./helpers";

/** p1 (thor) at (3,5) facing right; p2 (bomb) `gap` tiles in front of it. */
function duel(gap = 2): MatchState {
  const s = createMatch({ seed: 1, playerIds: ["p1", "p2"], blockDensity: 0, characters: { p1: "thor", p2: "bomb" } });
  placePlayerAt(s, "p1", 3, 5);
  placePlayerAt(s, "p2", 3 + gap, 5);
  player(s).facing = "right";
  return s;
}

const cast = (s: MatchState, id = "p1") => step(s, { [id]: { dir: null, bomb: false, special: true } });

describe("specials", () => {
  it("players know their character (the bomb unless told otherwise)", () => {
    const s = createMatch({ seed: 1, playerIds: ["a", "b"], characters: { b: "thor" } });
    expect(s.players.map((p) => p.character)).toEqual(["bomb", "thor"]);
  });

  it("a blast is left behind for clients to draw, up to what it hit", () => {
    const s = duel(2);
    cast(s);
    expect(s.blasts).toEqual([expect.objectContaining({ ownerId: "p1", x: 3, y: 5, dir: "right", length: 2 })]);
    run(s, 60);
    expect(s.blasts).toEqual([]);
  });

  it("can't be cast while wrapped up in web", () => {
    const s = duel(2);
    player(s).webbed = 10;
    cast(s);
    expect(player(s, "p2").stun).toBe(0);
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
    expect(player(s, "p2").stun).toBeGreaterThanOrEqual(SPECIAL_STUN_TICKS - 1); // may already have ticked once
  });
});
