import { describe, expect, it } from "vitest";
import { fitScale } from "../src/render/fit";

describe("fitScale", () => {
  it("fills the limiting side of the screen, fractional sizes included", () => {
    // Phone in landscape: height limits a 208x176 arena.
    expect(fitScale(900, 380, 208, 176)).toBeCloseTo(380 / 176);
  });

  it("uses the width when the screen is tall", () => {
    expect(fitScale(400, 900, 208, 176)).toBeCloseTo(400 / 208);
  });

  it("never shrinks below 1:1", () => {
    expect(fitScale(100, 100, 208, 176)).toBe(1);
  });
});
