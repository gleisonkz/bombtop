import { describe, expect, it } from "vitest";
import {
  CHARACTERS,
  createMatch,
  placeBomb,
  placePlayerAt,
  setTile,
  SHIELD_TICKS,
  SPECIAL_COOLDOWN,
  SPECIAL_STUN_TICKS,
  step,
  THUNDER_RANGE,
  Tile,
  type MatchState,
} from "../src";
import { player } from "./helpers";

/** p1 (pikachu) at (5,5); the others placed by each test, out of the way until then. */
function arena(others: Record<string, "bomb" | "captain"> = { p2: "bomb" }): MatchState {
  const ids = ["p1", ...Object.keys(others)];
  const s = createMatch({ seed: 1, playerIds: ids, blockDensity: 0, characters: { p1: "pikachu", ...others } });
  placePlayerAt(s, "p1", 5, 5);
  for (const id of Object.keys(others)) placePlayerAt(s, id, 1, 9);
  return s;
}

const cast = (s: MatchState) => step(s, { p1: { dir: null, bomb: false, special: true } });
/** Stunned by this tick's shock (the stun may already have ticked once). */
const shocked = (s: MatchState, id: string) => player(s, id).stun >= SPECIAL_STUN_TICKS - 1;

describe("pikachu thunder shock", () => {
  it("pikachu is a playable character", () => {
    expect(CHARACTERS).toContain("pikachu");
  });

  it(`stuns every player up to ${THUNDER_RANGE} tiles away in a cross around him`, () => {
    const s = arena({ p2: "bomb", p3: "bomb", p4: "bomb" });
    placePlayerAt(s, "p2", 5, 5 - THUNDER_RANGE);
    placePlayerAt(s, "p3", 6, 5);
    placePlayerAt(s, "p4", 5, 7); // (5,6) is open, so is (5,7)
    cast(s);
    expect(shocked(s, "p2")).toBe(true);
    expect(shocked(s, "p3")).toBe(true);
    expect(shocked(s, "p4")).toBe(true);
    expect(player(s).stun).toBe(0);
  });

  it("stuns a player sharing his tile", () => {
    const s = arena();
    placePlayerAt(s, "p2", 5, 5);
    cast(s);
    expect(shocked(s, "p2")).toBe(true);
  });

  it("does not reach diagonals or past its range", () => {
    const s = arena({ p2: "bomb", p3: "bomb" });
    placePlayerAt(s, "p2", 7, 7);
    placePlayerAt(s, "p3", 5 + THUNDER_RANGE + 1, 5);
    cast(s);
    expect(player(s, "p2").stun).toBe(0);
    expect(player(s, "p3").stun).toBe(0);
  });

  it("walls, blocks and bombs stop an arm", () => {
    const s = arena({ p2: "bomb", p3: "bomb", p4: "bomb" });
    setTile(s, 6, 5, Tile.Block);
    placePlayerAt(s, "p2", 7, 5);
    placePlayerAt(s, "p3", 5, 3); // (5,4) is open: put a bomb there
    placePlayerAt(s, "p4", 5, 4);
    placeBomb(s, "p4");
    placePlayerAt(s, "p4", 1, 9);
    cast(s);
    expect(player(s, "p2").stun).toBe(0);
    expect(player(s, "p3").stun).toBe(0);
    expect(s.grid.tiles[5 * s.grid.width + 6]).toBe(Tile.Block); // it does not break blocks
  });

  it("leaves one blast per arm for clients to draw", () => {
    const s = arena();
    setTile(s, 6, 5, Tile.Block);
    cast(s);
    const arms = Object.fromEntries(s.blasts.map((b) => [b.dir, b.length]));
    expect(s.blasts.every((b) => b.kind === "thunder" && b.ownerId === "p1" && b.x === 5 && b.y === 5)).toBe(true);
    expect(arms).toEqual({ up: THUNDER_RANGE, down: THUNDER_RANGE, left: THUNDER_RANGE, right: 0 });
  });

  it("a raised shield facing him stops that arm and sends the shock back at him", () => {
    const s = arena({ p2: "captain" });
    placePlayerAt(s, "p2", 6, 5);
    player(s, "p2").facing = "left";
    player(s, "p2").shield = SHIELD_TICKS;
    cast(s);
    expect(player(s, "p2").stun).toBe(0);
    expect(player(s).stun).toBe(SPECIAL_STUN_TICKS);
  });

  it("a shield facing away does not save the captain", () => {
    const s = arena({ p2: "captain" });
    placePlayerAt(s, "p2", 6, 5);
    player(s, "p2").facing = "right";
    player(s, "p2").shield = SHIELD_TICKS;
    cast(s);
    expect(shocked(s, "p2")).toBe(true);
  });

  it(`recharges for ${SPECIAL_COOLDOWN / 60} seconds`, () => {
    const s = arena();
    cast(s);
    expect(player(s).specialCooldown).toBe(SPECIAL_COOLDOWN);
  });
});
