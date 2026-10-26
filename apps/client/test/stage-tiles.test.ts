import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Graphics, Sprite } from "pixi.js";
import { createMatch, FLAME_TICKS, publicView } from "@bombtop/shared";
import { TILES } from "../src/render/sprites";

const mocks = vi.hoisted(() => ({ load: vi.fn(), textures: [] as unknown[] }));
vi.mock("pixi.js", () => {
  class Point {
    x = 0; y = 0;
    set(x: number, y = x) { this.x = x; this.y = y; }
  }
  class Container {
    children: unknown[] = [];
    position = new Point();
    addChild(...children: unknown[]) {
      for (const child of children) {
        const node = child as { parent?: Container };
        if (node.parent === this) continue;
        if (node.parent) node.parent.children.splice(node.parent.children.indexOf(child), 1);
        node.parent = this;
        this.children.push(child);
      }
    }
  }
  class Sprite {
    anchor = new Point(); position = new Point(); scale = new Point();
    pivot = new Point(); skew = new Point();
    visible = true; texture: unknown;
  }
  class Graphics {
    clear = vi.fn(() => this); circle = vi.fn(() => this); ellipse = vi.fn(() => this);
    rect = vi.fn(() => this); roundRect = vi.fn(() => this); fill = vi.fn(() => this);
    stroke = vi.fn(() => this); moveTo = vi.fn(() => this); lineTo = vi.fn(() => this);
  }
  class Text { anchor = new Point(); position = new Point(); text = ""; style = { fill: 0xffffff }; destroy = vi.fn(); }
  return { Assets: { load: mocks.load }, Container, Sprite, Graphics, Text, Rectangle: class {}, Texture: class {
    static from(resource: unknown) {
    const size = resource as { width: number; height: number };
    const texture = { width: size.width, height: size.height, source: { resource, scaleMode: "nearest", addressMode: "repeat" } };
    mocks.textures.push(texture);
    return texture;
  } } };
});

import { Renderer } from "../src/render/renderer";

const draws: unknown[][] = [];
beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mocks.load.mockReset(); mocks.textures.length = 0; draws.length = 0;
  mocks.load.mockResolvedValue({ width: 128, source: { resource: {} } });
  vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => ({
    drawImage: (...args: unknown[]) => draws.push(args),
  }) }) });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });


