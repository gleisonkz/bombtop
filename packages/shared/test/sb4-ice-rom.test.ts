import { describe, expect, it } from "vitest";
import { createMatch } from "../src/arena";
import { TILE } from "../src/constants";
import { Floor, tileCenter } from "../src/state";
import { step } from "../src/step";

// stage06-ice-trajectory.json, right-idle/right-opposite. Normalize native
// settled centers (31,47) to Bombtop tile (1,1)'s center; spawn (32,48)
// is one native pixel beyond that center on each axis.
const native = [[32, 48], [32, 48], [34, 47], [36, 47], [38, 47], [40, 47], [42, 47], [44, 47], [46, 47], [47, 47]];

function arena() {
  const s = createMatch({ stage: "sb4-06", seed: 7, playerIds: ["a", "b"], blockDensity: 0 });
  const p = s.players[0]!;
  p.px = tileCenter(1) + TILE / 16;
  p.py = tileCenter(1) + TILE / 16;
  p.facing = "right";
  s.stageState!.surprise = { [s.grid.width + 1]: { kind: "ice", hits: 1 } };
  s.grid.floor[s.grid.width + 1] = Floor.Surprise;
  s.grid.floor[s.grid.width + 2] = Floor.Normal;
  return { s, p };
}

describe("SB4 one-cell ice trajectory", () => {
  it.each([null, "left"] as const)("matches native movement through the normal next tile with input %s", dir => {
    const { s, p } = arena();
    const samples = [[p.px, p.py]];
    for (let tick = 1; tick <= 9; tick++) {
      step(s, { a: { dir, bomb: false } });
      samples.push([p.px, p.py]);
    }
    const expected = native.map(([x, y]) => [(x! - 7) * TILE / 16, (y! - 23) * TILE / 16]);
    expect(samples).toEqual(expected);
    expect(p.facing).toBe("right");
    step(s, { a: { dir: "left", bomb: false } });
    expect(p.px).toBe(tileCenter(2) - p.speed);
  });

  it("replays an in-flight slide from a serialized snapshot after leaving the ice tile", () => {
    const { s, p } = arena();
    for (let tick = 0; tick < 6; tick++) step(s);
    expect(p.px).toBeGreaterThanOrEqual(2 * TILE);
    const replay = structuredClone(s);
    for (let tick = 0; tick < 3; tick++) {
      step(s); step(replay);
    }
    expect(replay).toEqual(s);
    expect(p.px).toBe(tileCenter(2));
  });

  it("matches the native downward trajectory while UP is held", () => {
    const { s, p } = arena();
    p.facing = "down";
    s.grid.floor[2 * s.grid.width + 1] = Floor.Normal;
    const samples = [[p.px, p.py]];
    for (let tick = 1; tick <= 9; tick++) {
      step(s, { a: { dir: "up", bomb: false } });
      samples.push([p.px, p.py]);
    }
    expect(samples).toEqual(native.map(([x, y]) => [(y! - 23) * TILE / 16, (x! - 7) * TILE / 16]));
    expect(p.facing).toBe("down");
  });

  it.each(["left", "up"] as const)("matches eight native slide updates toward %s from its settled entry pose", dir => {
    const { s, p } = arena();
    const horizontal = dir === "left";
    p.px = tileCenter(horizontal ? 2 : 1);
    p.py = tileCenter(horizontal ? 1 : 2);
    p.facing = dir;
    const index = (horizontal ? 1 : 2) * s.grid.width + (horizontal ? 2 : 1);
    s.grid.floor[s.grid.width + 1] = Floor.Normal;
    s.grid.floor[index] = Floor.Surprise;
    s.stageState!.surprise = { [index]: { kind: "ice", hits: 1 } };
    // Native left/up controls settle one pixel before installing C21D3F.
    // Compare the ice phase starting at that settled pose, not preceding drift.
    step(s);
    const samples = [horizontal ? p.px : p.py];
    for (let tick = 0; tick < 8; tick++) {
      step(s);
      samples.push(horizontal ? p.px : p.py);
    }
    expect(samples).toEqual([47, 45, 43, 41, 39, 37, 35, 33, 31].map(x => (x - 7) * TILE / 16));
  });
});
