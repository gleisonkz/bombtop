import { describe, expect, it } from "vitest";
import { shrinkToFit } from "../src/ui/shrink-to-fit";

describe("shrinkToFit", () => {
  it("shrinks what is wider than the room it has", () => {
    expect(shrinkToFit(880, 770)).toBeCloseTo(770 / 880);
  });

  it("never grows what already fits", () => {
    expect(shrinkToFit(500, 770)).toBe(1);
  });

  it("leaves it alone before it is laid out", () => {
    expect(shrinkToFit(0, 770)).toBe(1);
    expect(shrinkToFit(880, 0)).toBe(1);
  });
});
