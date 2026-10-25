import { describe, expect, it } from "vitest";
import { SCORE_SLOT, scoreSlots } from "../src/render/score-bar";

const WIDTH = 15 * 16;

describe("score bar over the arena", () => {
  it("splits the players around the clock in the middle, in seat order from left to right", () => {
    const xs = scoreSlots(5, WIDTH);
    expect(xs).toHaveLength(5);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    expect(xs.filter((x) => x < WIDTH / 2)).toHaveLength(3);
    for (const x of xs) expect(Math.abs(x - WIDTH / 2)).toBeGreaterThanOrEqual(32 + SCORE_SLOT / 2); // clear of the clock
  });

  it("keeps every slot on the arena and apart", () => {
    for (let n = 1; n <= 5; n++) {
      const xs = scoreSlots(n, WIDTH);
      for (const x of xs) {
        expect(x - SCORE_SLOT / 2).toBeGreaterThanOrEqual(0);
        expect(x + SCORE_SLOT / 2).toBeLessThanOrEqual(WIDTH);
      }
      for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBeGreaterThanOrEqual(SCORE_SLOT);
    }
  });

  it("two players face off from either side of the clock", () => {
    const [a, b] = scoreSlots(2, WIDTH);
    expect(WIDTH / 2 - a!).toBe(b! - WIDTH / 2);
  });
});
