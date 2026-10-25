import { describe, expect, it } from "vitest";
import {
  CHARACTERS,
  createMatch,
  placePlayerAt,
  playerTile,
  setTile,
  SPECIAL_COOLDOWN,
  step,
  Tile,
  TUNNEL_RANGE,
  type MatchState,
} from "../src";
import { player } from "./helpers";

/** p1 (bugs) at (1,5) facing right, the others at the given x in row 5 (row 5 is open from x=1 to 11). */
function burrow(others: Record<string, number> = {}): MatchState {
  const ids = ["p1", ...Object.keys(others)];
  const s = createMatch({ seed: 1, playerIds: ids, blockDensity: 0, characters: { p1: "bugs" } });
  placePlayerAt(s, "p1", 1, 5);
  for (const [id, x] of Object.entries(others)) placePlayerAt(s, id, x, 5);
  player(s).facing = "right";
  return s;
}

const cast = (s: MatchState) => step(s, { p1: { dir: null, bomb: false, special: true } });
const at = (s: MatchState, id = "p1") => playerTile(player(s, id));

describe("bugs tunnel", () => {
  it("bugs is a playable character", () => {
    expect(CHARACTERS).toContain("bugs");
  });

  it(`digs in and comes out ${TUNNEL_RANGE} tiles straight ahead`, () => {
    const s = burrow();
    cast(s);
    expect(at(s)).toEqual({ x: 1 + TUNNEL_RANGE, y: 5 });
  });

  it("goes under blocks, walls, bombs and players, leaving them as they were", () => {
    const s = burrow({ p2: 3 });
    setTile(s, 2, 5, Tile.Block);
    setTile(s, 4, 5, Tile.Wall);
    s.bombs.push({ ownerId: "p2", x: 5, y: 5, fuse: 100, range: 2, type: "normal", slide: null, offset: 0, air: null, heldBy: null });
    cast(s);
    expect(at(s)).toEqual({ x: 1 + TUNNEL_RANGE, y: 5 });
    expect(at(s, "p2")).toEqual({ x: 3, y: 5 });
    expect(player(s, "p2").stun).toBe(0);
  });

  it("comes out on the farthest open tile: not in a block, wall, bomb, flame or on a player", () => {
    const s = burrow({ p2: 5 });
    setTile(s, 6, 5, Tile.Block);
    s.flames.push({ x: 4, y: 5, ttl: 30 });
    cast(s);
    expect(at(s)).toEqual({ x: 3, y: 5 });
  });

  it("never digs out of the arena", () => {
    const s = burrow();
    player(s).facing = "left";
    cast(s);
    expect(at(s)).toEqual({ x: 1, y: 5 });
  });

  it("with nowhere to come out he stays put and keeps his special", () => {
    const s = burrow();
    player(s).facing = "left";
    cast(s);
    expect(player(s).specialCooldown).toBe(0);
    expect(s.blasts).toEqual([]);
  });

  it("leaves his tunnel behind for clients to draw", () => {
    const s = burrow();
    cast(s);
    expect(s.blasts).toEqual([expect.objectContaining({ ownerId: "p1", x: 1, y: 5, dir: "right", length: TUNNEL_RANGE, kind: "tunnel" })]);
  });

  it(`recharges for ${SPECIAL_COOLDOWN / 60} seconds`, () => {
    const s = burrow();
    cast(s);
    expect(player(s).specialCooldown).toBe(SPECIAL_COOLDOWN);
  });
});
