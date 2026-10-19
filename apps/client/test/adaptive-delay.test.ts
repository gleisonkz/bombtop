import { describe, expect, it } from "vitest";
import { AdaptiveDelay } from "../src/net/adaptive-delay";

/** Feeds arrivals spaced by `gaps` (cycled) for `n` snapshots; returns the delay. */
function feed(d: AdaptiveDelay, gaps: number[], n: number, start = 0): number {
  let t = start;
  for (let i = 0; i < n; i++) {
    t += gaps[i % gaps.length]!;
    d.observe(t);
  }
  return d.ms;
}

describe("AdaptiveDelay", () => {
  it("starts safe, before it knows the network", () => {
    expect(new AdaptiveDelay().ms).toBe(100);
  });

  it("shrinks toward about one snapshot interval on a steady connection", () => {
    const ms = feed(new AdaptiveDelay(), [32, 34, 33], 600);
    expect(ms).toBeGreaterThanOrEqual(40);
    expect(ms).toBeLessThan(60);
  });

  it("keeps more room when snapshots arrive unevenly", () => {
    const steady = feed(new AdaptiveDelay(), [33], 600);
    const jittery = feed(new AdaptiveDelay(), [10, 70, 20, 33, 90, 5], 600);
    expect(jittery).toBeGreaterThan(steady + 30);
    expect(jittery).toBeLessThanOrEqual(150);
  });

  it("never goes past its bounds", () => {
    expect(feed(new AdaptiveDelay(), [400], 300)).toBe(150);
    expect(feed(new AdaptiveDelay(), [1], 3000)).toBe(40);
  });

  it("moves gradually, faster up than down, so the picture never jumps", () => {
    const d = new AdaptiveDelay();
    const settled = feed(d, [33], 600);
    let t = 600 * 33;
    d.observe((t += 400)); // one long stall
    const up = d.ms - settled;
    expect(up).toBeGreaterThan(0);
    expect(up).toBeLessThanOrEqual(10);
    const peak = d.ms;
    feed(d, [33], 1, t);
    expect(peak - d.ms).toBeLessThanOrEqual(1);
  });
});
