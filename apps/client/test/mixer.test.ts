import { describe, expect, it } from "vitest";
import { explosionGain, panFor, VoiceLimiter } from "../src/audio/mixer";

describe("panFor", () => {
  it("maps the arena width to a gentle left-right spread", () => {
    expect(panFor(0, 13)).toBeCloseTo(-0.6);
    expect(panFor(6.5, 13)).toBeCloseTo(0);
    expect(panFor(13, 13)).toBeCloseTo(0.6);
  });

  it("clamps positions outside the arena", () => {
    expect(panFor(-4, 13)).toBeCloseTo(-0.6);
  });
});

describe("explosionGain", () => {
  it("grows with the blast but never doubles", () => {
    expect(explosionGain(1)).toBeCloseTo(0.75);
    expect(explosionGain(5)).toBeGreaterThan(explosionGain(1));
    expect(explosionGain(60)).toBeLessThanOrEqual(1);
  });
});

describe("VoiceLimiter", () => {
  it("lets a sound play a few times at once, then drops extra copies", () => {
    const l = new VoiceLimiter(2, 100);
    expect(l.allow("explode", 0)).toBe(true);
    expect(l.allow("explode", 10)).toBe(true);
    expect(l.allow("explode", 20)).toBe(false);
    expect(l.allow("place", 20)).toBe(true);
  });

  it("frees voices once the window has passed", () => {
    const l = new VoiceLimiter(1, 100);
    expect(l.allow("kick", 0)).toBe(true);
    expect(l.allow("kick", 99)).toBe(false);
    expect(l.allow("kick", 100)).toBe(true);
  });
});
