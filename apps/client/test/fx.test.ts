import { describe, expect, it } from "vitest";
import { Fx } from "../src/render/fx";

const flame = (x: number, y: number) => ({ x, y });
const cross = [flame(5, 5), flame(4, 5), flame(6, 5), flame(5, 4), flame(5, 6)];
const noBlocks = () => false;
const count = (fx: Fx, kind: string) => fx.particles.filter((p) => p.kind === kind).length;

describe("Fx", () => {
  it("bursts sparks and shakes the screen when a bomb goes off", () => {
    const fx = new Fx();
    fx.observe(cross, noBlocks, 10);
    expect(count(fx, "spark")).toBeGreaterThan(5);
    expect(fx.shake).toBeGreaterThan(0);
  });

  it("only reacts to flames that just appeared", () => {
    const fx = new Fx();
    fx.observe(cross, noBlocks, 10);
    const sparks = count(fx, "spark");
    fx.observe(cross, noBlocks, 11);
    expect(count(fx, "spark")).toBeLessThanOrEqual(sparks);
  });

  it("throws debris where a block was blown up", () => {
    const fx = new Fx();
    fx.observe([flame(5, 5), flame(6, 5)], (x, y) => x === 6 && y === 5, 10);
    expect(count(fx, "debris")).toBeGreaterThan(2);
    expect(fx.particles.filter((p) => p.kind === "debris").every((p) => Math.abs(p.x - 6.5 * 16) < 16)).toBe(true);
  });

  it("leaves smoke where flames die out", () => {
    const fx = new Fx();
    fx.observe(cross, noBlocks, 10);
    fx.observe([], noBlocks, 40);
    expect(count(fx, "smoke")).toBeGreaterThan(0);
  });

  it("particles move, then fade away; the shake settles", () => {
    const fx = new Fx();
    fx.observe(cross, noBlocks, 10);
    const p = fx.particles[0]!;
    const start = { x: p.x, y: p.y };
    fx.observe(cross, noBlocks, 12);
    expect(p.x !== start.x || p.y !== start.y).toBe(true);
    fx.observe(cross, noBlocks, 400);
    expect(fx.particles).toHaveLength(0);
    expect(fx.shake).toBe(0);
  });

  it("forgets everything on reset (new match)", () => {
    const fx = new Fx();
    fx.observe(cross, noBlocks, 10);
    fx.reset();
    expect(fx.particles).toHaveLength(0);
    fx.observe(cross, noBlocks, 1);
    expect(count(fx, "spark")).toBeGreaterThan(0);
  });
});