describe("stage tile atlases", () => {
  function terrain(renderer: Renderer) {
    return renderer as unknown as { tileArt: unknown[]; tileSprites: Sprite[]; burnSprites: Sprite[] };
  }
  function arena(stage: "classic" | "sb4-01" | "sb4-02") {
    const state = createMatch({ seed: 1, playerIds: ["qa"], blockDensity: 0, stage });
    state.flames = [{ x: 3, y: 3, ttl: FLAME_TICKS, ownerId: "qa", block: true }];
    return publicView(state);
  }
  it("reuses stage crops across concurrent and repeated loads, including after a custom layout", async () => {
    mocks.load.mockResolvedValue({ width: 1920, height: 128, source: { resource: {} } });
    const renderer = new Renderer(true);
    await Promise.all([renderer.useTileArt(), renderer.useTileArt()]);
    const stageLoads = () => mocks.load.mock.calls.filter(([url]) => String(url).includes("sb4-battle/tiles-"));
    expect(stageLoads()).toHaveLength(2);
    renderer.draw(arena("sb4-01"), new Map(), 1);
    const first = terrain(renderer).tileSprites[0]!.texture;
    await renderer.useTileArt();
    renderer.draw(arena("sb4-01"), new Map(), 1);
    expect(terrain(renderer).tileSprites[0]!.texture).toBe(first);
    await renderer.useTileArt({ ...TILES, url: "custom.png", scale: 0.25 });
    renderer.draw(arena("sb4-01"), new Map(), 1);
    expect(terrain(renderer).tileSprites[0]!.texture).toBe(terrain(renderer).tileArt[TILES.cells.border]);
    await renderer.useTileArt();
    renderer.draw(arena("sb4-01"), new Map(), 1);
    expect(terrain(renderer).tileSprites[0]!.texture).toBe(first);
    expect(stageLoads()).toHaveLength(2);
  });
  it("retries failed and invalid atlases", async () => {
    let recovered = false;
    mocks.load.mockImplementation((url: string) => {
      if (!recovered && url.includes("tiles-01.png")) return Promise.reject(new Error("offline"));
      return Promise.resolve({ width: 1920, height: !recovered && url.includes("tiles-02.png") ? 256 : 128, source: { resource: {} } });
    });
    const renderer = new Renderer(true);
    await renderer.useTileArt();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("tiles-01.png"), expect.any(Error));
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("tiles-02.png"), expect.any(Error));
    recovered = true;
    await renderer.useTileArt();
    for (const stage of ["sb4-01", "sb4-02"] as const) {
      renderer.draw(arena(stage), new Map(), 1);
      expect(terrain(renderer).tileSprites[0]!.texture).not.toBe(terrain(renderer).tileArt[TILES.cells.border]);
    }
  });
  it("prepares both originals and switches arenas synchronously without tinting their art", async () => {
    mocks.load.mockResolvedValue({ width: 1920, height: 128, source: { resource: {} } });
    const renderer = new Renderer(true);
    await renderer.useTileArt();
    const calls = mocks.load.mock.calls.length;
    renderer.draw(arena("sb4-01"), new Map(), 1);
    const first = terrain(renderer).tileSprites[0]!.texture;
    expect(first).not.toBe(terrain(renderer).tileArt[TILES.cells.border]);
    expect(terrain(renderer).tileSprites[0]!.tint).toBe(0xffffff);
    const burn = terrain(renderer).burnSprites[0]!.texture;
    renderer.draw(arena("sb4-02"), new Map(), 1);
    expect(terrain(renderer).tileSprites[0]!.texture).not.toBe(first);
    expect(terrain(renderer).burnSprites[0]!.texture).not.toBe(burn);
    renderer.draw(arena("classic"), new Map(), 1);
    expect(terrain(renderer).tileSprites[0]!.texture).toBe(terrain(renderer).tileArt[TILES.cells.border]);
    renderer.draw(arena("sb4-01"), new Map(), 1);
    expect(terrain(renderer).tileSprites[0]!.texture).toBe(first);
    expect(mocks.load).toHaveBeenCalledTimes(calls);
  });
  it("falls back independently when a stage atlas is unavailable", async () => {
    mocks.load.mockImplementation((url: string) => url.includes("tiles-01.png")
      ? Promise.reject(new Error("missing"))
      : Promise.resolve({ width: 1920, height: 128, source: { resource: {} } }));
    const renderer = new Renderer(true);
    await renderer.useTileArt();
    renderer.draw(arena("sb4-01"), new Map(), 1);
    expect(terrain(renderer).tileSprites[0]!.texture).toBe(terrain(renderer).tileArt[TILES.cells.border]);
    expect(terrain(renderer).tileSprites[0]!.tint).not.toBe(0xffffff);
    renderer.draw(arena("sb4-02"), new Map(), 1);
    expect(terrain(renderer).tileSprites[0]!.texture).not.toBe(terrain(renderer).tileArt[TILES.cells.border]);
    const second = terrain(renderer).tileSprites[0]!.texture;
    mocks.load.mockResolvedValue({ width: 1920, height: 128, source: { resource: {} } });
    await renderer.useTileArt();
    renderer.draw(arena("sb4-02"), new Map(), 1);
    expect(terrain(renderer).tileSprites[0]!.texture).toBe(second);
    renderer.draw(arena("sb4-01"), new Map(), 1);
    expect(terrain(renderer).tileSprites[0]!.texture).not.toBe(terrain(renderer).tileArt[TILES.cells.border]);
  });
  it("keeps custom layouts authoritative over stage art and older loading calls", async () => {
    let resolveOld!: (value: unknown) => void;
    mocks.load.mockImplementation((url: string) => url.includes(TILES.url)
      ? new Promise(resolve => { resolveOld = resolve; })
      : Promise.resolve({ width: 1920, height: 128, source: { resource: {} } }));
    const renderer = new Renderer(true);
    const old = renderer.useTileArt();
    await renderer.useTileArt({ ...TILES, url: "custom.png", scale: 0.25 });
    const custom = terrain(renderer).tileArt;
    resolveOld({ width: 1920, height: 128, source: { resource: {} } });
    await old;
    renderer.draw(arena("sb4-02"), new Map(), 1);
    expect(terrain(renderer).tileArt).toBe(custom);
    expect(terrain(renderer).tileSprites[0]!.texture).toBe(custom[TILES.cells.border]);
    expect(terrain(renderer).tileSprites[0]!.scale.x).toBe(0.25);
  });
  it("rejects stage atlases that do not contain fifteen 128px cells", async () => {
    mocks.load.mockImplementation((url: string) => Promise.resolve({
      width: url.includes("tiles-01.png") ? 1792 : 1920,
      height: url.includes("tiles-02.png") ? 256 : 128,
      source: { resource: {} },
    }));
    const renderer = new Renderer(true);
    await renderer.useTileArt();
    for (const stage of ["sb4-01", "sb4-02"] as const) {
      renderer.draw(arena(stage), new Map(), 1);
      expect(terrain(renderer).tileSprites[0]!.texture).toBe(terrain(renderer).tileArt[TILES.cells.border]);
    }
  });
});
