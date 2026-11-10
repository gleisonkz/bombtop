import { describe, expect, it } from "vitest";
import { createMatch, Floor, placeBomb, placePlayerAt, playerTile, step, Tile, type MatchState } from "../src";
import { player, run } from "./helpers";

// SB4 stage 7's arrows (Snes9x, sb4-evidence/seesaw/tools/e_s7_arrow*.py): a bomb kicked over one turns its way;
// a player standing on one, or a bomb resting on one, stays put.
function ambush(): MatchState {
  const s = createMatch({ stage: "sb4-07", seed: 1, playerIds: ["p1", "p2"] });
  s.grid.tiles = s.grid.tiles.map(tile => tile === Tile.Block ? Tile.Empty : tile);
  s.items = [];
  return s;
}
const at = (s: MatchState, x: number, y: number) => s.grid.floor[y * s.grid.width + x];

describe("SB4 stage 7 arrows", () => {
  it("leave a player standing on one where they are", () => {
    const s = ambush();
    expect(at(s, 11, 3)).toBe(Floor.ConveyorDown);
    placePlayerAt(s, "p1", 11, 3);
    const { px, py } = player(s);
    run(s, 60);
    expect([player(s).px, player(s).py]).toEqual([px, py]);
  });

  it("leave a bomb resting on one where it is", () => {
    const s = ambush();
    placePlayerAt(s, "p1", 11, 3);
    placeBomb(s, "p1");
    placePlayerAt(s, "p1", 9, 3);
    run(s, 30);
    expect(s.bombs[0]).toMatchObject({ x: 11, y: 3, slide: null });
  });

  it("turn a bomb kicked over one its way", () => {
    // As e_s7_arrow_kick.py: kicked right from (9, 3), it turns down at (11, 3) and stops on the block at (11, 8).
    const s = createMatch({ stage: "sb4-07", seed: 1, playerIds: ["p1", "p2"] });
    s.items = [];
    for (const [x, y] of [[8, 3], [9, 3], [10, 3], [11, 4]]) s.grid.tiles[y! * 15 + x!] = Tile.Empty;
    s.grid.tiles[8 * 15 + 11] = Tile.Block;
    player(s).canKick = true;
    placePlayerAt(s, "p1", 9, 3);
    placeBomb(s, "p1");
    placePlayerAt(s, "p1", 8, 3);
    for (let i = 0; i < 40 && !s.bombs[0]!.slide; i++) step(s, { p1: { dir: "right", bomb: false } });
    expect(s.bombs[0]!.slide).toBe("right");
    run(s, 80);
    expect(s.bombs[0]).toMatchObject({ x: 11, y: 7, slide: null });
    expect(playerTile(player(s))).toEqual({ x: 8, y: 3 });
  });
});
