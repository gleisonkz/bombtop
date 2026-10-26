import { describe, expect, it, vi } from "vitest";
import { TICK_RATE } from "@bombtop/shared";
import type { Graphics } from "pixi.js";

vi.mock("pixi.js", () => ({
  Assets: { load: vi.fn(async () => ({ source: { scaleMode: "nearest" } })) },
  Container: class { addChild() {} },
  Rectangle: class {},
  Texture: class {},
  Sprite: class {
    anchor = { set() {} };
    position = { set() {} };
    visible = true;
    alpha = 1;
    width = 0;
    height = 0;
    rotation = 0;
  },
}));

import { WebEffects } from "../src/render/web-effects";

describe("web cocoon", () => {
  it.each([[80, 0], [-80, 0], [0, 80], [0, -80]])("draws a shot in direction %j", async (x1, y1) => {
    const effect = new WebEffects();
    const added: { rotation: number; visible: boolean }[] = [];
    vi.spyOn(effect.root, "addChild").mockImplementation((sprite) => {
      added.push(sprite as unknown as typeof added[number]);
      return sprite;
    });
    const rect = vi.fn();
    const fill = vi.fn();
    const graphics = { rect, fill } as unknown as Graphics;
    rect.mockReturnValue(graphics);
    fill.mockReturnValue(graphics);
    await effect.load();
    effect.drawShot(graphics, { x0: 0, y0: 0, x1, y1, age: 19, alpha: 1 });
    expect(added).toHaveLength(0);
    effect.drawShot(graphics, { x0: 0, y0: 0, x1, y1, age: 27, alpha: 1 });
    expect(added[0]!.rotation).toBe(Math.atan2(y1, x1));
    expect(rect).toHaveBeenCalled();
    effect.beginFrame();
    effect.drawShot(graphics, { x0: 0, y0: 0, x1, y1, age: 28, alpha: 1 });
    expect(added).toHaveLength(1);
    expect(added[0]!.rotation).toBe(0);
    effect.beginFrame();
    expect(added[0]!.visible).toBe(false);
  });
  it("uses fallback until the transparent texture loads", async () => {
    const effect = new WebEffects();
    const pose = { x: 8, feet: 14, bodyH: 24, remaining: 4 * TICK_RATE, tick: 10 };
    expect(effect.draw(pose)).toBe(false);
    await effect.load();
    expect(effect.draw(pose)).toBe(true);
  });

  it("reuses sprites, fades on release and hides them after escape", async () => {
    const effect = new WebEffects();
    const added: { visible: boolean; alpha: number; width: number }[] = [];
    vi.spyOn(effect.root, "addChild").mockImplementation((sprite) => {
      added.push(sprite as unknown as typeof added[number]);
      return sprite;
    });
    await effect.load();
    const pose = { x: 8, feet: 14, bodyH: 24, remaining: 4 * TICK_RATE, tick: 10 };
    effect.draw(pose);
    const width = added[0]!.width;
    effect.beginFrame();
    effect.draw({ ...pose, remaining: TICK_RATE / 2 });
    expect(added).toHaveLength(1);
    expect(added[0]!.alpha).toBeCloseTo(0.5);
    expect(added[0]!.width).toBeGreaterThan(width);
    effect.beginFrame();
    expect(added[0]!.visible).toBe(false);
  });
});

vi.mock("../src/render/special-palette", async () => {
  const { Texture } = await import("pixi.js");
  const cache = new WeakMap<object, Map<number, InstanceType<typeof Texture>>>();
  return {
    specialInk: (original: number, color?: number | null) => color ?? original,
    specialTexture: (texture: InstanceType<typeof Texture>, color?: number | null) => {
      if (color == null) return texture;
      let colors = cache.get(texture);
      if (!colors) { colors = new Map(); cache.set(texture, colors); }
      if (!colors.has(color)) colors.set(color, new Texture({ source: texture.source, frame: texture.frame }));
      return colors.get(color)!;
    },
  };
});

it("keeps simultaneous colors independent and restores pooled original textures", async () => {
  const fx = new WebEffects();
  const added: { texture: unknown; tint: number }[] = [];
  vi.spyOn(fx.root, "addChild").mockImplementation((sprite) => {
    if (!added.includes(sprite as unknown as typeof added[number])) added.push(sprite as unknown as typeof added[number]);
    return sprite;
  });
  await fx.load();
  const draw = (color?: number | null) => fx.draw({ x: 0, feet: 0, bodyH: 24, remaining: 120, tick: 0, color });
  draw();
  const original = added[0]!.texture;
  fx.beginFrame();
  draw(0xff0000);
  const red = added[0]!.texture;
  expect(red).not.toBe(original);
  draw(0x00ff00);
  const second = added[added.length / 2]!;
  expect(second.texture).not.toBe(red);
  expect(added[0]!.texture).toBe(red);
  added[0]!.tint = 0x222222;
  fx.beginFrame();
  draw(null);
  expect(added[0]!.texture).toBe(original);
  expect(added[0]!.tint).toBe(0xffffff);
});
it("passes explicit shot color to the projectile and procedural silk", async () => {
  const fx = new WebEffects();
  const added: { texture: unknown }[] = [];
  vi.spyOn(fx.root, "addChild").mockImplementation(sprite => { added.push(sprite as unknown as typeof added[number]); return sprite; });
  const graphics = { rect: vi.fn(), fill: vi.fn() };
  graphics.rect.mockReturnValue(graphics);
  graphics.fill.mockReturnValue(graphics);
  await fx.load();
  const pose = { x0: 0, y0: 0, x1: 80, y1: 0, age: 27, alpha: 1 };
  fx.drawShot(graphics as unknown as Graphics, pose);
  const original = added[0]!.texture;
  graphics.fill.mockClear();
  fx.beginFrame();
  fx.drawShot(graphics as unknown as Graphics, { ...pose, color: 0xff0000 });
  expect(added[0]!.texture).not.toBe(original);
  expect(graphics.fill.mock.calls.every(([ink]) => ink.color === 0xff0000)).toBe(true);
  fx.beginFrame();
  fx.drawShot(graphics as unknown as Graphics, pose);
  expect(added[0]!.texture).toBe(original);
});
