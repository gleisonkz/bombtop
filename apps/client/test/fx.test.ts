import { describe, expect, it } from "vitest";
import { Fx } from "../src/render/fx";

const flame = (x: number, y: number) => ({ x, y });
const cross = [flame(5, 5), flame(4, 5), flame(6, 5), flame(5, 4), flame(5, 6)];
const noBlocks = () => false;
const count = (fx: Fx, kind: string) => fx.particles.filter((p) => p.kind === kind).length;

describe("Fx", () => {
  it("uses the selected special palette for transformation debris without altering later originals", () => {
    const fx = new Fx();
    fx.transform(20, 30, 0xe84a4a);
    const colored = fx.particles.filter(p => p.kind === "debris");
    expect(colored.length).toBeGreaterThan(0);
    expect(colored.some(p => ((p.color >> 16) & 255) > (p.color & 255))).toBe(true);
    expect(colored.every(p => ((p.color >> 8) & 255) === (p.color & 255))).toBe(true);
    fx.reset();
    fx.transform(20, 30);
    expect(fx.particles.some(p => (p.color & 255) > ((p.color >> 16) & 255))).toBe(true);
  });
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

  it("puffs a little cloud of smoke at a point, in the color given", () => {
    const fx = new Fx();
    fx.puff(40, 50, 0xff77bb);
    const puffs = fx.particles.filter((p) => p.kind === "smoke");
    expect(puffs.length).toBeGreaterThan(4);
    expect(puffs.every((p) => p.color === 0xff77bb && Math.abs(p.x - 40) < 8 && Math.abs(p.y - 50) < 8)).toBe(true);
  });

  it("a robot turning into a truck (or back) bursts into bits of red, blue and chrome with blue sparks, and shakes a little", () => {
    const fx = new Fx();
    fx.transform(40, 50);
    const bits = fx.particles.filter((p) => p.kind === "debris");
    const sparks = fx.particles.filter((p) => p.kind === "spark");
    expect(bits.length).toBeGreaterThan(6);
    expect(sparks.length).toBeGreaterThan(4);
    expect(new Set(bits.map((p) => p.color)).size).toBeGreaterThan(2);
    expect([...bits, ...sparks].every((p) => Math.abs(p.x - 40) < 10 && Math.abs(p.y - 50) < 10)).toBe(true);
    expect(fx.shake).toBeGreaterThan(0);
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
