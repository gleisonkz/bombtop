import { describe, expect, it, vi } from "vitest";
import { Bot, Floor, FUSE_TICKS, placePlayerAt, Tile, TILE, CONVEYOR_SPEED } from "../src";
import * as slides from "../src/kick";
import { emptyMatch } from "./helpers";

describe("bot conveyor threats", () => {
  it("leaves a tile threatened only after a bomb travels around a belt corner", () => {
    const s = emptyMatch();
    const bot = new Bot("p1", "medium", "collector", 5);
    s.grid.tiles.fill(Tile.Wall);
    bot.input(s);
    s.tick++;
    s.grid.tiles.fill(Tile.Empty);
    placePlayerAt(s, "p1", 7, 6);
    placePlayerAt(s, "p2", 11, 9);
    s.grid.floor[5 * s.grid.width + 5] = Floor.ConveyorRight;
    s.grid.floor[5 * s.grid.width + 6] = Floor.ConveyorDown;
    s.bombs.push({ ownerId: "p2", x: 5, y: 5, fuse: FUSE_TICKS, range: 1, type: "normal", slide: null, offset: 0, air: null, heldBy: null });
    const before = structuredClone(s);
    const input = bot.input(s);
    expect(input.dir).not.toBeNull();
    expect(input.bomb).toBe(false);
    expect(s).toEqual(before);
  });

  it.each([false, true])("checks transported origins of a proposed bomb (belt: %s)", (belt) => {
    const s = emptyMatch();
    s.grid.tiles.fill(Tile.Wall);
    for (const [x, y] of [[5, 5], [6, 5], [6, 6]]) s.grid.tiles[y! * s.grid.width + x!] = Tile.Empty;
    s.grid.tiles[5 * s.grid.width + 4] = Tile.Block;
    placePlayerAt(s, "p1", 5, 5);
    s.players[0]!.fireRange = 1;
    s.players[0]!.specialCooldown = FUSE_TICKS;
    if (belt) {
      s.grid.floor[5 * s.grid.width + 5] = Floor.ConveyorRight;
      s.grid.floor[5 * s.grid.width + 6] = Floor.ConveyorDown;
    }
    expect(new Bot("p1", "hard").input(s).bomb).toBe(!belt);
  });

  it("does not project transport past a short remaining fuse", () => {
    const s = emptyMatch();
    s.grid.tiles.fill(Tile.Wall);
    const bot = new Bot("p1", "medium", "collector", 5);
    bot.input(s);
    s.tick++;
    s.grid.tiles.fill(Tile.Empty);
    placePlayerAt(s, "p1", 6, 7);
    s.grid.floor[5 * s.grid.width + 5] = Floor.ConveyorRight;
    s.grid.floor[5 * s.grid.width + 6] = Floor.ConveyorDown;
    s.bombs.push({ ownerId: "p2", x: 5, y: 5, fuse: TILE / CONVEYOR_SPEED - 1, range: 1, type: "normal", slide: null, offset: 0, air: null, heldBy: null });
    expect(bot.input(s).dir).toBeNull();
  });

  it.each([false, true])("bounds cyclic transport with an oversized fuse and skips classic forecasts (belt: %s)", (belt) => {
    const s = emptyMatch();
    s.grid.tiles.fill(Tile.Empty);
    placePlayerAt(s, "p1", 5, 5);
    if (belt) {
      s.grid.floor[5 * s.grid.width + 5] = Floor.ConveyorRight;
      s.grid.floor[5 * s.grid.width + 6] = Floor.ConveyorDown;
      s.grid.floor[6 * s.grid.width + 6] = Floor.ConveyorLeft;
      s.grid.floor[6 * s.grid.width + 5] = Floor.ConveyorUp;
    }
    s.bombs.push({ ownerId: "p2", x: 5, y: 5, fuse: Number.MAX_SAFE_INTEGER, range: 1, type: "normal", slide: null, offset: 0, air: null, heldBy: null });
    const forecast = vi.spyOn(slides, "updateSlides");
    try {
      new Bot("p1", "hard").input(s);
      expect(forecast.mock.calls.length).toBe(belt ? FUSE_TICKS : 0);
    } finally {
      forecast.mockRestore();
    }
  });
});
