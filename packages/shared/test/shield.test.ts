import { describe, expect, it } from "vitest";
import {
  createMatch,
  FUSE_TICKS,
  placeBomb,
  placePlayerAt,
  setTile,
  SHIELD_TICKS,
  SPECIAL_COOLDOWN,
  SPECIAL_STUN_TICKS,
  step,
  Tile,
  type Facing,
  type MatchState,
} from "../src";
import { hold, player, run } from "./helpers";

/** Captain (p1) at (7,5) facing `facing`; p2 (a bomb) and p3 (thor) parked out of the way. */
function arena(facing: Facing = "left"): MatchState {
  const s = createMatch({
    seed: 1,
    playerIds: ["p1", "p2", "p3"],
    blockDensity: 0,
    characters: { p1: "captain", p2: "bomb", p3: "thor" },
  });
  placePlayerAt(s, "p1", 7, 5);
  placePlayerAt(s, "p2", 1, 1);
  placePlayerAt(s, "p3", 11, 9);
  player(s).facing = facing;
  return s;
}

const special = (s: MatchState, id = "p1") => step(s, { [id]: { dir: null, bomb: false, special: true } });

/** p2 drops a bomb of `range` at (x,y) and goes back to its corner. */
function bombAt(s: MatchState, x: number, range: number, y = 5) {
  player(s, "p2").fireRange = range;
  placePlayerAt(s, "p2", x, y);
  placeBomb(s, "p2");
  placePlayerAt(s, "p2", 1, 1);
}

const flameAt = (s: MatchState, x: number, y: number) => s.flames.find((f) => f.x === x && f.y === y);

describe("captain shield", () => {
  it(`raises the shield for ${SHIELD_TICKS / 60} s and recharges for ${SPECIAL_COOLDOWN / 60} s`, () => {
    const s = arena();
    special(s);
    expect(player(s).shield).toBe(SHIELD_TICKS);
    expect(SHIELD_TICKS).toBe(3 * 60);
    expect(player(s).specialCooldown).toBe(SPECIAL_COOLDOWN);
    run(s, SHIELD_TICKS);
    expect(player(s).shield).toBe(0);
  });

  it("plants him: no walking, turning or bombs while the shield is up", () => {
    const s = arena("left");
    special(s);
    const { px, py } = player(s);
    run(s, 30, { p1: { dir: "right", bomb: true } });
    expect(player(s)).toMatchObject({ px, py, facing: "left" });
    expect(s.bombs).toHaveLength(0);
    run(s, SHIELD_TICKS);
    hold(s, "right", 10);
    expect(player(s).px).toBeGreaterThan(px);
  });

  it("only the captain has it", () => {
    const s = arena();
    special(s, "p2");
    expect(player(s, "p2").shield).toBe(0);
  });

  it("stops fire coming at the shield: he lives and the tiles behind him stay clear", () => {
    const s = arena("left");
    bombAt(s, 5, 4);
    special(s);
    run(s, FUSE_TICKS);
    expect(player(s).alive).toBe(true);
    expect(flameAt(s, 6, 5)).toBeDefined();
    expect(flameAt(s, 7, 5)).toBeUndefined();
    expect(flameAt(s, 8, 5)).toBeUndefined();
  });

  it("keeps a player standing behind him safe", () => {
    const s = arena("left");
    placePlayerAt(s, "p3", 8, 5);
    bombAt(s, 5, 4);
    special(s);
    run(s, FUSE_TICKS);
    expect(player(s, "p3").alive).toBe(true);
  });

  it("still burns in fire from the sides or from behind", () => {
    const behind = arena("left");
    bombAt(behind, 9, 3);
    special(behind);
    run(behind, FUSE_TICKS);
    expect(player(behind).alive).toBe(false);

    const side = arena("left");
    bombAt(side, 7, 3, 3);
    special(side);
    run(side, FUSE_TICKS);
    expect(player(side).alive).toBe(false);
  });

  it("reflects the fire: the bomb's far side burns twice as far, and those flames are his", () => {
    const s = arena("left");
    bombAt(s, 5, 2);
    special(s);
    run(s, FUSE_TICKS);
    // Normal far arm: (4,5) and (3,5). The reflection carries it on to (2,5) and (1,5).
    expect(flameAt(s, 3, 5)?.ownerId).toBe("p2");
    expect(flameAt(s, 2, 5)?.ownerId).toBe("p1");
    expect(flameAt(s, 1, 5)?.ownerId).toBe("p1");
  });

  it("the reflection stops where the far arm stopped (a block, a wall)", () => {
    const s = arena("left");
    bombAt(s, 5, 1);
    setTile(s, 4, 5, Tile.Block); // right behind the bomb
    special(s);
    run(s, FUSE_TICKS);
    expect(flameAt(s, 4, 5)).toBeDefined();
    expect(flameAt(s, 3, 5)).toBeUndefined();
  });

  it("does nothing once the shield is down", () => {
    const s = arena("left");
    special(s);
    run(s, SHIELD_TICKS);
    bombAt(s, 5, 4);
    run(s, FUSE_TICKS);
    expect(player(s).alive).toBe(false);
  });
});

describe("captain shield vs thor's lightning", () => {
  /** Thor (p3) at (2,5) facing right, captain at (5,5) with the shield up. */
  function standoff(captainFacing: Facing) {
    const s = arena(captainFacing);
    placePlayerAt(s, "p1", 5, 5);
    placePlayerAt(s, "p3", 2, 5);
    player(s, "p3").facing = "right";
    special(s);
    return s;
  }

  it("bounces a blast hitting the shield back at whoever is in its way", () => {
    const s = standoff("left");
    special(s, "p3");
    expect(player(s).stun).toBe(0);
    expect(player(s, "p3").stun).toBe(SPECIAL_STUN_TICKS);
    expect(s.blasts).toEqual([
      expect.objectContaining({ ownerId: "p3", x: 2, y: 5, dir: "right", length: 3 }),
      expect.objectContaining({ ownerId: "p1", x: 5, y: 5, dir: "left", length: 3 }),
    ]);
  });

  it("is stunned like anyone else when the blast comes from the side or behind", () => {
    const s = standoff("right");
    special(s, "p3");
    expect(player(s).stun).toBeGreaterThanOrEqual(SPECIAL_STUN_TICKS - 1);
  });
});
