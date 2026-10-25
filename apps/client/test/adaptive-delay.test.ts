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
    expect(jittery).toBeLessThanOrEqual(250);
  });

  it("remembers rare stalls (mobile networks) and keeps room for the next one", () => {
    // every ~3 s one snapshot comes 120 ms after the last, then a burst catches up
    const ms = feed(new AdaptiveDelay(), [120, 2, ...Array<number>(88).fill(33)], 900);
    expect(ms).toBeGreaterThanOrEqual(95);
  });

  it("shrinks again once the connection has been steady for a while", () => {
    const d = new AdaptiveDelay();
    const t = 10 * (120 + 2 + 88 * 33); // where the stalls left off
    feed(d, [120, 2, ...Array<number>(88).fill(33)], 900);
    expect(feed(d, [33], 1500, t)).toBeLessThan(60);
  });

  it("never goes past its bounds", () => {
    expect(feed(new AdaptiveDelay(), [400], 300)).toBe(250);
    expect(feed(new AdaptiveDelay(), [1], 3000)).toBe(40);
  });

  it("releases isolated 400 ms spikes within two seconds of steady arrivals", () => {
    const d = new AdaptiveDelay();
    feed(d, [33], 600);
    const recoveredAt = 600 * 33 + 400;
    d.observe(recoveredAt);
    const recovered = feed(d, [33], 60, recoveredAt);
    expect(recovered).toBeLessThan(210);
    expect(feed(d, [33], 600, recoveredAt + 60 * 33)).toBeLessThan(60);
  });

  it("refreshes jitter room for recurring 4G bursts while an isolated spike recovers", () => {
    const isolated = new AdaptiveDelay();
    const recurring = new AdaptiveDelay();
    feed(isolated, [33], 600);
    feed(recurring, [33], 600);
    let t = 600 * 33;
    for (let cycle = 0; cycle < 6; cycle++) {
      for (const gap of [400, 2, ...Array<number>(48).fill(33)]) {
        t += gap;
        recurring.observe(t);
      }
    }
    feed(isolated, [400], 1, 600 * 33);
    feed(isolated, [33], Math.floor((t - 600 * 33 - 400) / 33), 600 * 33 + 400);
    expect(recurring.ms).toBeGreaterThan(isolated.ms + 60);
    expect(recurring.ms).toBeGreaterThan(150);
  });

  it("keeps render time monotonic through compressed arrivals and smooth within bounds", () => {
    const d = new AdaptiveDelay();
    feed(d, [33], 600);
    let t = 600 * 33;
    for (const gap of [400, 0, 0, 1, 2, ...Array<number>(100).fill(33), 600, 0, 2]) {
      const previous = d.ms;
      const renderAt = t - previous;
      t += gap;
      d.observe(t);
      expect(t - d.ms).toBeGreaterThanOrEqual(renderAt);
      expect(d.ms - previous).toBeLessThanOrEqual(Math.min(10, gap));
      expect(previous - d.ms).toBeLessThanOrEqual(1);
      expect(d.ms).toBeGreaterThanOrEqual(40);
      expect(d.ms).toBeLessThanOrEqual(250);
    }
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
