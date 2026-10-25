import { describe, expect, it } from "vitest";
import {
  KISS_RANGE,
  SPECIAL_STUN_TICKS,
  CHARACTERS,
  createMatch,
  setTile,
  SHIELD_TICKS,
  SPECIAL_COOLDOWN,
  step,
  Tile,
  placePlayerAt,
  type MatchState,
} from "../src";
import { hold, player, run } from "./helpers";

/** p1 (penelope) at (3,5) facing right; p2 (bomb) `gap` tiles in front of her. */
function duel(gap = 2): MatchState {
  const s = createMatch({ seed: 1, playerIds: ["p1", "p2"], blockDensity: 0, characters: { p1: "penelope", p2: "bomb" } });
  placePlayerAt(s, "p1", 3, 5);
  placePlayerAt(s, "p2", 3 + gap, 5);
  player(s).facing = "right";
  return s;
}

const cast = (s: MatchState, id = "p1") => step(s, { [id]: { dir: null, bomb: false, special: true } });

describe("penelope's blown kiss", () => {
  it("penelope is a playable character", () => {
    expect(CHARACTERS).toContain("penelope");
  });

  it(`charms the first player within ${KISS_RANGE} tiles in front, stunned for 3 seconds`, () => {
    const s = duel(KISS_RANGE);
    cast(s);
    expect(player(s, "p2").stun).toBeGreaterThanOrEqual(SPECIAL_STUN_TICKS - 1);
    expect(player(s, "p2").charmed).toBeGreaterThanOrEqual(SPECIAL_STUN_TICKS - 1);
  });

  it("misses players out of range or past a block", () => {
    const far = duel(KISS_RANGE + 1);
    cast(far);
    expect(player(far, "p2").stun).toBe(0);
    expect(player(far, "p2").charmed).toBe(0);

    const blocked = duel(3);
    setTile(blocked, 4, 5, Tile.Block);
    cast(blocked);
    expect(player(blocked, "p2").charmed).toBe(0);
  });

  it("leaves a kiss blast behind for clients to draw", () => {
    const s = duel(2);
    cast(s);
    expect(s.blasts).toEqual([expect.objectContaining({ ownerId: "p1", dir: "right", length: 2, kind: "kiss" })]);
  });

  it("the charm wears off with the stun", () => {
    const s = duel(2);
    cast(s);
    const p2 = player(s, "p2");
    const px = p2.px;
    run(s, 30, { p2: { dir: "right", bomb: false } });
    expect(p2.px).toBe(px);
    run(s, SPECIAL_STUN_TICKS);
    expect(p2.charmed).toBe(0);
    hold(s, "right", 10, "p2");
    expect(p2.px).toBeGreaterThan(px);
  });

  it(`recharges for ${SPECIAL_COOLDOWN / 60} seconds`, () => {
    const s = duel(2);
    cast(s);
    expect(player(s).specialCooldown).toBe(SPECIAL_COOLDOWN);
  });

  it("a captain's shield sends the kiss back at her", () => {
    const s = createMatch({ seed: 1, playerIds: ["p1", "p2"], blockDensity: 0, characters: { p1: "penelope", p2: "captain" } });
    placePlayerAt(s, "p1", 3, 5);
    placePlayerAt(s, "p2", 6, 5);
    player(s).facing = "right";
    player(s, "p2").facing = "left";
    player(s, "p2").shield = SHIELD_TICKS;
    cast(s);
    expect(player(s, "p2").charmed).toBe(0);
    expect(player(s).charmed).toBe(SPECIAL_STUN_TICKS);
    expect(s.blasts.map((b) => b.kind)).toEqual(["kiss", "kiss"]);
  });
});
