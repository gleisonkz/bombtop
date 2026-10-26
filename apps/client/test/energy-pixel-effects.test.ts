import { beforeEach, describe, expect, it, vi } from "vitest";
import { Sprite } from "pixi.js";

const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("pixi.js", () => {
  class Point { x = 0; y = 0; set(x: number, y = x) { this.x = x; this.y = y; } }
  class Container {
    children: unknown[] = [];
    addChild(child: unknown) {
      const node = child as { parent?: Container };
      if (node.parent === this) return;
      if (node.parent) node.parent.children.splice(node.parent.children.indexOf(child), 1);
      node.parent = this;
      this.children.push(child);
    }
  }
  return {
    Assets: { load: mocks.load },
    Container,
    Rectangle: class { constructor(public x: number, public y: number, public width: number, public height: number) {} },
    Texture: class { constructor(public options: unknown) {} },
    Sprite: class { anchor = new Point(); position = new Point(); visible = true; rotation = 0; alpha = 1; width = 0; height = 0; texture: unknown; },
  };
});

import { EnergyPixelEffects } from "../src/render/energy-pixel-effects";

beforeEach(() => { mocks.load.mockReset(); mocks.load.mockResolvedValue({ source: {} }); });

describe("pixel energy effects", () => {
  it("falls back before load, shares concurrent loads and keeps nearest sampling", async () => {
    const effect = new EnergyPixelEffects();
    const pose = { x0: 0, y0: 0, x1: 32, y1: 0, tick: 9, alpha: 1 };
    expect(effect.draw("lightning", pose)).toBe(false);
    await Promise.all([effect.load(), effect.load()]);
    expect(mocks.load).toHaveBeenCalledTimes(2);
    expect((await mocks.load.mock.results[0]!.value).source.scaleMode).toBe("nearest");
    expect(effect.draw("lightning", pose)).toBe(true);
  });

  it.each([[40, 0], [-40, 0], [0, 40], [0, -40]])("fits the electricity to a cardinal path %j", async (x1, y1) => {
    const effect = new EnergyPixelEffects();
    await effect.load();
    effect.draw("lightning", { x0: 0, y0: 0, x1, y1, tick: 8, alpha: 0.5 });
    const sprites = effect.root.children as Sprite[];
    expect(sprites).toHaveLength(4);
    expect(sprites[0]!.rotation).toBe(Math.atan2(y1, x1));
    expect(sprites.at(-1)!.position.x).toBe(x1);
    expect(sprites.at(-1)!.position.y).toBe(y1);
    effect.beginFrame();
    expect(sprites.every(s => !s.visible)).toBe(true);
    effect.aura({ x: 5, y: 6, tick: 4, alpha: 1 });
    expect(effect.root.children.length + effect.behind.children.length).toBe(4);
    expect(sprites[0]!.rotation).toBe(0);
    expect(sprites[0]!.alpha).toBe(1);
    expect(sprites[0]!.position.x).toBe(5);
  });

  it("keeps zero-length and invisible paths quiet", async () => {
    const effect = new EnergyPixelEffects();
    await effect.load();
    effect.draw("magnet", { x0: 0, y0: 0, x1: 0, y1: 0, tick: 0, alpha: 1 });
    effect.draw("lightning", { x0: 0, y0: 0, x1: 20, y1: 0, tick: 0, alpha: 0 });
    expect(effect.root.children).toHaveLength(0);
  });

  it("wraps body auras behind and in front, hiding both layers after the effect ends", async () => {
    const effect = new EnergyPixelEffects();
    await effect.load();
    effect.magnetAura({ x: 32, y: 24, tick: 4, alpha: 1 });
    expect(effect.behind.children).toHaveLength(1);
    expect(effect.root.children).toHaveLength(1);
    expect((effect.behind.children[0] as Sprite).height).toBe(46);
    effect.beginFrame();
    expect((effect.behind.children[0] as Sprite).visible).toBe(false);
    expect((effect.root.children[0] as Sprite).visible).toBe(false);
  });

  it("scales ki beam thickness and its impact together without changing reach", async () => {
    const effect = new EnergyPixelEffects();
    await effect.load();
    effect.draw("ki", { x0: 0, y0: 0, x1: 32, y1: 0, tick: 8, alpha: 1, power: 0.5 });
    const sprites = effect.root.children as Sprite[];
    expect(sprites[0]!.height).toBe(9);
    expect(sprites[0]!.width).toBe(16);
    expect(sprites.at(-1)!.position.x).toBe(32);
    expect(sprites.at(-1)!.width).toBe(8);
  });

  it("shows inward coils on magnetic pulls without exceeding the endpoint", async () => {
    const effect = new EnergyPixelEffects();
    await effect.load();
    effect.draw("magnet", { x0: 8, y0: 8, x1: 72, y1: 8, tick: 12, alpha: 1 });
    const sprites = effect.root.children as Sprite[];
    expect(sprites).toHaveLength(8);
    for (const sprite of sprites) {
      expect(sprite.position.x).toBeGreaterThanOrEqual(8);
      expect(sprite.position.x).toBeLessThanOrEqual(72);
    }
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
  const fx = new EnergyPixelEffects();
  const added: { texture: unknown; tint: number }[] = [];
  vi.spyOn(fx.root, "addChild").mockImplementation((sprite) => {
    if (!added.includes(sprite as unknown as typeof added[number])) added.push(sprite as unknown as typeof added[number]);
    return sprite;
  });
  await fx.load();
  const draw = (color?: number | null) => fx.draw("ki", { x0: 0, y0: 0, x1: 8, y1: 0, tick: 0, alpha: 1, color });
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
it.each(["aura", "magnetAura"] as const)("colors both layers of %s explicitly", async (method) => {
  const fx = new EnergyPixelEffects();
  await fx.load();
  fx[method]({ x: 0, y: 0, tick: 0, alpha: 1 });
  const front = fx.root.children[0] as Sprite;
  const back = fx.behind.children[0] as Sprite;
  const originals = [front.texture, back.texture];
  fx.beginFrame();
  fx[method]({ x: 0, y: 0, tick: 0, alpha: 1, color: 0xff0000 });
  expect(front.texture).not.toBe(originals[0]);
  expect(back.texture).not.toBe(originals[1]);
  fx.beginFrame();
  fx[method]({ x: 0, y: 0, tick: 0, alpha: 1 });
  expect([front.texture, back.texture]).toEqual(originals);
});
