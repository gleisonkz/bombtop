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
  function cell(sprite: unknown) {
    return (sprite as { texture: { options: { source: unknown; frame: { x: number; y: number; width: number; height: number } } } }).texture.options;
  }

  it("isolates native magnetic beam, impact and coils from Thor's base impact", async () => {
    const base = { source: {} };
    const native = { source: {} };
    mocks.load.mockImplementation(async (url: string) => url.includes("static-electric-game") ? native : base);
    const effect = new EnergyPixelEffects();
    await effect.load();
    const pose = { x0: 0, y0: 0, x1: 16, y1: 0, tick: 14, alpha: 1 };
    effect.draw("magnet", pose);
    const parts = effect.root.children;
    for (const [index, row] of [[0, 0], [1, 1], [2, 2]] as const) {
      expect(cell(parts[index])).toEqual({ source: native.source, frame: { x: 448, y: row * 64, width: 64, height: 64 } });
    }
    expect((parts[0] as Sprite).width).toBe(16);
    expect((parts[0] as Sprite).height).toBe(18);
    effect.beginFrame();
    effect.draw("lightning", pose);
    expect(cell(parts[1])).toEqual({ source: base.source, frame: { x: 0, y: 64, width: 64, height: 64 } });
  });

  it("uses all eight native charge phases in paired back/front layers", async () => {
    const charge = { source: {} };
    mocks.load.mockImplementation(async (url: string) => url.includes("static-electric-game") ? charge : { source: {} });
    const effect = new EnergyPixelEffects();
    await effect.load();
    for (let phase = 0; phase < 8; phase++) {
      effect.beginFrame();
      effect.magnetAura({ x: 12, y: 24, tick: phase * 2, alpha: 0.5 });
      for (const [row, layer] of [effect.behind, effect.root].entries()) {
        expect(cell(layer.children[0])).toEqual({ source: charge.source, frame: { x: phase * 64, y: (row + 3) * 64, width: 64, height: 64 } });
        expect(layer.children[0]).toMatchObject({ width: 44, height: 46, alpha: 0.5 });
      }
    }
  });

  it("keeps legacy magnetic and charge cells when optional native assets fail", async () => {
    const base = { source: {} };
    mocks.load.mockImplementation(async (url: string) => {
      if (!url.includes("energy-effects-pixel")) throw new Error("missing optional art");
      return base;
    });
    const effect = new EnergyPixelEffects();
    await effect.load();
    effect.draw("magnet", { x0: 0, y0: 0, x1: 16, y1: 0, tick: 3, alpha: 1 });
    expect(cell(effect.root.children[0])).toEqual({ source: base.source, frame: { x: 64, y: 192, width: 64, height: 64 } });
    effect.beginFrame();
    effect.magnetAura({ x: 0, y: 0, tick: 21, alpha: 1 });
    expect(cell(effect.behind.children[0])).toEqual({ source: base.source, frame: { x: 192, y: 512, width: 64, height: 64 } });
  });

  it("falls back before load, shares concurrent loads and keeps nearest sampling", async () => {
    const effect = new EnergyPixelEffects();
    const pose = { x0: 0, y0: 0, x1: 32, y1: 0, tick: 9, alpha: 1 };
    expect(effect.draw("lightning", pose)).toBe(false);
    await Promise.all([effect.load(), effect.load()]);
    expect(mocks.load).toHaveBeenCalledTimes(4);
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

it("isolates Pikachu's native thunder and paired aura from Flash shock and Thor", async () => {
  const native = { source: {} };
  const base = { source: {} };
  mocks.load.mockImplementation(async (url: string) => url.includes("pikachu-electric-game") ? native : base);
  const fx = new EnergyPixelEffects();
  await fx.load();
  const pose = { x0: 0, y0: 0, x1: 16, y1: 0, tick: 9, alpha: 1 };
  fx.draw("thunder", pose);
  const read = (sprite: unknown) => (sprite as { texture: { options: { source: unknown; frame: { width: number; y: number } } } }).texture.options;
  expect(read(fx.root.children[0])).toMatchObject({ source: native.source, frame: { width: 64, y: 0 } });
  expect(read(fx.root.children[1])).toMatchObject({ source: native.source, frame: { width: 64, y: 64 } });
  fx.beginFrame(); fx.draw("shock", pose);
  expect(read(fx.root.children[0])).toMatchObject({ source: base.source, frame: { width: 64, y: 128 } });
  fx.beginFrame(); fx.aura({ x: 0, y: 0, tick: 9, alpha: 1 });
  expect(read(fx.behind.children[0])).toMatchObject({ source: native.source, frame: { width: 64, y: 128 } });
  expect(read(fx.root.children[0])).toMatchObject({ source: native.source, frame: { width: 64, y: 192 } });
});


it.each(["magnet", "thunder", "speedForce"] as const)("cycles all native phases for %s without changing Thor or legacy shock", async (kind) => {
  const base = { source: {} };
  const atlases = {
    magnet: { source: {} }, thunder: { source: {} }, speedForce: { source: {} },
  };
  mocks.load.mockImplementation(async (url: string) => {
    if (url.includes("static-electric-game")) return atlases.magnet;
    if (url.includes("pikachu-electric-game")) return atlases.thunder;
    if (url.includes("flash-speed-force")) return atlases.speedForce;
    return base;
  });
  const fx = new EnergyPixelEffects();
  await fx.load();
  expect(mocks.load.mock.calls.map(([url]) => url)).toEqual([
    expect.stringContaining("energy-effects-pixel.png?v=2"),
    expect.stringContaining("static-electric-game.png?v=native-game-20261026"),
    expect.stringContaining("pikachu-electric-game.png?v=native-game-20261026"),
    expect.stringContaining("flash-speed-force.png?v=native-game-20261026"),
  ]);
  const read = (sprite: unknown) => (sprite as { texture: { options: { source: unknown; frame: { x: number; y: number; width: number; height: number } } } }).texture.options;
  for (let tick = 0; tick < 18; tick++) {
    fx.beginFrame();
    const pose = { x0: 0, y0: 0, x1: 32, y1: 0, tick, alpha: 1 };
    fx.draw(kind, pose);
    const phase = Math.floor(tick / 2) % 8;
    expect(read(fx.root.children[0]).source).toBe(atlases[kind].source);
    expect(read(fx.root.children[0])).toEqual({ source: atlases[kind].source, frame: { x: phase * 64, y: 0, width: 64, height: 64 } });
    expect(read(fx.root.children[1]).frame.x).toBe((phase + 1) % 8 * 64);
    expect(read(fx.root.children[2])).toEqual({ source: atlases[kind].source, frame: { x: phase * 64, y: 64, width: 64, height: 64 } });
    if (kind === "speedForce") {
      expect(fx.root.children[0]).toMatchObject({ height: 12, width: 16 });
      expect(fx.root.children[2]).toMatchObject({ height: 14, width: 14 });
    }
    for (const legacy of ["lightning", "shock", "ki"] as const) {
      fx.beginFrame(); fx.draw(legacy, pose);
      expect(read(fx.root.children[0]).source).toBe(base.source);
      expect(read(fx.root.children[0]).frame.x).toBe(Math.floor(tick / 3) % 4 * 64);
    }
  }
});

it.each(["magnet", "thunder", "speedForce"] as const)("preserves four-phase fallback when %s optional load resolves null", async (kind) => {
  const base = { source: {} };
  mocks.load.mockImplementation(async (url: string) => url.includes("energy-effects-pixel") ? base : null);
  const fx = new EnergyPixelEffects();
  await fx.load();
  const rows = { magnet: [3, 1], thunder: [2, 5], speedForce: [2, 5] };
  for (let tick = 0; tick < 24; tick++) {
    fx.beginFrame();
    fx.draw(kind, { x0: 0, y0: 0, x1: 16, y1: 0, tick, alpha: 1 });
    for (const [index, row] of rows[kind].entries()) {
      const texture = (fx.root.children[index] as unknown as { texture: { options: unknown } }).texture.options;
      expect(texture).toEqual({ source: base.source, frame: { x: Math.floor(tick / 3) % 4 * 64, y: row * 64, width: 64, height: 64 } });
    }
  }
});


it.each(["aura", "magnetAura"] as const)("uses every native phase and legacy cadence for paired %s layers", async (method) => {
  for (const available of [true, false]) {
    const base = { source: {} };
    const native = { source: {} };
    mocks.load.mockImplementation(async (url: string) => {
      if (url.includes("energy-effects-pixel")) return base;
      return available ? native : null;
    });
    const fx = new EnergyPixelEffects();
    await fx.load();
    const count = available ? 8 : 4;
    const ticks = available ? 2 : 3;
    const baseRow = method === "aura" ? 10 : 8;
    const nativeRow = method === "aura" ? 2 : 3;
    for (let tick = 0; tick <= count * ticks; tick++) {
      fx.beginFrame();
      fx[method]({ x: 12, y: 24, tick, alpha: 1 });
      for (const [offset, layer] of [fx.behind, fx.root].entries()) {
        const cell = (layer.children[0] as unknown as { texture: { options: { source: unknown; frame: unknown } } }).texture.options;
        expect(cell.source).toBe(available ? native.source : base.source);
        expect(cell.frame).toEqual({ x: Math.floor(tick / ticks) % count * 64,
          y: ((available ? nativeRow : baseRow) + offset) * 64, width: 64, height: 64 });
      }
    }
    fx.beginFrame();
    fx[method]({ x: 0, y: 0, tick: 0, alpha: 0 });
    expect([...fx.behind.children, ...fx.root.children].every(sprite => !(sprite as Sprite).visible)).toBe(true);
  }
});
