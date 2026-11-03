import { describe, expect, it } from "vitest";
import { TICK_RATE } from "@bombtop/shared";
import { MapShowcase, MAP_SHOW_SECONDS } from "../src/game/map-showcase";

describe("map showcase (the map guide's live preview)", () => {
  it("plays a bot match on the chosen map, the whole arena in view", () => {
    const show = new MapShowcase("conveyor");
    expect(show.state.grid.floor).not.toEqual(new MapShowcase("classic").state.grid.floor); // its belts
    expect(show.state.players).toHaveLength(4);
    expect(show.window).toEqual({ x: 0, y: 0, width: show.state.grid.width, height: show.state.grid.height });
    const start = show.state.players.map((p) => [p.px, p.py]);
    for (let i = 0; i < 2 * TICK_RATE; i++) show.advance();
    expect(show.state.players.map((p) => [p.px, p.py])).not.toEqual(start);
  });

  it("starts over after a while, or soon after the round is decided", () => {
    const show = new MapShowcase("classic");
    for (let i = 0; i < MAP_SHOW_SECONDS * TICK_RATE + 1; i++) show.advance();
    expect(show.state.tick).toBeLessThan(MAP_SHOW_SECONDS * TICK_RATE);
  });
});
