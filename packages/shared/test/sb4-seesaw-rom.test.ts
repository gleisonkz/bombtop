import { describe, expect, it } from "vitest";
import { createMatch } from "../src/arena";
import { TILE } from "../src/constants";
import { seesawHopLift } from "../src/stage-seesaw-flight";
import { placePlayerAt, tileCenter, Tile } from "../src/state";
import { step } from "../src/step";

function arena() {
  const s = createMatch({ stage: "sb4-09", seed: 7, playerIds: ["a", "b"], blockDensity: 0 });
  placePlayerAt(s, "a", 5, 3);
  placePlayerAt(s, "b", 3, 3);
  return { s, p: s.players[1]! };
}

describe("SB4 seesaw controlled ROM replay", () => {
  it("starts with opposite inclinations on left and right pairs", () => {
    const { s } = arena();
    expect(s.stageState!.seesaws!.map(({ x, y, raised }) => ({ x, y, raised }))).toEqual([
      { x: 4, y: 3, raised: true }, { x: 10, y: 3, raised: false },
      { x: 4, y: 9, raised: true }, { x: 10, y: 9, raised: false },
    ]);
  });

  it("hops in place, matches native lift, lands on update16 and flips again on17", () => {
    const { s, p } = arena();
    const lift = [];
    const flips = [];
    let previous = s.stageState!.seesaws![0]!.raised;
    for (let tick = 1; tick <= 17; tick++) {
      step(s);
      if (tick <= 16) lift.push(seesawHopLift(s.stageState!.flights?.b));
      expect(p.px).toBe(tileCenter(3));
      expect(p.py).toBe(tileCenter(3));
      const raised = s.stageState!.seesaws![0]!.raised;
      if (raised !== previous) flips.push(tick);
      previous = raised;
    }
    expect(lift).toEqual([0, 0, 0, 0, 6, 10, 13, 15, 16, 16, 16, 15, 13, 10, 6, 0]);
    expect(flips).toEqual([1, 17]);
  });

  it("accepts horizontal input during the hop instead of forcing an outward three-cell throw", () => {
    const { s, p } = arena();
    p.px += TILE / 16; // Native fixture X64, one pixel beyond the settled center63.
    const samples = [p.px];
    for (let tick = 1; tick <= 16; tick++) {
      step(s, tick >= 4 ? { b: { dir: "right", bomb: false } } : {});
      samples.push(p.px);
    }
    expect(samples).toEqual([64,64,64,64,64,64,72,80,88,96,104,112,120,128,136,144,159].map(x => (x - 7) * TILE / 16));
    expect(p.px).toBe(tileCenter(9));
    expect(p.py).toBe(tileCenter(3));
    expect(s.stageState!.flights?.b).toBeUndefined();
    expect(p.px - tileCenter(3)).toBe(6 * TILE);
  });

  it("replays a mid-hop snapshot and locks the first horizontal choice", () => {
    const { s } = arena();
    for (let tick = 1; tick <= 8; tick++) step(s, tick >= 4 ? { b: { dir: "right", bomb: false } } : {});
    const replay = structuredClone(s);
    for (let tick = 9; tick <= 16; tick++) {
      const inputs = { b: { dir: "left" as const, bomb: false } };
      step(s, inputs); step(replay, inputs);
    }
    expect(replay).toEqual(s);
    expect(s.players[1]!.px).toBe(tileCenter(9));
  });

  it("follows the native C22026 edge-rebound arc before landing rather than instantly wrapping", () => {
    const { s, p } = arena();
    p.px += TILE / 16;
    const x = [248,245,242,239,236,234,232,232,232,229,226,223,220,218,216,216,216,213,210,207,204,202,200,200,200,197,194,191,188,186,184,184,191];
    const y = [79,75,73,73,73,75,79,79,79,75,73,73,73,75,79,79,79,75,73,73,73,75,79,79,79,75,73,73,73,75,79,79,79];
    for (let tick = 1; tick <= 48; tick++) {
      step(s, tick >= 4 ? { b: { dir: "left", bomb: false } } : {});
      if (tick < 16) continue;
      const actualX = ((Math.round(p.px / TILE * 16 + 7) % 256) + 256) % 256;
      const actualY = 79 - seesawHopLift(s.stageState?.flights?.b);
      expect([actualX, actualY], `ROM stage09 LEFT update ${tick}`).toEqual([x[tick - 16], y[tick - 16]]);
      expect(s.stageState?.flights?.b?.kind, `active C22026 at update ${tick}`).toBe(tick < 48 ? "seesawRebound" : undefined);
      expect(p.alive).toBe(true);
    }
  });

  it("keeps the C22026 rebound deterministic after an in-flight snapshot", () => {
    const { s, p } = arena();
    p.px += TILE / 16;
    for (let tick = 1; tick <= 26; tick++) step(s, tick >= 4 ? { b: { dir: "left", bomb: false } } : {});
    const resumed = structuredClone(s);
    for (let tick = 27; tick <= 48; tick++) {
      const input = { b: { dir: "left" as const, bomb: false } };
      step(s, input);
      step(resumed, input);
    }
    expect(resumed).toEqual(s);
    expect(s.stageState?.flights?.b).toBeUndefined();
    expect(Math.round(p.px / TILE * 16 + 7)).toBe(191);
  });

  it("rebounds across the right seesaw on its native 8-update crossing arc", () => {
    const { s, p } = arena();
    p.px += TILE / 16;
    const x = [168,171,174,177,180,182,184,184,191];
    const y = [79,75,73,73,73,75,79,79,79];
    for (let tick = 1; tick <= 33; tick++) {
      step(s, tick >= 4 ? { b: { dir: "right", bomb: false } } : {});
      if (tick < 25) continue;
      expect([Math.round(p.px / TILE * 16 + 7), 79 - seesawHopLift(s.stageState?.flights?.b)], `ROM stage09 RIGHT update ${tick}`)
        .toEqual([x[tick - 25], y[tick - 25]]);
      expect(s.stageState?.flights?.b?.kind).toBe(tick < 33 ? "seesawRebound" : undefined);
    }
  });

  it("rebounds inward from the opposite end after wrapping at the left edge", () => {
    const { s, p } = arena();
    p.px += TILE / 16;
    const x = [183,180,177,174,171,169,167,167,159];
    const y = [79,75,73,73,73,75,79,79,79];
    for (let tick = 1; tick <= 64; tick++) {
      step(s, tick >= 4 ? { b: { dir: "left", bomb: false } } : {});
      if (tick < 56) continue;
      expect([Math.round(p.px / TILE * 16 + 7), 79 - seesawHopLift(s.stageState?.flights?.b)], `ROM stage09 LEFT update ${tick}`)
        .toEqual([x[tick - 56], y[tick - 56]]);
      expect(s.stageState?.flights?.b?.kind).toBe(tick < 64 ? "seesawRebound" : undefined);
    }
  });

  it("does not launch a stationary player merely because they stand at the rebound threshold", () => {
    const { s, p } = arena();
    placePlayerAt(s, "a", 7, 5);
    p.px = tileCenter(9) + 9 * TILE / 16;
    step(s);
    expect(s.stageState?.flights?.b).toBeUndefined();
    expect(p.px).toBe(tileCenter(9) + 9 * TILE / 16);
  });

  it("preserves a short rightward rebound through a JSON snapshot", () => {
    const { s, p } = arena();
    p.px += TILE / 16;
    for (let tick = 1; tick <= 29; tick++) step(s, tick >= 4 ? { b: { dir: "right", bomb: false } } : {});
    const restored = JSON.parse(JSON.stringify(s)) as typeof s;
    for (let tick = 30; tick <= 33; tick++) {
      const inputs = { b: { dir: "right" as const, bomb: false } };
      step(s, inputs);
      step(restored, inputs);
    }
    expect(restored).toEqual(s);
    expect(s.stageState?.flights?.b).toBeUndefined();
    expect(Math.round(p.px / TILE * 16 + 7)).toBe(191);
  });

  it("keeps held RIGHT through the second hop, screen wrap and three native rebound arcs", () => {
    const { s, p } = arena();
    for (const x of [1, 2, 6, 7, 8, 12, 13]) s.grid.tiles[3 * s.grid.width + x] = Tile.Block;
    p.px += TILE / 16;
    const positions = new Map<number, [number, number, string | undefined]>([
      [33, [191, 79, undefined]], [50, [191, 79, "seesaw"]],
      [51, [191, 79, "seesaw"]], [54, [199, 73, "seesaw"]],
      [55, [207, 69, "seesaw"]], [63, [271, 69, "seesaw"]],
      [64, [7, 73, "seesaw"]], [65, [15, 79, "seesawRebound"]],
      [66, [18, 75, "seesawRebound"]], [71, [31, 79, "seesawRebound"]],
      [72, [31, 79, "seesawRebound"]], [73, [31, 79, "seesawRebound"]],
      [74, [34, 75, "seesawRebound"]], [79, [47, 79, "seesawRebound"]],
      [80, [47, 79, "seesawRebound"]], [81, [47, 79, "seesawRebound"]],
      [82, [50, 75, "seesawRebound"]], [87, [63, 79, "seesawRebound"]],
      [88, [63, 79, "seesawRebound"]], [89, [63, 79, undefined]],
      [90, [64, 79, undefined]], [98, [72, 79, "seesawRebound"]],
      [106, [95, 79, undefined]],
    ]);
    for (let tick = 1; tick <= 106; tick++) {
      step(s, tick >= 4 ? { b: { dir: "right", bomb: false } } : {});
      const expected = positions.get(tick);
      if (!expected) continue;
      expect([Math.round(p.px / TILE * 16 + 7), 79 - seesawHopLift(s.stageState?.flights?.b), s.stageState?.flights?.b?.kind], `ROM RIGHT update ${tick}`)
        .toEqual(expected);
    }
  });

  it.each([
    { direction: "left" as const, updates: 64, fingerprint: "48a6d3be" },
    { direction: "right" as const, updates: 106, fingerprint: "72ba6312" },
  ])("matches every native position and height in the $direction replay", ({ direction, updates, fingerprint }) => {
    const { s, p } = arena();
    for (const x of [1, 2, 6, 7, 8, 12, 13]) s.grid.tiles[3 * s.grid.width + x] = Tile.Block;
    p.px += TILE / 16;
    let hash = 2166136261;
    for (let tick = 1; tick <= updates; tick++) {
      step(s, tick >= 4 ? { b: { dir: direction, bomb: false } } : {});
      const x = Math.round(p.px / TILE * 16 + 7) & 0xffff;
      const y = 79 - seesawHopLift(s.stageState?.flights?.b);
      hash = Math.imul(hash ^ x, 16777619) >>> 0;
      hash = Math.imul(hash ^ y, 16777619) >>> 0;
      expect(p.alive).toBe(true);
    }
    expect(hash.toString(16)).toBe(fingerprint);
  });

  it("replays a held-direction second launch and screen rebound from the same snapshot", () => {
    const { s, p } = arena();
    for (const x of [1, 2, 6, 7, 8, 12, 13]) s.grid.tiles[3 * s.grid.width + x] = Tile.Block;
    p.px += TILE / 16;
    for (let tick = 1; tick <= 55; tick++) step(s, tick >= 4 ? { b: { dir: "right", bomb: false } } : {});
    expect(s.stageState?.flights?.b).toMatchObject({ kind: "seesaw", preSteered: true, steering: "right" });
    const restored = structuredClone(s);
    for (let tick = 56; tick <= 106; tick++) {
      const input = { b: { dir: "right" as const, bomb: false } };
      step(s, input);
      step(restored, input);
    }
    expect(restored).toEqual(s);
    expect(Math.round(p.px / TILE * 16 + 7)).toBe(95);
  });
});
