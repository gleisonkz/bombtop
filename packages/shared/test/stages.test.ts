import { describe, expect, it } from "vitest";
import {
  CONVEYOR_SPEED,
  createMatch,
  Floor,
  getFloor,
  getTile,
  placePlayerAt,
  playerTile,
  Tile,
  type StageId,
} from "../src";
import { center, hold, player, run } from "./helpers";

function stage(id: StageId, blockDensity = 0) {
  return createMatch({ seed: 1, playerIds: ["p1", "p2"], blockDensity, stage: id });
}

describe("stages", () => {
  it("classic has a plain floor", () => {
    const s = stage("classic");
    expect(s.grid.floor.every((f) => f === Floor.Normal)).toBe(true);
  });

  it("conveyor has belts on rows 3 (right) and 7 (left), kept free of blocks", () => {
    const s = stage("conveyor", 1);
    expect(getFloor(s, 5, 3)).toBe(Floor.ConveyorRight);
    expect(getFloor(s, 5, 7)).toBe(Floor.ConveyorLeft);
    for (let x = 1; x <= 11; x++) {
      expect(getTile(s, x, 3)).toBe(Tile.Empty);
      expect(getTile(s, x, 7)).toBe(Tile.Empty);
    }
  });

  it("warp has paired warp tiles kept free of blocks", () => {
    const s = stage("warp", 1);
    expect(s.grid.warps).toHaveLength(4);
    for (const w of s.grid.warps) {
      expect(getFloor(s, w.x, w.y)).toBe(Floor.Warp);
      expect(getTile(s, w.x, w.y)).toBe(Tile.Empty);
    }
  });
});

describe("conveyor belts", () => {
  it("carry players standing on them", () => {
    const s = stage("conveyor");
    placePlayerAt(s, "p1", 5, 3);
    run(s, 1);
    expect(player(s).px).toBe(center(5) + CONVEYOR_SPEED);
    expect(player(s).py).toBe(center(3));
  });

  it("add to the player's own movement", () => {
    const s = stage("conveyor");
    placePlayerAt(s, "p1", 5, 7);
    hold(s, "left", 1);
    expect(player(s).px).toBeLessThan(center(5) - 16);
  });

  it("stop players at walls", () => {
    const s = stage("conveyor");
    placePlayerAt(s, "p1", 9, 3);
    run(s, 200);
    expect(player(s).px).toBe(center(11));
  });
});

describe("warps", () => {
  it("teleport a player to the paired warp", () => {
    const s = stage("warp");
    const [a, b] = s.grid.warps;
    placePlayerAt(s, "p1", a!.x, a!.y);
    run(s, 1);
    expect(playerTile(player(s))).toEqual({ x: b!.x, y: b!.y });
  });

  it("do not bounce the player straight back", () => {
    const s = stage("warp");
    const [a, b] = s.grid.warps;
    placePlayerAt(s, "p1", a!.x, a!.y);
    run(s, 10);
    expect(playerTile(player(s))).toEqual({ x: b!.x, y: b!.y });
  });

  it("work again after stepping off and back on", () => {
    const s = stage("warp");
    const [a, b] = s.grid.warps;
    placePlayerAt(s, "p1", a!.x, a!.y);
    run(s, 1);
    const away = b!.x < 6 ? "right" : "left";
    const back = away === "right" ? "left" : "right";
    hold(s, away, 16); // one tile off the warp
    hold(s, back, 8); // half a tile: just enough to re-enter it (holding longer keeps walking after the warp)
    expect(playerTile(player(s))).toEqual({ x: a!.x, y: a!.y });
  });
});
