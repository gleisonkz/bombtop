import { afterEach, describe, expect, it, vi } from "vitest";
import { Assets, Sprite, Texture, TextureSource } from "pixi.js";
import { AbilityPixelEffects, ABILITY_PIXEL_EFFECTS, OPTIMUS_PIXEL_EFFECTS } from "../src/render/ability-pixel-effects";

afterEach(() => vi.restoreAllMocks());

function atlas(): Texture {
  return new Texture({ source: new TextureSource({ width: 256, height: 512 }) });
}

describe("ability pixel effects", () => {
  it("loads Optimus's own atlas and advances dust, wake and transformation independently", async () => {
    const base = new Texture({ source: new TextureSource({ width: 256, height: 192 }) });
    const load = vi.spyOn(Assets, "load").mockResolvedValue({ source: base.source });
    const fx = new AbilityPixelEffects(OPTIMUS_PIXEL_EFFECTS);
    await fx.load();
    expect(load).toHaveBeenCalledWith(expect.stringContaining("optimus-effects-pixel-v1.png"));
    for (const [row, kind] of ["truckDust", "truckSpeed", "truckShift"].entries()) {
      for (let frame = 0; frame < 4; frame++) {
        fx.draw(kind as "truckDust" | "truckSpeed" | "truckShift", { x: 30, y: 40, tick: frame * 4, size: 24 });
        const sprite = fx.root.children.at(-1) as Sprite;
        expect(sprite.texture.frame).toMatchObject({ x: frame * 64, y: row * 64, width: 64, height: 64 });
        expect(sprite.width).toBe(24);
        expect(sprite.anchor.y).toBe(kind === "truckShift" ? 0.5 : 62 / 64);
      }
    }
    expect(fx.draw("ki", { x: 0, y: 0, tick: 0 })).toBe(false);
    fx.beginFrame();
    fx.draw("truckDust", { x: 0, y: 0, tick: 0, flipX: true });
    expect((fx.root.children[0] as Sprite).scale.x).toBeLessThan(0);
    expect((fx.root.children[0] as Sprite).scale.y).toBeGreaterThan(0);
    fx.beginFrame();
    fx.draw("truckShift", { x: 0, y: 0, tick: 0 });
    expect((fx.root.children[0] as Sprite).scale.x).toBeGreaterThan(0);
    expect((fx.root.children[0] as Sprite).anchor.y).toBe(0.5);
  });
  it("returns false before load so the renderer can retain its fallback", () => {
    const fx = new AbilityPixelEffects();
    expect(fx.draw("ki", { x: 0, y: 0, tick: 0 })).toBe(false);
    expect(fx.root.children).toHaveLength(0);
  });

  it("loads once and maps every row and all four deterministic frames", async () => {
    const base = atlas();
    const load = vi.spyOn(Assets, "load").mockResolvedValue({ source: base.source });
    const fx = new AbilityPixelEffects();
    await Promise.all([fx.load(), fx.load()]);
    await fx.load();
    expect(load).toHaveBeenCalledTimes(1);
    expect(base.source.scaleMode).toBe("nearest");
    for (const [row, kind] of ABILITY_PIXEL_EFFECTS.kinds.entries()) {
      for (let frame = 0; frame < 4; frame++) {
        fx.draw(kind, { x: 1, y: 2, tick: frame * 5 });
        const sprite = fx.root.children.at(-1) as Sprite;
        expect(sprite.texture.frame).toMatchObject({ x: frame * 64, y: row * 64, width: 64, height: 64 });
      }
    }
    fx.beginFrame();
    fx.draw("ki", { x: 0, y: 0, tick: -5 });
    expect((fx.root.children[0] as Sprite).texture.frame.x).toBe(192);
  });

  it("hides unused sprites and resets transforms and appearance across kinds", async () => {
    vi.spyOn(Assets, "load").mockResolvedValue({ source: atlas().source });
    const fx = new AbilityPixelEffects();
    await fx.load();
    fx.draw("exhaust", { x: 1.4, y: 2.8, tick: 10, size: 32, alpha: 0.3, rotation: 2 });
    fx.draw("ki", { x: 0, y: 0, tick: 0 });
    const sprite = fx.root.children[0] as Sprite;
    sprite.tint = 0xff0000;
    sprite.skew.set(1, 1);
    sprite.pivot.set(3, 4);
    sprite.anchor.set(0, 1);
    sprite.scale.set(-1, 2);
    sprite.blendMode = "add";
    sprite.renderable = false;
    fx.beginFrame();
    expect(fx.root.children.every((child) => !child.visible)).toBe(true);
    fx.draw("promise", { x: 10.6, y: 7.1, tick: 0 });
    expect(fx.root.children).toHaveLength(2);
    expect(sprite).toMatchObject({ x: 11, y: 7, rotation: 0, alpha: 1, tint: 0xffffff, visible: true, renderable: true, blendMode: "normal" });
    expect(sprite.anchor.x).toBe(0.5);
    expect(sprite.anchor.y).toBe(0.5);
    expect(sprite.pivot.x + sprite.pivot.y + sprite.skew.x + sprite.skew.y).toBe(0);
    expect(sprite.width).toBe(24);
    expect(sprite.height).toBe(24);
    expect(fx.root.children[1]!.visible).toBe(false);
  });

  it("rejects invalid poses without allocating and clamps opacity", async () => {
    vi.spyOn(Assets, "load").mockResolvedValue({ source: atlas().source });
    const fx = new AbilityPixelEffects();
    await fx.load();
    for (const pose of [{ x: NaN, y: 0, tick: 0 }, { x: 0, y: 0, tick: Infinity }, { x: 0, y: 0, tick: 0, size: -1 }, { x: 0, y: 0, tick: 0, rotation: NaN }]) {
      expect(fx.draw("ki", pose)).toBe(false);
    }
    expect(fx.root.children).toHaveLength(0);
    fx.draw("ki", { x: 0, y: 0, tick: 0, alpha: 2 });
    expect(fx.root.children[0]!.alpha).toBe(1);
  });

  it("propagates load failures and allows a retry", async () => {
    vi.spyOn(Assets, "load").mockRejectedValueOnce(new Error("missing atlas")).mockResolvedValue({ source: atlas().source });
    const fx = new AbilityPixelEffects();
    await expect(fx.load()).rejects.toThrow("missing atlas");
    expect(fx.draw("ki", { x: 0, y: 0, tick: 0 })).toBe(false);
    await fx.load();
    expect(fx.draw("ki", { x: 0, y: 0, tick: 0 })).toBe(true);
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
  vi.spyOn(Assets, "load").mockResolvedValue({ source: atlas().source });
  const fx = new AbilityPixelEffects();
  const added: { texture: unknown; tint: number }[] = [];
  vi.spyOn(fx.root, "addChild").mockImplementation((sprite) => {
    if (!added.includes(sprite as unknown as typeof added[number])) added.push(sprite as unknown as typeof added[number]);
    return sprite;
  });
  await fx.load();
  const draw = (color?: number | null) => fx.draw("ki", { x: 0, y: 0, tick: 0, color });
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
