import { describe, expect, it } from "vitest";
import {
  AIR_DISTANCE,
  AIR_TICKS_PER_TILE,
  CHARACTERS,
  createMatch,
  placeBomb,
  placePlayerAt,
  SHIELD_TICKS,
  SPECIAL_COOLDOWN,
  SPECIAL_STUN_TICKS,
  step,
  type MatchState,
} from "../src";
import { player, run } from "./helpers";

/** p1 (donatello) at (5,5); the others placed by each test, out of the way until then. */
function arena(others: Record<string, "bomb" | "captain"> = { p2: "bomb" }): MatchState {
  const ids = ["p1", ...Object.keys(others)];
  const s = createMatch({ seed: 1, playerIds: ids, blockDensity: 0, characters: { p1: "donatello", ...others } });
  placePlayerAt(s, "p1", 5, 5);
  for (const id of Object.keys(others)) placePlayerAt(s, id, 1, 9);
  return s;
}

const spin = (s: MatchState) => step(s, { p1: { dir: null, bomb: false, special: true } });
/** Stunned by this tick's spin (the stun may already have ticked once). */
const struck = (s: MatchState, id: string) => player(s, id).stun >= SPECIAL_STUN_TICKS - 1;

/** A p2 bomb left on (x,y), p2 sent back out of the way. */
function bombOn(s: MatchState, x: number, y: number) {
  placePlayerAt(s, "p2", x, y);
  player(s, "p2").bombCapacity = 3;
  placeBomb(s, "p2");
  placePlayerAt(s, "p2", 1, 9);
  return s.bombs.at(-1)!;
}

describe("donatello bo staff spin", () => {
  it("donatello is a playable character", () => {
    expect(CHARACTERS).toContain("donatello");
  });

  it("stuns every player on the four tiles next to him and on his own", () => {
    const s = arena({ p2: "bomb", p3: "bomb", p4: "bomb" });
    placePlayerAt(s, "p2", 6, 5);
    placePlayerAt(s, "p3", 5, 4);
    placePlayerAt(s, "p4", 5, 5);
    spin(s);
    expect(struck(s, "p2")).toBe(true);
    expect(struck(s, "p3")).toBe(true);
    expect(struck(s, "p4")).toBe(true);
    expect(player(s).stun).toBe(0);
  });

  it("does not reach diagonals or two tiles away", () => {
    const s = arena({ p2: "bomb", p3: "bomb" });
    placePlayerAt(s, "p2", 6, 6);
    placePlayerAt(s, "p3", 7, 5);
    spin(s);
    expect(player(s, "p2").stun).toBe(0);
    expect(player(s, "p3").stun).toBe(0);
  });

  it(`bats the bombs next to him ${AIR_DISTANCE} tiles away, each the way it was hit`, () => {
    const s = arena();
    const right = bombOn(s, 6, 5);
    const up = bombOn(s, 5, 4);
    spin(s);
    expect(right.air?.dir).toBe("right");
    expect(up.air?.dir).toBe("up");
    run(s, AIR_TICKS_PER_TILE * AIR_DISTANCE + 1);
    expect([right.x, right.y]).toEqual([6 + AIR_DISTANCE, 5]);
    expect([up.x, up.y]).toEqual([5, 4 - AIR_DISTANCE]);
  });

  it("a raised shield facing him stops its side and stuns him instead", () => {
    const s = arena({ p2: "captain" });
    placePlayerAt(s, "p2", 6, 5);
    const captain = player(s, "p2");
    captain.facing = "left";
    captain.shield = SHIELD_TICKS;
    spin(s);
    expect(captain.stun).toBe(0);
    expect(player(s).stun).toBeGreaterThanOrEqual(SPECIAL_STUN_TICKS - 1);
  });

  it("leaves a blast for clients to draw and recharges", () => {
    const s = arena();
    spin(s);
    expect(s.blasts.some((b) => b.kind === "spin" && b.ownerId === "p1")).toBe(true);
    expect(player(s).specialCooldown).toBe(SPECIAL_COOLDOWN);
    spin(s);
    expect(s.blasts.filter((b) => b.kind === "spin")).toHaveLength(1);
  });
});
