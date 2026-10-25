import { describe, expect, it } from "vitest";
import {
  CHARACTERS,
  createMatch,
  PATRONUS_COOLDOWN,
  PATRONUS_TICKS_PER_TILE,
  blastLife,
  placeBomb,
  placePlayerAt,
  setTile,
  SHIELD_TICKS,
  SPECIAL_STUN_TICKS,
  step,
  Tile,
  TICK_RATE,
  type MatchState,
} from "../src";
import { player, run } from "./helpers";

/** p1 (harry) at (2,5) facing right; the others at the given columns of row 5. */
function line(...xs: number[]): MatchState {
  const ids = ["p1", ...xs.map((_, i) => `p${i + 2}`)];
  const s = createMatch({ seed: 1, playerIds: ids, blockDensity: 0, characters: { p1: "harry" } });
  placePlayerAt(s, "p1", 2, 5);
  xs.forEach((x, i) => placePlayerAt(s, `p${i + 2}`, x, 5));
  player(s).facing = "right";
  return s;
}

const cast = (s: MatchState) => step(s, { p1: { dir: null, bomb: false, special: true } });

describe("harry's expecto patronum", () => {
  it("harry is a playable character", () => {
    expect(CHARACTERS).toContain("harry");
  });

  it("his stag gallops ahead until a wall and stuns everyone in its way for 3 seconds, not only the first", () => {
    const s = line(4, 13);
    cast(s);
    run(s, 11 * PATRONUS_TICKS_PER_TILE);
    expect(player(s, "p2").stun).toBeGreaterThan(SPECIAL_STUN_TICKS - 11 * PATRONUS_TICKS_PER_TILE);
    expect(player(s, "p3").stun).toBeGreaterThan(SPECIAL_STUN_TICKS - 11 * PATRONUS_TICKS_PER_TILE);
    expect(player(s).stun).toBe(0);
  });

  it("stuns each one as the stag reaches them, not before", () => {
    const s = line(10);
    cast(s);
    run(s, 4 * PATRONUS_TICKS_PER_TILE);
    expect(player(s, "p2").stun).toBe(0);
    run(s, 5 * PATRONUS_TICKS_PER_TILE);
    expect(player(s, "p2").stun).toBeGreaterThan(SPECIAL_STUN_TICKS - 2 * PATRONUS_TICKS_PER_TILE);
  });

  it("catches whoever steps into its path before it gets there", () => {
    const s = line(9);
    cast(s);
    placePlayerAt(s, "p2", 6, 5);
    run(s, 5 * PATRONUS_TICKS_PER_TILE);
    expect(player(s, "p2").stun).toBeGreaterThan(0);
  });

  it("stays on screen while it runs, then a little longer as it fades", () => {
    const s = line(13);
    cast(s);
    expect(s.blasts[0]!.ttl).toBe(blastLife(s.blasts[0]!) - 1); // one tick gone with the cast
    expect(blastLife(s.blasts[0]!)).toBeGreaterThan(11 * PATRONUS_TICKS_PER_TILE);
  });

  it("runs right across the arena, but not through a block or a wall", () => {
    const far = line(13);
    cast(far);
    run(far, 11 * PATRONUS_TICKS_PER_TILE);
    expect(player(far, "p2").stun).toBeGreaterThan(0);
    expect(far.blasts[0]).toMatchObject({ kind: "patronus", length: 11 });
    const blocked = line(6);
    setTile(blocked, 4, 5, Tile.Block);
    cast(blocked);
    run(blocked, 6 * PATRONUS_TICKS_PER_TILE);
    expect(player(blocked, "p2").stun).toBe(0);
  });

  it("leaps over bombs", () => {
    const s = line(5);
    placePlayerAt(s, "p2", 4, 5);
    placeBomb(s, "p2");
    placePlayerAt(s, "p2", 5, 5);
    cast(s);
    run(s, 3 * PATRONUS_TICKS_PER_TILE);
    expect(player(s, "p2").stun).toBeGreaterThan(0);
  });

  it("leaves a patronus blast as long as the stag ran, for clients to draw", () => {
    const s = line(9);
    setTile(s, 6, 5, Tile.Block);
    cast(s);
    expect(s.blasts).toEqual([expect.objectContaining({ ownerId: "p1", dir: "right", length: 3, kind: "patronus" })]);
  });

  it(`recharges for ${PATRONUS_COOLDOWN / TICK_RATE} seconds (it reaches far)`, () => {
    const s = line(9);
    cast(s);
    expect(player(s).specialCooldown).toBe(PATRONUS_COOLDOWN);
  });

  it("a captain's shield facing it stops the stag there, and nobody behind him is touched", () => {
    const s = createMatch({ seed: 1, playerIds: ["p1", "p2", "p3"], blockDensity: 0, characters: { p1: "harry", p2: "captain" } });
    placePlayerAt(s, "p1", 2, 5);
    placePlayerAt(s, "p2", 4, 5);
    placePlayerAt(s, "p3", 6, 5);
    player(s).facing = "right";
    player(s, "p2").facing = "left";
    player(s, "p2").shield = SHIELD_TICKS;
    cast(s);
    run(s, 5 * PATRONUS_TICKS_PER_TILE);
    expect(player(s, "p2").stun).toBe(0);
    expect(player(s, "p3").stun).toBe(0);
    expect(s.blasts[0]).toMatchObject({ kind: "patronus", length: 2 });
  });
});
