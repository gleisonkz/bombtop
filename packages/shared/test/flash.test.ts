import { describe, expect, it } from "vitest";
import {
  CHARACTERS,
  createMatch,
  FLASH_RANGE,
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

/** p1 (flash) at (1,5) facing right, the others at the given x in row 5 (row 5 is open from x=1 to 11). */
function race(others: Record<string, number> = {}, kinds: Record<string, "bomb" | "captain"> = {}): MatchState {
  const ids = ["p1", ...Object.keys(others)];
  const s = createMatch({ seed: 1, playerIds: ids, blockDensity: 0, characters: { p1: "flash", ...kinds } });
  placePlayerAt(s, "p1", 1, 5);
  for (const [id, x] of Object.entries(others)) placePlayerAt(s, id, x, 5);
  player(s).facing = "right";
  return s;
}

const cast = (s: MatchState) => step(s, { p1: { dir: null, bomb: false, special: true } });
const at = (s: MatchState, id = "p1") => playerTile(player(s, id));
const dizzy = (s: MatchState, id: string) => player(s, id).stun >= SPECIAL_STUN_TICKS - 1;

describe("flash super speed", () => {
  it("the flash is a playable character", () => {
    expect(CHARACTERS).toContain("flash");
  });

  it(`dashes ${FLASH_RANGE} tiles straight ahead in a blink`, () => {
    const s = race();
    cast(s);
    expect(at(s)).toEqual({ x: 1 + FLASH_RANGE, y: 5 });
  });

  it("runs through every player in his way, leaving each one dizzy", () => {
    const s = race({ p2: 2, p3: 4 });
    cast(s);
    expect(at(s)).toEqual({ x: 1 + FLASH_RANGE, y: 5 });
    expect(dizzy(s, "p2")).toBe(true);
    expect(dizzy(s, "p3")).toBe(true);
    expect(at(s, "p2")).toEqual({ x: 2, y: 5 });
  });

  it("stops short of a block, a bomb or a wall", () => {
    const s = race();
    setTile(s, 4, 5, Tile.Block);
    cast(s);
    expect(at(s)).toEqual({ x: 3, y: 5 });

    const w = race();
    player(w).facing = "left";
    cast(w);
    expect(at(w)).toEqual({ x: 1, y: 5 });
  });

  it("never ends on top of a player: he stops on the last free tile", () => {
    const s = race({ p2: 1 + FLASH_RANGE });
    cast(s);
    expect(at(s)).toEqual({ x: FLASH_RANGE, y: 5 });
    expect(dizzy(s, "p2")).toBe(true);
  });

  it("a raised shield facing him stops him there, and he is the one left dizzy", () => {
    const s = race({ p2: 4 }, { p2: "captain" });
    player(s, "p2").facing = "left";
    player(s, "p2").shield = 60;
    cast(s);
    expect(at(s)).toEqual({ x: 3, y: 5 });
    expect(dizzy(s, "p1")).toBe(true);
    expect(player(s, "p2").stun).toBe(0);
  });

  it("leaves his streak behind for clients to draw", () => {
    const s = race();
    cast(s);
    expect(s.blasts).toEqual([expect.objectContaining({ ownerId: "p1", x: 1, y: 5, dir: "right", length: FLASH_RANGE, kind: "flash" })]);
  });

  it(`recharges for ${SPECIAL_COOLDOWN / 60} seconds`, () => {
    const s = race();
    cast(s);
    expect(player(s).specialCooldown).toBe(SPECIAL_COOLDOWN);
  });
});
