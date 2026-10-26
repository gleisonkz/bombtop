import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Graphics, Sprite } from "pixi.js";
import { createMatch, FLAME_TICKS, Floor, getTile, ItemKind, publicView, TILE, Tile } from "@bombtop/shared";
import { ITEMS, TILES, SHEETS } from "../src/render/sprites";
import type { AbilityPixelEffects } from "../src/render/ability-pixel-effects";
import type { EnergyPixelEffects } from "../src/render/energy-pixel-effects";
import type { CompanionPixelEffects } from "../src/render/companion-pixel-effects";
import { specialInk } from "../src/render/special-palette";

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

import { GroundEffects } from "../src/render/ground-effects";
import { Renderer } from "../src/render/renderer";

const draws: unknown[][] = [];
beforeEach(() => {
  mocks.load.mockReset(); mocks.textures.length = 0; draws.length = 0;
  mocks.load.mockResolvedValue({ width: 128, source: { resource: {} } });
  vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => ({
    drawImage: (...args: unknown[]) => draws.push(args),
  }) }) });
});
afterEach(() => vi.unstubAllGlobals());

describe("ground effects", () => {
  it.each(["up", "down", "left", "right"] as const)("keeps the firing sprite facing its %s beam after input turns", dir => {
    const renderer = new Renderer(true);
    const state = createMatch({ seed: 1, playerIds: ["goku"], blockDensity: 0, characters: { goku: "goku" } });
    const player = state.players[0]!;
    player.facing = dir === "down" ? "up" : "down";
    state.blasts = [{ ownerId: player.id, x: 1, y: 1, dir, length: 2, ttl: 10, kind: "kamehameha" }];
    renderer.setCharacters(new Map([[player.id, "goku"]]));
    const internal = renderer as unknown as { skins: Map<string, unknown>; placeSprite(...args: unknown[]): void };
    internal.skins.set("goku", { sheet: SHEETS.goku, heads: new Map() });
    const place = vi.spyOn(internal, "placeSprite").mockImplementation(() => {});
    renderer.draw(publicView(state), new Map(), 1);
    const view = dir === "left" || dir === "right" ? "side" : dir;
    expect(place.mock.calls[0]![3]).toMatchObject({
      x: 6 * SHEETS.goku.frameW, y: SHEETS.goku.cast[view].row * SHEETS.goku.frameH, flip: dir === "left",
    });
  });
  it.each([
    ["down", 20, 40, 113], ["down", 16, 38, 106], ["down", 4, 68, 116],
    ["up", 20, 103, 95], ["up", 4, 108, 104],
    ["right", 20, 63, 113], ["right", 4, 79, 112],
    ["left", 20, 80, 113], ["left", 4, 64, 112],
  ] as const)("attaches the %s charge sphere to the hands with %i ticks left", (facing, charge, handX, handY) => {
    const renderer = new Renderer(true);
    const state = createMatch({ seed: 1, playerIds: ["goku"], blockDensity: 0, characters: { goku: "goku" } });
    const player = state.players[0]!;
    player.facing = facing;
    player.charge = charge;
    renderer.setCharacters(new Map([[player.id, "goku"]]));
    const effects = (renderer as unknown as { abilityEffects: AbilityPixelEffects }).abilityEffects;
    const draw = vi.spyOn(effects, "draw").mockReturnValue(true);
    renderer.draw(publicView(state), new Map(), 1);
    expect(draw).toHaveBeenCalledWith("ki", expect.objectContaining({
      x: player.px / TILE * 16 + (handX - SHEETS.goku.anchorX) * SHEETS.goku.scale,
      y: player.py / TILE * 16 + 6 + (handY - SHEETS.goku.anchorY) * SHEETS.goku.scale,
    }));
  });
  it("keeps original fallback seats when player two carries player one", () => {
    const renderer = new Renderer(true);
    const state = createMatch({ seed: 1, playerIds: ["first", "second"], blockDensity: 0 });
    state.players[0]!.heldBy = "second";
    renderer.draw(publicView(state), new Map(), 1);
    const world = (renderer as unknown as { world: Graphics }).world;
    const fills = vi.mocked(world.fill).mock.calls.map(([color]) => color).filter(color => color === 0xf5f5f5 || color === 0x3a3a48);
    expect(fills).toEqual([0x3a3a48, 0xf5f5f5]);
  });

  it("keeps a held mega bomb in its creator's color when player two is the stack root", () => {
    const renderer = new Renderer(true, { previewSpecialColors: true });
    const state = createMatch({ seed: 1, playerIds: ["first", "second"], blockDensity: 0 });
    delete state.players[1]!.ownColors;
    state.players[0]!.heldBy = "second";
    state.bombs = [{ ownerId: "second", x: 1, y: 1, fuse: 120, range: 2, type: "normal", slide: null, offset: 0, air: null, heldBy: "first", mega: true }];
    renderer.draw(publicView(state), new Map(), 1);
    const overlay = (renderer as unknown as { overlay: Graphics }).overlay;
    expect(overlay.fill).toHaveBeenCalledWith(specialInk(0x985bdb, 0x3a3a48));
  });

  it.each([false, true])("keeps a captured or thrown mount at its player's elevated feet (thrown=%s)", thrown => {
    const renderer = new Renderer(true);
    const state = createMatch({ seed: 1, playerIds: ["first", "second"], blockDensity: 0 });
    const rider = state.players[0]!;
    rider.mount = "hopper";
    if (thrown) rider.thrown = { dir: "right", span: 3, tilesLeft: 2, progress: 3 };
    else rider.heldBy = "second";
    renderer.draw(publicView(state), new Map(), 0);
    const world = (renderer as unknown as { world: Graphics }).world;
    const mount = vi.mocked(world.ellipse).mock.calls.find(call => call[2] === 7 && call[3] === 4);
    expect(mount).toBeDefined();
    const ground = thrown ? rider : state.players[1]!;
    expect(mount![1]).toBeLessThan(ground.py / TILE * 16 + 6);
  });
  it("outlines each Lula's meat in the creator seat color during gameplay with original skins", () => {
    const renderer = new Renderer(true);
    const state = createMatch({ seed: 1, playerIds: ["first", "second"], characters: { first: "lula", second: "lula" }, blockDensity: 0 });
    for (const player of state.players) player.ownColors = true;
    renderer.setColors(new Map([["first", 2], ["second", 3]]));
    state.grid.tiles[3 * state.grid.width + 3] = Tile.Empty;
    state.grid.tiles[3 * state.grid.width + 4] = Tile.Empty;
    state.items = [
      { x: 3, y: 3, kind: ItemKind.Picanha, owner: "first" },
      { x: 4, y: 3, kind: ItemKind.Picanha, owner: "second" },
    ];
    renderer.draw(publicView(state), new Map(), 1);
    const world = (renderer as unknown as { world: Graphics }).world;
    expect(world.stroke).toHaveBeenCalledWith({ color: 0xe84a4a, width: 1.5 });
    expect(world.stroke).toHaveBeenCalledWith({ color: 0x3d7bf2, width: 1.5 });
    expect(world.fill).toHaveBeenCalledWith(0xb03e2c);
  });
  it("keeps gameplay special colors original even when the character uses another palette", () => {
    const renderer = new Renderer(true);
    const state = createMatch({ seed: 1, playerIds: ["caster"], characters: { caster: "static" }, blockDensity: 0 });
    delete state.players[0]!.ownColors;
    renderer.setColors(new Map([["caster", 3]]));
    const energy = (renderer as unknown as { energyEffects: EnergyPixelEffects }).energyEffects;
    const draw = vi.spyOn(energy, "draw").mockReturnValue(true);
    state.blasts = [{ kind: "magnet", ownerId: "caster", x: 1, y: 1, dir: "right", length: 2, ttl: 20 }];
    renderer.draw(publicView(state), new Map(), 1);
    expect(draw).toHaveBeenLastCalledWith("magnet", expect.objectContaining({ color: null }));
  });
  it("keeps meat original while coloring held mega bombs by their creator", () => {
    const renderer = new Renderer(true, { previewSpecialColors: true });
    const state = createMatch({ seed: 1, playerIds: ["caster", "holder"], blockDensity: 0 });
    delete state.players[0]!.ownColors;
    state.players[1]!.ownColors = true;
    renderer.setColors(new Map([["caster", 3], ["holder", 2]]));
    state.grid.tiles[3 * state.grid.width + 3] = Tile.Empty;
    state.items = [{ x: 3, y: 3, kind: ItemKind.Picanha, owner: "caster" }];
    state.bombs = [{ ownerId: "caster", x: 1, y: 1, fuse: 120, range: 2, type: "normal", slide: null, offset: 0, air: null, heldBy: "holder", mega: true }];
    renderer.draw(publicView(state), new Map(), 1);
    const world = (renderer as unknown as { world: Graphics }).world;
    const overlay = (renderer as unknown as { overlay: Graphics }).overlay;
    expect(world.fill).toHaveBeenCalledWith(0xb03e2c);
    expect(overlay.fill).toHaveBeenCalledWith(specialInk(0x985bdb, 0x3d7bf2));
  });
  it("keeps simultaneous casters independent and follows a reflected shot's current owner", () => {
    const renderer = new Renderer(true, { previewSpecialColors: true });
    const state = createMatch({ seed: 1, playerIds: ["original", "alternate"], blockDensity: 0, characters: { original: "thor", alternate: "thor" } });
    renderer.setCharacters(new Map([["original", "thor"], ["alternate", "thor"]]));
    renderer.setColors(new Map([["alternate", 3]]));
    const energy = (renderer as unknown as { energyEffects: EnergyPixelEffects }).energyEffects;
    const draw = vi.spyOn(energy, "draw").mockReturnValue(true);
    state.blasts = state.players.map(owner => ({ kind: "lightning", ownerId: owner.id, x: 1, y: 1, dir: "right", length: 2, ttl: 12 }));
    renderer.draw(publicView(state), new Map(), 1);
    expect(draw).toHaveBeenNthCalledWith(1, "lightning", expect.objectContaining({ color: null }));
    expect(draw).toHaveBeenNthCalledWith(2, "lightning", expect.objectContaining({ color: 0x3d7bf2 }));
    state.players[1]!.alive = false;
    draw.mockClear();
    renderer.draw(publicView(state), new Map(), 1);
    expect(draw).toHaveBeenLastCalledWith("lightning", expect.objectContaining({ color: 0x3d7bf2 }));
    renderer.setColors(new Map([["alternate", 0]]));
    draw.mockClear();
    renderer.draw(publicView(state), new Map(), 1);
    expect(draw).toHaveBeenLastCalledWith("lightning", expect.objectContaining({ color: null }));
    renderer.setColors(new Map([["alternate", 3]]));
    state.blasts[1]!.ownerId = "original";
    draw.mockClear();
    renderer.draw(publicView(state), new Map(), 1);
    expect(draw).toHaveBeenLastCalledWith("lightning", expect.objectContaining({ color: null }));
  });
  it("uses the caster's chosen seat color for specials and restores original effects", () => {
    const renderer = new Renderer(true, { previewSpecialColors: true });
    const state = createMatch({ seed: 1, playerIds: ["caster"], blockDensity: 0, characters: { caster: "static" } });
    const owner = state.players[0]!;
    renderer.setCharacters(new Map([[owner.id, "static"]]));
    renderer.setColors(new Map([[owner.id, 4]]));
    const energy = (renderer as unknown as { energyEffects: EnergyPixelEffects }).energyEffects;
    const draw = vi.spyOn(energy, "draw").mockReturnValue(true);
    state.blasts = [{ kind: "magnet", ownerId: owner.id, x: 1, y: 1, dir: "right", length: 2, ttl: 20 }];
    delete owner.ownColors;
    renderer.draw(publicView(state), new Map(), 1);
    expect(draw).toHaveBeenLastCalledWith("magnet", expect.objectContaining({ color: 0x45c25b }));
    owner.ownColors = true;
    renderer.draw(publicView(state), new Map(), 1);
    expect(draw).toHaveBeenLastCalledWith("magnet", expect.objectContaining({ color: null }));
    state.players = [];
    renderer.draw(publicView(state), new Map(), 1);
    expect(draw).toHaveBeenLastCalledWith("magnet", expect.objectContaining({ color: null }));
  });
  it("fits scoreboard heads on both axes, aligns chins and keeps portraits after sheet-color eviction", () => {
    const renderer = new Renderer(true);
    const state = createMatch({ seed: 1, playerIds: ["qa"], blockDensity: 0 });
    const source = { width: 1000, height: 1000 };
    const clear = vi.fn(() => { source.width = source.height = 0; });
    const skin = {
      portrait: { x: 20, y: 10, width: 100, height: 40 },
      sources: { get: () => ({ source: { resource: source } }), clear },
    };
    const internal = renderer as unknown as {
      skins: Map<string, unknown>; scoreHeads: Map<string, Sprite>;
      drawScore(s: ReturnType<typeof publicView>): void;
    };
    internal.skins.set("captain", skin);
    renderer.setCharacters(new Map([["qa", "captain"]]));
    renderer.setScore([{ id: "qa", wins: 2 }]);
    internal.drawScore(publicView(state));
    const head = internal.scoreHeads.get("qa")!;
    const portrait = head.texture;
    expect(head.scale.x).toBe(0.13);
    expect(head.scale.y).toBe(0.13);
    expect(head.anchor.y).toBe(1);
    expect(head.position.y).toBe(14.5);
    expect(portrait.source.resource).not.toBe(source);
    renderer.setCharacters(new Map());
    expect(clear).toHaveBeenCalled();
    renderer.setCharacters(new Map([["qa", "captain"]]));
    state.players[0]!.alive = false;
    internal.drawScore(publicView(state));
    expect(head.texture).toBe(portrait);
    expect(head.alpha).toBe(0.4);
    expect((portrait.source.resource as HTMLCanvasElement).width).toBe(100);
    const oldX = head.position.x;
    Object.assign(skin.portrait, { box: [15.5, 13], bottom: 15.5 });
    internal.drawScore(publicView(state));
    expect(head.scale.x).toBe(0.155);
    expect(head.position.x).toBe(oldX - 1.25);
    expect(head.position.y).toBe(15.5);
  });
  it("retains primitive conveyors when base terrain fails but conveyor art loads", async () => {
    mocks.load.mockImplementation((url: string) => url.includes("tiles.png")
      ? Promise.reject(new Error("terrain unavailable"))
      : Promise.resolve({ width: 128, source: { resource: {} } }));
    const renderer = new Renderer(true);
    await expect(renderer.useTileArt()).rejects.toThrow("terrain unavailable");
    const state = createMatch({ seed: 1, playerIds: ["qa"], blockDensity: 0 });
    state.grid.floor[state.grid.width + 1] = Floor.ConveyorRight;
    renderer.draw(publicView(state), new Map(), 1);
    const conveyors = (renderer as unknown as { conveyors: { root: { children: Sprite[] } } }).conveyors;
    expect(conveyors.root.children).toHaveLength(0);
    const world = renderer.root.children[2] as Graphics;
    expect(world.stroke).toHaveBeenCalledWith({ color: 0xffd23f, width: 1.5 });
  });
  it("renders animated conveyor floors below world effects and hides covered or removed tiles", async () => {
    const renderer = new Renderer(true);
    await renderer.useTileArt();
    const art = (renderer as unknown as { conveyors: { root: { children: Sprite[] } } }).conveyors;
    const state = createMatch({ seed: 1, playerIds: ["qa"], blockDensity: 0 });
    const floors = [Floor.ConveyorRight, Floor.ConveyorDown, Floor.ConveyorLeft, Floor.ConveyorUp];
    for (const [index, floor] of floors.entries()) {
      state.grid.floor[state.grid.width + index + 1] = floor;
      state.grid.tiles[state.grid.width + index + 1] = Tile.Empty;
    }
    state.tick = 0;
    renderer.draw(publicView(state), new Map(), 1);
    expect(art.root.children).toHaveLength(4);
    expect(renderer.root.children[1]).toBe(art.root);
    const initial = art.root.children[0]!.texture;
    state.tick = 2;
    renderer.draw(publicView(state), new Map(), 1);
    expect(art.root.children[0]!.texture).not.toBe(initial);
    state.grid.tiles[state.grid.width + 1] = Tile.Block;
    for (let index = 2; index <= 4; index++) state.grid.floor[state.grid.width + index] = Floor.Normal;
    renderer.draw(publicView(state), new Map(), 1);
    expect(art.root.children.every(sprite => !sprite.visible)).toBe(true);
    expect(mocks.load).toHaveBeenCalledWith(expect.stringContaining("sprites/conveyors.png?v="));
  });
  it("fades ignition over the intact brick and restores opaque later phases when sprites are reused", async () => {
    mocks.load.mockImplementation((url: string) => Promise.resolve({
      width: url.includes("tiles.png") ? 1920 : 128, source: { resource: {} },
    }));
    const renderer = new Renderer(true);
    await renderer.useTileArt();
    const state = createMatch({ seed: 1, playerIds: ["qa"], blockDensity: 0 });
    state.flames = [{ x: 3, y: 3, ttl: FLAME_TICKS, ownerId: "qa", block: true }];
    const art = renderer as unknown as { tileArt: unknown[]; tileSprites: Sprite[]; burnSprites: Sprite[] };
    const tileIndex = 3 * state.grid.width + 3;
    renderer.draw(publicView(state), new Map(), 1);
    expect(art.tileSprites[tileIndex]!.texture).toBe(art.tileArt[TILES.cells.block]);
    expect(art.burnSprites[0]!.alpha).toBe(0);
    state.flames[0]!.ttl = FLAME_TICKS - 2;
    renderer.draw(publicView(state), new Map(), 1);
    expect(art.burnSprites[0]!.alpha).toBeCloseTo(0.4);
    state.flames[0]!.ttl = 20;
    renderer.draw(publicView(state), new Map(), 1);
    expect(art.burnSprites[0]!.alpha).toBe(1);
    expect(art.tileSprites[tileIndex]!.texture).not.toBe(art.tileArt[TILES.cells.block]);
  });
  it("keeps the game and menu Patronus artwork, sampling and anchors independent", async () => {
    mocks.load.mockImplementation(async () => ({ width: 768, source: { resource: {}, scaleMode: "linear" } }));
    const game = new Renderer();
    const menu = new Renderer();
    await game.usePatronusArt();
    const gameArt = await mocks.load.mock.results.at(-1)!.value;
    expect(mocks.load).toHaveBeenLastCalledWith(expect.stringContaining("sprites/patronus-pixel.png"));
    await menu.usePatronusArt("menu");
    const menuArt = await mocks.load.mock.results.at(-1)!.value;
    expect(gameArt.source.scaleMode).toBe("nearest");
    expect(menuArt.source.scaleMode).toBe("linear");
    expect(mocks.load).toHaveBeenLastCalledWith(expect.stringContaining("sprites/patronus.png"));
    type PatronusRenderer = { drawPatronus(g: Graphics, pose: { x0: number; y0: number; x1: number; y1: number; dir: "left"; run: number; age: number }): void; patronusSprites: Sprite[]; patronusUsed: number };
    const draw = (r: Renderer) => {
      const p = r as unknown as PatronusRenderer;
      p.patronusUsed = 0;
      p.drawPatronus(new Graphics(), { x0: 0, y0: 20, x1: 80, y1: 20, dir: "left", run: 40, age: 6 });
      return p.patronusSprites[0]!;
    };
    const gameSprite = draw(game);
    const menuSprite = draw(menu);
    expect(gameSprite.scale.x).toBe(-0.45);
    expect(menuSprite.scale.x).toBe(-0.3);
    expect(gameSprite.anchor.y).toBe(56 / 64);
    expect(menuSprite.anchor.y).toBe(84 / 96);
    expect(gameSprite.texture).not.toBe(menuSprite.texture);
    await menu.usePatronusArt();
    const switched = draw(menu);
    expect(switched.scale.x).toBe(-0.45);
    expect(switched.anchor.y).toBe(56 / 64);
    expect(gameSprite.scale.x).toBe(-0.45);
  });
  it("grounds Bugs holes below items and people and never puts mounds over walls", async () => {
    const renderer = new Renderer(true);
    await renderer.useTileArt();
    const state = createMatch({ seed: 1, playerIds: ["bugs"], blockDensity: 0 });
    state.blasts.push({ ownerId: "bugs", x: 1, y: 2, dir: "right", length: 4, ttl: 30, kind: "tunnel" });
    renderer.draw(publicView(state), new Map(), 1);
    const view = renderer as unknown as {
      companionEffects: CompanionPixelEffects;
      itemLayer: { children: unknown[] };
      people: { children: unknown[] };
    };
    const ground = view.companionEffects.ground;
    expect(ground.children.length).toBeGreaterThanOrEqual(2);
    expect(renderer.root.children.indexOf(ground)).toBeLessThan(renderer.root.children.indexOf(view.itemLayer as never));
    expect(renderer.root.children.indexOf(ground)).toBeLessThan(renderer.root.children.indexOf(view.people as never));
    expect(view.companionEffects.root.children).toHaveLength(0);
    for (const sprite of ground.children as Sprite[]) {
      expect(getTile(state, Math.floor(sprite.position.x / 16), Math.floor(sprite.position.y / 16))).toBe(Tile.Empty);
    }
    state.blasts = [];
    renderer.draw(publicView(state), new Map(), 1);
    expect(ground.children.every(sprite => !sprite.visible)).toBe(true);
  });

  it("isolates all tile cells so stone and neighboring burn phases cannot bleed into transparency", async () => {
    mocks.load.mockImplementation((url: string) => Promise.resolve({
      width: url.includes("tiles.png") ? 1920 : 128, source: { resource: {} },
    }));
    const renderer = new Renderer(true);
    await renderer.useTileArt();
    const art = (renderer as unknown as { tileArt: { source: { resource: { width: number }; addressMode: string } }[] }).tileArt;
    expect(art).toHaveLength(15);
    expect(new Set(art.map(texture => texture.source)).size).toBe(15);
    expect(art.every(texture => texture.source.addressMode === "clamp-to-edge")).toBe(true);
    expect(art.every(texture => texture.source.resource.width === 128)).toBe(true);
  });
  it("keeps the ready-special spark out of the overhead stun marker", () => {
    const renderer = new Renderer(true);
    const state = createMatch({ seed: 1, playerIds: ["a"], blockDensity: 0 });
    state.players[0]!.stun = 20;
    const overlay = (renderer as unknown as { overlay: Graphics }).overlay;
    renderer.draw(publicView(state), new Map(), 1);
    expect(overlay.circle).not.toHaveBeenCalled();
    state.players[0]!.stun = 0;
    renderer.draw(publicView(state), new Map(), 1);
    expect(overlay.circle).toHaveBeenCalled();
  });
  it("draws only Donatello's whoosh rings while the cast sprite supplies his staff", () => {
    const renderer = new Renderer(true) as unknown as { drawSpin(g: Graphics, x: number, y: number, age: number): void };
    const graphics = new Graphics();
    renderer.drawSpin(graphics, 40, 40, 2);
    expect(graphics.circle).toHaveBeenCalledTimes(2);
    expect(graphics.stroke).toHaveBeenCalledTimes(2);
    expect(graphics.stroke).toHaveBeenNthCalledWith(1, expect.objectContaining({ color: 0xffffff, width: 2 }));
    expect(graphics.stroke).toHaveBeenNthCalledWith(2, expect.objectContaining({ color: 0xe8d9b0, width: 1 }));
    expect(graphics.moveTo).not.toHaveBeenCalled();
    expect(graphics.lineTo).not.toHaveBeenCalled();
    expect(graphics.rect).not.toHaveBeenCalled();
    expect(graphics.fill).not.toHaveBeenCalled();
  });

  it("combines Flash lightning with his speed streaks", () => {
    const renderer = new Renderer(true) as unknown as {
      drawSpeed(g: Graphics, path: { x0: number; y0: number; x1: number; y1: number }, age: number, alpha: number): void;
      energyEffects: EnergyPixelEffects;
      companionEffects: CompanionPixelEffects;
    };
    const lightning = vi.spyOn(renderer.energyEffects, "draw").mockReturnValue(true);
    const streaks = vi.spyOn(renderer.companionEffects, "draw").mockReturnValue(true);
    renderer.drawSpeed(new Graphics(), { x0: 8, y0: 8, x1: 72, y1: 8 }, 5, 1);
    expect(lightning).toHaveBeenCalledWith("shock", expect.objectContaining({ x0: 8, x1: 72, tick: 5 }));
    expect(streaks).toHaveBeenCalledWith("speed", expect.objectContaining({ tick: 5 }));
  });

  it("uses the new picanha art and resets scale when an item sprite is reused", async () => {
    const renderer = new Renderer(true);
    await renderer.useItemArt();
    const state = createMatch({ seed: 1, playerIds: ["a"], blockDensity: 0 });
    state.items = [{ x: 3, y: 1, kind: ItemKind.Picanha }];
    renderer.draw(publicView(state), new Map(), 1);
    const layer = (renderer as unknown as { itemLayer: { children: Sprite[] } }).itemLayer;
    const item = layer.children[0]!;
    expect(item.scale.x).toBe(14 / 64);
    state.items[0]!.kind = ItemKind.Bomb;
    renderer.draw(publicView(state), new Map(), 1);
    expect(layer.children).toHaveLength(1);
    expect(item.scale.x).toBe(ITEMS.scale);
  });

  it("keeps the captain spiral split behind and in front instead of replacing it with an overlay ring", async () => {
    const renderer = new Renderer(true);
    await renderer.useSpiralArt();
    const state = createMatch({ seed: 1, playerIds: ["captain"], blockDensity: 0 });
    state.players[0]!.shield = 120;
    renderer.draw(publicView(state), new Map(), 1);
    const people = (renderer as unknown as { people: { children: Sprite[] } }).people.children;
    const spiral = people.filter(sprite => sprite.anchor.x === 0.5 && sprite.anchor.y === 66 / 80);
    expect(spiral).toHaveLength(2);
    expect(spiral[0]!.scale.x).toBe(0.34);
    expect(spiral[1]!.scale.x).toBe(0.34);
    expect(spiral[1]!.zIndex - spiral[0]!.zIndex).toBe(1);
    state.players[0]!.shield = 0;
    renderer.draw(publicView(state), new Map(), 1);
    expect(spiral.every(sprite => !sprite.visible)).toBe(true);
  });

  it("shows the shared stun marker without an active blast and removes it on recovery or death", async () => {
    const renderer = new Renderer(true);
    await renderer.useTileArt();
    const state = createMatch({ seed: 1, playerIds: ["a"], blockDensity: 0 });
    state.players[0]!.stun = 20;
    renderer.draw(publicView(state), new Map(), 1);
    const layer = (renderer as unknown as { stunEffects: { root: { children: Sprite[] } } }).stunEffects.root;
    expect(layer.children).toHaveLength(1);
    expect(layer.children[0]!.visible).toBe(true);
    state.players[0]!.stun = 0;
    renderer.draw(publicView(state), new Map(), 1);
    expect(layer.children[0]!.visible).toBe(false);
    state.players[0]!.stun = 20;
    state.players[0]!.alive = false;
    renderer.draw(publicView(state), new Map(), 1);
    expect(layer.children[0]!.visible).toBe(false);
  });
  it("returns fallback until loaded and after a failed load", async () => {
    const effects = new GroundEffects();
    expect(effects.draw("warp", 8, 8, 0)).toBe(false);
    expect(effects.root.children).toHaveLength(0);
    mocks.load.mockRejectedValueOnce(new Error("missing atlas"));
    await expect(effects.load()).resolves.toBeUndefined();
    expect(effects.draw("protection", 8, 11, 0)).toBe(false);
    await effects.load();
    expect(effects.draw("warp", 8, 8, 0)).toBe(true);
  });

  it("isolates twelve clamped linear sources and coalesces repeated loads", async () => {
    const effects = new GroundEffects();
    await Promise.all([effects.load(), effects.load()]);
    await effects.load();
    expect(mocks.load).toHaveBeenCalledTimes(1);
    expect(mocks.load).toHaveBeenCalledWith(expect.stringContaining("sprites/ground-effects.png?v=20261025-portal-protection-v1"));
    expect(mocks.textures).toHaveLength(12);
    expect(new Set(mocks.textures.map(t => (t as { source: { resource: unknown } }).source.resource)).size).toBe(12);
    expect(draws.at(-1)?.slice(1)).toEqual([640, 128, 128, 128, 0, 0, 128, 128]);
    expect(mocks.textures.every(t => {
      const { source } = t as { source: { scaleMode: string; addressMode: string } };
      return source.scaleMode === "linear" && source.addressMode === "clamp-to-edge";
    })).toBe(true);
  });

  it("selects rows and eight-tick loop frames with safe tick boundaries", async () => {
    const effects = new GroundEffects();
    await effects.load();
    for (const [kind, tick, index] of [["warp", 0, 0], ["warp", 7, 0], ["warp", 8, 1], ["warp", 47, 5], ["warp", 48, 0], ["protection", 8, 7], ["warp", -1, 0], ["warp", NaN, 0], ["warp", Infinity, 0]] as const) {
      effects.beginFrame();
      expect(effects.draw(kind, 24, 43, tick)).toBe(true);
      expect((effects.root.children[0] as Sprite).texture).toBe(mocks.textures[index]);
    }
  });

  it("centers fourteen-world-pixel art, hides stale sprites and reuses its pool", async () => {
    const effects = new GroundEffects();
    await effects.load();
    effects.draw("warp", 24, 40, 0);
    effects.draw("protection", 24, 43, 0);
    const [portal, mount] = effects.root.children as Sprite[];
    expect(portal!.anchor.x).toBe(0.5);
    expect(portal!.scale.x).toBe(14 / 128);
    expect(portal!.scale.y).toBe(14 / 128);
    expect(portal!.position.x).toBe(24);
    expect(portal!.position.y).toBe(40);
    expect(mount!.position.y).toBe(43);
    effects.beginFrame();
    expect(portal!.visible).toBe(false);
    expect(mount!.visible).toBe(false);
    effects.draw("protection", 56, 59, 16);
    expect(effects.root.children).toHaveLength(2);
    expect(effects.root.children[0]).toBe(portal);
    expect(portal!.visible).toBe(true);
    expect(mount!.visible).toBe(false);
    expect(mocks.textures).toHaveLength(12);
    expect(mocks.load).toHaveBeenCalledTimes(1);
  });

  it("loads through tile art, places the layer behind items and people, and clears removed effects in lite mode", async () => {
    const renderer = new Renderer(true);
    await renderer.useTileArt();
    expect(mocks.load).toHaveBeenCalledWith(expect.stringContaining("ground-effects.png?v="));
    const state = createMatch({ seed: 1, playerIds: ["a", "b", "c"], blockDensity: 0 });
    state.grid.floor[1 * state.grid.width + 1] = Floor.Warp;
    state.players[0]!.mount = "dasher";
    state.players[1]!.mount = "hopper";
    state.players[2]!.mount = "pusher";
    const snapshot = publicView(state);
    renderer.draw(snapshot, new Map(), 1);
    const layer = renderer.root.children[3]!;
    expect(renderer.root.children.indexOf(layer)).toBe(3);
    const sprites = (layer as unknown as { children: Sprite[] }).children;
    expect(sprites).toHaveLength(4);
    expect(sprites[0]!.position.x).toBe(24);
    expect(sprites[0]!.position.y).toBe(24);
    expect(sprites[1]!.position.y).toBe(snapshot.players[0]!.py / TILE * 16 + 6);
    const world = renderer.root.children[2] as Graphics;
    const hopper = snapshot.players[1]!;
    expect(world.ellipse).not.toHaveBeenCalledWith(hopper.px / TILE * 16, hopper.py / TILE * 16 + 6, 7, 4);
    const dasher = snapshot.players[0]!;
    expect(world.ellipse).not.toHaveBeenCalledWith(dasher.px / TILE * 16, dasher.py / TILE * 16 + 6, 7, 4);
    state.grid.floor[1 * state.grid.width + 1] = Floor.Normal;
    state.players[0]!.mount = null;
    state.players[1]!.alive = false;
    state.players[2]!.mount = null;
    renderer.draw(publicView(state), new Map(), 1);
    expect(sprites.every(sprite => !sprite.visible)).toBe(true);
  });

  it("centers protection on interpolated feet for every facing", async () => {
    const renderer = new Renderer(true);
    await renderer.useTileArt();
    const state = createMatch({ seed: 1, playerIds: ["a"], blockDensity: 0 });
    const player = state.players[0]!;
    player.mount = "dasher";
    const prev = new Map([[player.id, { px: player.px - TILE / 4, py: player.py - TILE / 4 }]]);
    for (const facing of ["up", "down", "left", "right"] as const) {
      player.facing = facing;
      renderer.draw(publicView(state), prev, 0.5);
      const layer = renderer.root.children[3] as unknown as { children: Sprite[] };
      expect(layer.children[0]!.position.x).toBe(player.px / TILE * 16 - 2);
      expect(layer.children[0]!.position.y).toBe(player.py / TILE * 16 - 2 + 6);
    }
  });

  it("keeps primitive portals and per-type protection markers when the atlas is unavailable", async () => {
    const renderer = new Renderer(true);
    mocks.load.mockImplementation((url: string) => url.includes("ground-effects")
      ? Promise.reject(new Error("missing atlas"))
      : Promise.resolve({ width: 128, source: { resource: {} } }));
    await renderer.useTileArt();
    const state = createMatch({ seed: 1, playerIds: ["a"], blockDensity: 0 });
    state.grid.floor[state.grid.width + 1] = Floor.Warp;
    state.players[0]!.mount = "dasher";
    renderer.draw(publicView(state), new Map(), 1);
    const world = renderer.root.children[2] as Graphics;
    expect(world.circle).toHaveBeenCalledWith(24, 24, 6);
    const player = state.players[0]!;
    expect(world.ellipse).toHaveBeenCalledWith(player.px / TILE * 16, player.py / TILE * 16 + 6, 7, 4);
    expect((renderer.root.children[3] as unknown as { children: Sprite[] }).children).toHaveLength(0);
  });
});
