import { beforeEach, describe, expect, it, vi } from "vitest";
import { Sprite } from "pixi.js";

const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("pixi.js", async importOriginal => {
  const actual = await importOriginal<typeof import("pixi.js")>();
  return { ...actual, Assets: { load: mocks.load } };
});
import { CompanionPixelEffects } from "../src/render/companion-pixel-effects";
import { Texture, TextureSource } from "pixi.js";

beforeEach(() => {
  mocks.load.mockReset();
  mocks.load.mockResolvedValue(new Texture({ source: new TextureSource({ width: 256, height: 448 }) }));
});

describe("companion pixel effects", () => {
  it("keeps tunnel art in the floor layer when a sprite changes responsibility", async () => {
    const effects = new CompanionPixelEffects();
    await effects.load();
    effects.draw("tunnel", { x: 24, y: 24, tick: 0, size: 18 });
    expect(effects.ground.children).toHaveLength(1);
    expect(effects.root.children).toHaveLength(0);
    const sprite = effects.ground.children[0];
    effects.beginFrame();
    effects.draw("heart", { x: 24, y: 24, tick: 0 });
    expect(effects.ground.children).toHaveLength(0);
    expect(effects.root.children[0]).toBe(sprite);
  });
  it("allows primitive fallback and retries unavailable assets", async () => {
    const effects = new CompanionPixelEffects();
    expect(effects.draw("heart", { x: 0, y: 0, tick: 0 })).toBe(false);
    mocks.load.mockRejectedValueOnce(new Error("missing"));
    await effects.load();
    expect(effects.draw("heart", { x: 0, y: 0, tick: 0 })).toBe(false);
    await Promise.all([effects.load(), effects.load()]);
    await effects.load();
    expect(mocks.load).toHaveBeenCalledTimes(2);
    expect(effects.draw("heart", { x: 0, y: 0, tick: 0 })).toBe(true);
  });

  it("selects every row and advances at six simulation ticks", async () => {
    const effects = new CompanionPixelEffects();
    await effects.load();
    for (const [row, kind] of (["heart", "tunnel", "spin", "speed", "smoke", "stun", "mound"] as const).entries()) {
      for (const [tick, frame] of [[0, 0], [5, 0], [6, 1], [18, 3], [24, 0], [-1, 0], [NaN, 0], [Infinity, 0]] as const) {
        effects.beginFrame();
        effects.draw(kind, { x: 1, y: 2, tick });
        const layer = kind === "tunnel" || kind === "mound" ? effects.ground : effects.root;
        const sprite = layer.children[0] as Sprite;
        expect(sprite.texture.frame.x).toBe(frame! * 64);
        expect(sprite.texture.frame.y).toBe(row * 64);
        expect(sprite.texture.source.scaleMode).toBe("nearest");
      }
    }
  });

  it("reuses sprites without leaking pose, tint, scale or anchor state", async () => {
    const effects = new CompanionPixelEffects();
    await effects.load();
    effects.draw("spin", { x: 5.4, y: 8.6, tick: 0, size: 32, alpha: 0.2, rotation: 1 });
    effects.draw("smoke", { x: 4, y: 9, tick: 6 });
    const sprite = effects.root.children[0] as Sprite;
    expect(sprite.width).toBe(32);
    expect(sprite.alpha).toBe(0.2);
    expect(sprite.rotation).toBe(1);
    sprite.anchor.set(1); sprite.scale.set(-1); sprite.tint = 0xff0000; sprite.skew.set(1);
    effects.beginFrame();
    expect(effects.root.children.every(child => !child.visible)).toBe(true);
    effects.draw("heart", { x: 10.4, y: 20.7, tick: 0 });
    expect(effects.root.children).toHaveLength(2);
    expect(effects.root.children[0]).toBe(sprite);
    expect(sprite.position.x).toBe(10);
    expect(sprite.position.y).toBe(21);
    expect(sprite.anchor.x).toBe(0.5);
    expect(sprite.scale.x).toBe(16 / 64);
    expect(sprite.scale.y).toBe(16 / 64);
    expect(sprite.alpha).toBe(1);
    expect(sprite.rotation).toBe(0);
    expect(sprite.skew.x).toBe(0);
    expect(sprite.tint).toBe(0xffffff);
    expect(effects.root.children[1]!.visible).toBe(false);
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
  const fx = new CompanionPixelEffects();
  const added: { texture: unknown; tint: number }[] = [];
  vi.spyOn(fx.root, "addChild").mockImplementation((sprite) => {
    if (!added.includes(sprite as unknown as typeof added[number])) added.push(sprite as unknown as typeof added[number]);
    return sprite;
  });
  await fx.load();
  const draw = (color?: number | null) => fx.draw("heart", { x: 0, y: 0, tick: 0, color });
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
