import { describe, expect, it } from "vitest";
import { AIR_TICKS_PER_TILE } from "@bombtop/shared";
import { airLift, airStep, BOUNCE_HEIGHT, PUNCH_HEIGHT } from "../src/render/air-arc";

const air = (span: number, tilesLeft: number, progress: number) => ({ dir: "right" as const, span, tilesLeft, progress });

describe("airLift", () => {
  it("rises from the ground to its peak halfway through a punch's three tiles", () => {
    expect(airLift(air(3, 3, 0))).toBeCloseTo(0);
    const half = Math.floor(AIR_TICKS_PER_TILE / 2);
    expect(airLift(air(3, 2, half))).toBeCloseTo(PUNCH_HEIGHT * Math.sin((Math.PI * (1 + half / AIR_TICKS_PER_TILE)) / 3));
  });

  it("is one arc across the tiles, not a hop per tile", () => {
    expect(airLift(air(3, 2, 0))).toBeGreaterThan(PUNCH_HEIGHT * 0.8);
    expect(airLift(air(3, 1, 0))).toBeGreaterThan(PUNCH_HEIGHT * 0.8);
  });

  it("bounces are small hops", () => {
    const top = airLift(air(1, 1, AIR_TICKS_PER_TILE / 2));
    expect(top).toBeCloseTo(BOUNCE_HEIGHT);
    expect(BOUNCE_HEIGHT).toBeLessThan(PUNCH_HEIGHT / 2);
  });

  // e-bomb-on-launch-end: 6 tiles in 12 frames, y 79 -> 52 (27 px) at the top; bounces 79 -> 73 (6 px).
  it("draws a seesaw's throw at its own pace and height", () => {
    const thrown = { dir: "right" as const, span: 6, tilesLeft: 3, progress: 0, ticksPerTile: 2, seesaw: true as const };
    expect(airStep(thrown)).toBe(0);
    expect(airStep({ ...thrown, progress: 1 })).toBe(0.5);
    expect(airStep({ ...thrown, progress: -1 })).toBe(0);
    expect(airLift(thrown)).toBeCloseTo(27);
    expect(airLift({ ...thrown, span: 1, tilesLeft: 1, ticksPerTile: 8, progress: 4 })).toBeCloseTo(6);
    expect(airStep({ dir: "left", span: 3, tilesLeft: 3, progress: 3 })).toBe(3 / AIR_TICKS_PER_TILE);
  });
});
