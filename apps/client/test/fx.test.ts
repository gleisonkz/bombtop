import { describe, expect, it } from "vitest";
import { Fx } from "../src/render/fx";

const flame = (x: number, y: number) => ({ x, y });
const cross = [flame(5, 5), flame(4, 5), flame(6, 5), flame(5, 4), flame(5, 6)];
const noBlocks = () => false;
const count = (fx: Fx, kind: string) => fx.particles.filter((p) => p.kind === kind).length;

describe("Fx", () => {
  it("uses one animated transformation accent instead of square body fragments", () => {
    const fx = new Fx();
    fx.transform(20, 30, 0xe84a4a);
    expect(fx.particles).toHaveLength(1);
    expect(fx.particles[0]).toMatchObject({ kind: "transform", x: 20, y: 30, vx: 0, vy: 0, age: 0, life: 16, color: 0xe84a4a });
    fx.reset();
    fx.transform(20, 30);
    expect(fx.particles[0]!.color).toBe(0xffffff);
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

  it("a robot transformation stays anchored, expires after its four frames, and shakes a little", () => {
    const fx = new Fx();
    fx.transform(40, 50);
    const accent = fx.particles[0]!;
    expect(fx.shake).toBeGreaterThan(0);
    fx.observe([], noBlocks, 0);
    fx.observe([], noBlocks, 15);
    expect(accent).toMatchObject({ x: 40, y: 50, age: 15 });
    expect(fx.particles).toHaveLength(1);
    fx.observe([], noBlocks, 16);
    expect(fx.particles).toHaveLength(0);
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
