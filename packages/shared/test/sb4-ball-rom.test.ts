import { describe, expect, it } from "vitest";
import { createMatch } from "../src/arena";
import { TILE } from "../src/constants";
import { stageFlame, updateStageMechanics } from "../src/stage-mechanics";
import { tileCenter, Tile } from "../src/state";
import { forecastStageBalls } from "../src/stage-balls";
import turnReplays from "./fixtures/sb4-ball-turns.json";

describe("SB4 rolling ball observed ROM motion", () => {
  it.each(turnReplays)("matches 128 native movements and routing order for seed $seed", replay => {
    const s = createMatch({ stage: "sb4-03", seed: 17, playerIds: ["a", "b"], blockDensity: 0 });
    s.grid.tiles.fill(Tile.Wall);
    replay.grid.forEach((row, y) => [...row].forEach((cell, x) => {
      s.grid.tiles[(y + 1) * 15 + x + 1] = cell === "#" ? Tile.Wall : cell === "B" ? Tile.Block : Tile.Empty;
    }));
    const ball = { px: tileCenter(5), py: tileCenter(5), dir: null };
    s.stageState = { balls: [ball] };
    s.rng = replay.seed;
    stageFlame(s, 5, 5, "a", "right");
    expect(s.rng).toBe(replay.nextSeed);
    const before = JSON.stringify(s);
    const forecast = forecastStageBalls(s, 128);
    expect(JSON.stringify(s)).toBe(before);
    replay.positions.forEach(([x, y], tick) => {
      expect(forecast[tick]).toEqual({ x: Math.floor((x! - 8) / 16), y: Math.floor((y! - 24) / 16), ticks: tick });
    });
    for (const point of replay.positions.slice(1)) {
      updateStageMechanics(s);
      expect([ball.px / TILE * 16 + 8, ball.py / TILE * 16 + 24]).toEqual(point);
    }
    expect(ball.dir).toBeNull();
    expect(s.grid.tiles[5 * 15 + 6]).toBe(Tile.Block);
  });
  it("continues away from the bomb in an open corridor and stops after eight segments", () => {
    const s = createMatch({ stage: "sb4-03", seed: 17, playerIds: ["a", "b"], blockDensity: 0 });
    const ball = { px: tileCenter(9), py: tileCenter(5), dir: null };
    s.stageState = { balls: [ball] };
    expect(stageFlame(s, 9, 5, "a", "left")).toBe(true);
    expect(ball.dir).toBe("left");
    updateStageMechanics(s);
    expect(ball.px).toBe(tileCenter(9) - TILE / 16);
    for (let tick = 1; tick < 128; tick++) updateStageMechanics(s);
    expect(ball.px).toBe(tileCenter(1));
    expect(ball.py).toBe(tileCenter(5));
    expect(ball.dir).toBeNull();
    updateStageMechanics(s);
    expect(ball.px).toBe(tileCenter(1));
  });
});
