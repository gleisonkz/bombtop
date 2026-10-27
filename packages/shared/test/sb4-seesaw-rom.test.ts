import { describe, expect, it } from "vitest";
import { createMatch } from "../src/arena";
import { TILE } from "../src/constants";
import { seesawHopLift } from "../src/stage-seesaw-flight";
import { placePlayerAt, tileCenter } from "../src/state";
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
});
