import { describe, expect, it } from "vitest";
import { createMatch } from "../src/arena";
import { Bot } from "../src/bot";
import { step } from "../src/step";
import { TILE } from "../src/constants";
import { initializeStageTransport, updateStageTransport } from "../src/stage-transport";
import { Floor, placePlayerAt, playerTile, tileCenter, Tile } from "../src/state";
import centreReplays from "./fixtures/sb4-trolley-centre.json";
import nineRoutes from "./fixtures/sb4-trolley-nine-routes.json";

describe("SB4 trolley controlled ROM replay A", () => {
  it.each(nineRoutes)("runs station $station route $variant through native movement updates", replay => {
    const s = createMatch({ seed: 17, playerIds: ["a", "b"], blockDensity: 0 });
    s.stage = "sb4-11";
    s.rng = replay.stationSeed;
    initializeStageTransport(s);
    const trolley = s.stageState!.trolley!;
    expect(trolley.routeRng).toBe([899, 22475, 44051][replay.station]);
    trolley.routeRng = replay.routeSeed;
    const start = replay.positions[0]!;
    expect([trolley.px / TILE * 16 + 8, trolley.py / TILE * 16 + 24]).toEqual(start);
    Object.assign(s.players[0]!, { px: trolley.px, py: trolley.py });
    for (let tick = 1; tick <= replay.exitTick; tick++) {
      updateStageTransport(s);
      const point = replay.positions[Math.min(Math.max(0, tick - 43), replay.positions.length - 1)]!;
      expect([trolley.px / TILE * 16 + 8, trolley.py / TILE * 16 + 24], `${replay.script} update ${tick}`).toEqual(point);
      if (tick < replay.exitTick) expect(trolley.riderId).toBe("a");
    }
    expect(trolley.riderId).toBeUndefined();
    expect(playerTile(s.players[0]!)).toEqual(replay.exitTile);
  });
  it.each(centreReplays)("matches every cart frame selected by native seed $seed ($script)", replay => {
    const s = createMatch({ stage: "sb4-11", seed: 17, playerIds: ["a", "b"], blockDensity: 0 });
    const trolley = s.stageState!.trolley!;
    Object.assign(trolley, { routeRng: replay.seed });
    placePlayerAt(s, "a", 7, 5);
    for (let tick = 1; tick <= replay.positions.length + 3; tick++) {
      updateStageTransport(s);
      expect(trolley.routeRng).toBe(replay.nextSeed);
      if (tick >= 4) expect([trolley.px / TILE * 16 + 8, trolley.py / TILE * 16 + 24], `seed ${replay.seed} tick ${tick}`).toEqual(replay.positions[tick - 4]);
      if (tick < replay.exitTick) expect(trolley.riderId).toBe("a");
      else expect(trolley.riderId).toBeUndefined();
    }
    expect(playerTile(s.players[0]!)).toEqual(replay.exitTile);
    expect(trolley.riderId).toBeUndefined();
  });
  it("lets a bot leave a corridor before the sampled trolley trajectory arrives", () => {
    const s = createMatch({ stage: "sb4-11", seed: 17, playerIds: ["a", "b"], blockDensity: 0 });
    s.grid.tiles.fill(Tile.Wall);
    for (const [x, y] of [[7, 3], [6, 3], [7, 4], [7, 5]]) s.grid.tiles[y! * 15 + x!] = Tile.Empty;
    placePlayerAt(s, "a", 7, 5);
    placePlayerAt(s, "b", 7, 3);
    Object.assign(s.players[1]!, { bombCapacity: 0, specialCooldown: 9999 });
    s.stageState!.trolley!.routeRng = 24;
    updateStageTransport(s);
    const trolley = s.stageState!.trolley!;
    trolley.phase = "riding";
    const bot = new Bot("b", "hard");
    let escaped = false;
    for (let tick = 0; tick < 30; tick++) {
      step(s, { b: bot.input(s) });
      escaped ||= playerTile(s.players[1]!).x === 6;
    }
    expect(s.players[1]!.alive).toBe(true);
    expect(escaped).toBe(true);
  });
  it("preserves blocks on the track and starts at the measured boarding tile", () => {
    const s = createMatch({ stage: "sb4-11", seed: 17, playerIds: ["a", "b"] });
    expect(s.stageState!.trolley).toMatchObject({ px: tileCenter(7), py: tileCenter(5), dir: "up" });
    expect(s.grid.tiles[1 * 15 + 3]).toBe(Tile.Block);
    expect(s.grid.floor[1 * 15 + 3]).toBe(Floor.Rail);
    expect(s.grid.floor[1 * 15 + 13]).not.toBe(Floor.Rail);
  });

  it("matches measured positions through boarding, rounded turns and disembarking", () => {
    const s = createMatch({ stage: "sb4-11", seed: 17, playerIds: ["a", "b"], blockDensity: 0 });
    initializeStageTransport(s);
    placePlayerAt(s, "a", 7, 5);
    const cart = s.stageState!.trolley!;
    cart.routeRng = 24;
    const checkpoints = new Map<number, [number, number]>([
      [1, [128, 112]], [43, [128, 112]], [44, [128, 110]],
      [73, [128, 52]], [75, [128, 50]], [77, [126, 48]],
      [79, [124, 48]], [123, [36, 48]], [129, [32, 52]],
      [205, [32, 204]], [211, [36, 208]], [223, [60, 208]],
      [259, [92, 176]], [295, [124, 144]], [315, [128, 112]],
    ]);
    for (let tick = 1; tick <= 367; tick++) {
      updateStageTransport(s);
      const expected = checkpoints.get(tick);
      if (expected) {
        expect([cart.px / TILE * 16 + 8, cart.py / TILE * 16 + 24], `ROM frame ${7985 + tick}`).toEqual(expected);
      }
      if (tick < 367) expect(cart.riderId).toBe("a");
    }
    expect(cart.riderId).toBeUndefined();
    expect(playerTile(s.players[0]!)).toEqual({ x: 7, y: 4 });
    expect([cart.px, cart.py]).toEqual([tileCenter(7), tileCenter(5)]);
  });
});
