import { describe, expect, it } from "vitest";
import {
  CHARACTERS,
  createMatch,
  KAME_CHARGE,
  KAME_COOLDOWN,
  KAME_RANGE,
  placeBomb,
  placePlayerAt,
  setTile,
  SHIELD_TICKS,
  SPECIAL_STUN_TICKS,
  step,
  Tile,
  type MatchState,
} from "../src";
import { player, run } from "./helpers";

/** p1 (goku) at (3,5) facing right; p2 (bomb) `gap` tiles in front of him. */
function duel(gap = 2, others: Record<string, "bomb" | "captain"> = {}): MatchState {
  const ids = ["p1", "p2", ...Object.keys(others)];
  const s = createMatch({ seed: 1, playerIds: ids, blockDensity: 0, characters: { p1: "goku", p2: "bomb", ...others } });
  placePlayerAt(s, "p1", 3, 5);
  placePlayerAt(s, "p2", 3 + gap, 5);
  player(s).facing = "right";
  return s;
}

const cast = (s: MatchState, id = "p1") => step(s, { [id]: { dir: null, bomb: false, special: true } });
/** Presses the special and waits out the charge. */
const fire = (s: MatchState) => {
  cast(s);
  run(s, KAME_CHARGE);
};

describe("goku kamehameha", () => {
  it("goku is a playable character", () => {
    expect(CHARACTERS).toContain("goku");
  });

  it("charges first, planted, then fires and stuns the player it hits", () => {
    const s = duel(KAME_RANGE);
    cast(s);
    const goku = player(s);
    expect(goku.charge).toBe(KAME_CHARGE);
    expect(s.blasts).toEqual([]);
    const px = goku.px;
    run(s, KAME_CHARGE - 1, { p1: { dir: "left", bomb: false } });
    expect(goku.px).toBe(px);
    expect(player(s, "p2").stun).toBe(0);
    step(s);
    expect(s.blasts).toEqual([expect.objectContaining({ ownerId: "p1", dir: "right", length: KAME_RANGE, kind: "kamehameha" })]);
    expect(player(s, "p2").stun).toBeGreaterThanOrEqual(SPECIAL_STUN_TICKS - 1); // may already have ticked once
    expect(player(s, "p2").alive).toBe(true);
  });

  it(`reaches ${KAME_RANGE} tiles, no further`, () => {
    const s = duel(KAME_RANGE + 1);
    fire(s);
    expect(player(s, "p2").stun).toBe(0);
  });

  it("blasts through blocks, breaking them", () => {
    const s = duel(3);
    setTile(s, 4, 5, Tile.Block);
    fire(s);
    expect(s.grid.tiles[5 * s.grid.width + 4]).toBe(Tile.Empty);
    expect(player(s, "p2").stun).toBeGreaterThanOrEqual(SPECIAL_STUN_TICKS - 1); // may already have ticked once
  });

  it("stops at walls", () => {
    const s = duel(2);
    placePlayerAt(s, "p1", 2, 5);
    placePlayerAt(s, "p2", 2, 3);
    player(s).facing = "up";
    fire(s); // (2,4) is a pillar
    expect(player(s, "p2").stun).toBe(0);
  });

  it("stops at the first player in its way", () => {
    const s = duel(2, { p3: "bomb" });
    placePlayerAt(s, "p3", 7, 5);
    fire(s);
    expect(player(s, "p2").stun).toBeGreaterThanOrEqual(SPECIAL_STUN_TICKS - 1); // may already have ticked once
    expect(player(s, "p3").stun).toBe(0);
    expect(s.blasts[0]?.length).toBe(2);
  });

  it("does not set off bombs in its way", () => {
    const s = duel(4);
    placePlayerAt(s, "p2", 5, 5);
    placeBomb(s, "p2");
    placePlayerAt(s, "p2", 9, 7);
    fire(s);
    expect(s.bombs).toHaveLength(1);
  });

  it("a captain's shield sends it back at goku, who gets stunned", () => {
    const s = duel(4, { p3: "captain" });
    placePlayerAt(s, "p2", 9, 7);
    placePlayerAt(s, "p3", 6, 5);
    player(s, "p3").facing = "left";
    player(s, "p3").shield = SHIELD_TICKS;
    fire(s);
    expect(player(s, "p3").stun).toBe(0);
    expect(player(s).stun).toBe(SPECIAL_STUN_TICKS);
  });

  it("a stun while charging cancels it", () => {
    const s = duel(2);
    cast(s);
    player(s).stun = 10;
    run(s, KAME_CHARGE + 10);
    expect(s.blasts).toEqual([]);
    expect(player(s, "p2").stun).toBe(0);
  });

  it(`recharges for ${KAME_COOLDOWN / 60} seconds`, () => {
    const s = duel(2);
    cast(s);
    expect(player(s).specialCooldown).toBe(KAME_COOLDOWN);
  });
});
