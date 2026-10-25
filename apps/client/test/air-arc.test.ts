import { describe, expect, it } from "vitest";
import { AIR_TICKS_PER_TILE } from "@bombtop/shared";
import { airLift, BOUNCE_HEIGHT, PUNCH_HEIGHT } from "../src/render/air-arc";

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
});
