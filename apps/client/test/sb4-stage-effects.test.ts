import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMatch, Floor, placePlayerAt, step, TILE, Tile } from "@bombtop/shared";
const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("pixi.js", () => {
  class Point { x = 0; y = 0; set(x: number, y = x) { this.x = x; this.y = y; } }
  class Container { children: unknown[] = []; addChild(...nodes: unknown[]) { this.children.push(...nodes); } }
  class Sprite { anchor = new Point(); position = new Point(); scale = new Point(); skew = new Point(); visible = true; texture: unknown; alpha = 1; rotation = 0; }
  class Graphics {
    clear = vi.fn(() => { this.moveTo.mockClear(); this.lineTo.mockClear(); this.stroke.mockClear(); return this; });
    moveTo = vi.fn((_x: number, _y: number) => this);
    lineTo = vi.fn((_x: number, _y: number) => this);
    stroke = vi.fn(() => this);
    roundRect = vi.fn(() => this);
    fill = vi.fn(() => this);
  }
  class Text { anchor = new Point(); position = new Point(); visible = true; text = ""; alpha = 1; }
  return { Assets: { load: mocks.load }, Container, Sprite, Graphics, Text };
});
import { Sb4StageEffects, seesawBombLift, seesawStandLift, stageFlightLift } from "../src/render/sb4-stage-effects";
import { Graphics } from "pixi.js";

const PROP_COUNT = 13;
beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mocks.load.mockReset().mockImplementation((url: string) => Promise.resolve({ width: 128, height: 128, url, source: {} }));
});
afterEach(() => vi.restoreAllMocks());
function arena() {
  const state = createMatch({ seed: 1, playerIds: ["qa"], blockDensity: 0 });
  state.grid.floor.fill(Floor.Normal);
  state.grid.tiles.fill(Tile.Empty);
  return state;
}
function visible(layer: { children: unknown[] }) {
  return layer.children.filter(node => (node as { visible?: boolean }).visible) as { texture: { url: string }; position: { x: number; y: number }; alpha: number; rotation: number }[];
}
describe("SB4 prop presentation", () => {
  it("hides station rails until boarding and clears them when the phase disappears", () => {
    const effects = new Sb4StageEffects();
    const state = arena();
    state.stage = "sb4-11";
    state.grid.floor[20] = Floor.Rail;
    state.grid.floor[21] = Floor.Rail;
    const trolley = { px: TILE * 5.5, py: TILE * 1.5, dir: "left" as const,
      route: [{ x: 3, y: 3 }, { x: 3.25, y: 3 }] };
    state.stageState = { trolley };
    const rails = effects.ground.children[0] as Graphics;
    effects.draw(state);
    expect(rails.stroke).not.toHaveBeenCalled();
    state.stageState.trolley!.phase = "boarding";
    effects.draw(state);
    expect(rails.stroke).toHaveBeenCalled();
    delete state.stageState.trolley!.phase;
    effects.draw(state);
    expect(rails.stroke).not.toHaveBeenCalled();
  });
  it.each(["boarding", "riding", "leaving"] as const)("draws only the selected fractional route while %s, synchronously", async phase => {
    const effects = new Sb4StageEffects();
    await effects.load();
    const state = arena();
    state.stage = "sb4-11";
    state.grid.floor[20] = Floor.Rail;
    state.grid.floor[21] = Floor.Rail;
    state.stageState = { trolley: { px: TILE * 5.5, py: TILE * 1.5, dir: "left", phase,
      route: [{ x: 3, y: 3 }, { x: 3.25, y: 3 }, { x: 3.375, y: 3.125 }, { x: 3.375, y: 3.375 }] } };
    const before = JSON.stringify(state);
    const rails = effects.ground.children[0] as Graphics;
    expect(effects.draw(state)).toBeUndefined();
    expect(rails.moveTo).toHaveBeenCalledWith(56, 56);
    expect(vi.mocked(rails.moveTo).mock.calls.every(([x, y]) => x === 56 && y === 56)).toBe(true);
    expect(rails.lineTo).toHaveBeenCalledWith(60, 56);
    expect(rails.lineTo).toHaveBeenCalledWith(62, 58);
    expect(rails.lineTo).toHaveBeenCalledWith(62, 62);
    expect(vi.mocked(rails.lineTo).mock.calls.every(([x, y]) => [[60, 56], [62, 58], [62, 62]].some(point => point[0] === x && point[1] === y))).toBe(true);
    effects.draw(state);
    expect(mocks.load).toHaveBeenCalledTimes(PROP_COUNT);
    expect(JSON.stringify(state)).toBe(before);
  });
  it("keeps static floor rails as a fallback without a trolley", () => {
    const effects = new Sb4StageEffects();
    const state = arena();
    state.grid.floor[20] = Floor.Rail;
    state.grid.floor[21] = Floor.Rail;
    effects.draw(state);
    expect((effects.ground.children[0] as Graphics).stroke).toHaveBeenCalled();
  });
  it("caches concurrent loads and draws synchronously without loading in frames", async () => {
    const effects = new Sb4StageEffects();
    await Promise.all([effects.load(), effects.load()]);
    expect(mocks.load).toHaveBeenCalledTimes(PROP_COUNT);
    const state = arena();
    state.stageState = { balls: [{ px: TILE * 3.5, py: TILE * 2.5, dir: "right" }] };
    effects.draw(state);
    expect(visible(effects.ground).some(node => node.texture.url.includes("rolling-ball"))).toBe(true);
    expect(visible(effects.ground).find(node => node.texture.url.includes("rolling-ball"))!.position).toMatchObject({ x: 56, y: 40 });
    effects.draw(state);
    expect(mocks.load).toHaveBeenCalledTimes(PROP_COUNT);
    state.stageState = {};
    effects.draw(state);
    expect(visible(effects.ground)).toHaveLength(0);
  });
  it("uses getFloor for static props, keeps foliage above actors and does not repeat a trolley per rail", async () => {
    const effects = new Sb4StageEffects(); await effects.load();
    const state = arena();
    state.grid.floor[18] = Floor.Foliage;
    state.grid.floor[19] = Floor.Pit;
    state.grid.floor[20] = Floor.Rail;
    state.grid.floor[21] = Floor.Rail;
    state.stageState = { trolley: { px: TILE * 5.5, py: TILE * 1.5, dir: "left" } };
    effects.draw(state);
    expect(visible(effects.above).map(node => node.texture.url)).toEqual([expect.stringContaining("foliage")]);
    expect(visible(effects.ground).filter(node => node.texture.url.includes("trolley"))).toHaveLength(1);
    expect(visible(effects.ground).some(node => node.texture.url.includes("forest-pit"))).toBe(true);
  });
  it("draws foliage over a pillar it grows on, as SB4 stage 7 hides some", async () => {
    const effects = new Sb4StageEffects(); await effects.load();
    const state = arena();
    state.grid.tiles[18] = Tile.Wall;
    state.grid.floor[18] = Floor.Foliage;
    state.grid.tiles[19] = Tile.Wall;
    state.grid.floor[19] = Floor.Pit;
    effects.draw(state);
    expect(visible(effects.above).map(node => node.texture.url)).toEqual([expect.stringContaining("foliage")]);
    expect(visible(effects.ground).some(node => node.texture.url.includes("forest-pit"))).toBe(false);
  });
  it("renders only exposed unclaimed costumes without mutating state", async () => {
    const effects = new Sb4StageEffects(); await effects.load();
    const state = arena();
    state.stageState = { honey: [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1, takenBy: "qa" }] };
    state.grid.tiles[state.grid.width + 2] = Tile.Block;
    const before = JSON.stringify(state);
    effects.draw(state);
    expect(visible(effects.ground).filter(node => node.texture.url.includes("costume-mask"))).toHaveLength(1);
    expect(JSON.stringify(state)).toBe(before);
    effects.costume({ x: 30, y: 40, alpha: 0.25 });
    expect(visible(effects.above).at(-1)).toMatchObject({ alpha: 0.25, position: { x: 30, y: 40 } });
  });
  it("retries only failed assets and preserves the loaded ones", async () => {
    mocks.load.mockRejectedValueOnce(new Error("offline"));
    const effects = new Sb4StageEffects(); await effects.load(); await effects.load();
    expect(mocks.load).toHaveBeenCalledTimes(PROP_COUNT + 1);
  });
});

it("colors surviving defensive flags by owner and hides destroyed flags", async () => {
  const effects = new Sb4StageEffects(); await effects.load();
  const state = arena();
  state.stageState = { flags: [{ x: 2, y: 3, ownerId: "qa" }, { x: 4, y: 3, ownerId: "qa", destroyed: true }] };
  effects.draw(state, id => id === "qa" ? 0xe84a4a : undefined);
  const flags = visible(effects.ground).filter(node => node.texture.url.includes("flag"));
  expect(flags).toHaveLength(1);
  expect(flags[0]).toMatchObject({ tint: 0xe84a4a });
});

it.each([undefined, "normal"] as const)("keeps ordinary surprise floor free of effect indicators (%s)", async kind => {
  const effects = new Sb4StageEffects(); await effects.load();
  const state = arena();
  state.grid.floor[18] = Floor.Surprise;
  state.stageState = kind ? { surprise: { 18: { kind, hits: 1 } } } : {};
  effects.draw(state);
  expect(visible(effects.ground).filter(node => node.texture.url.includes("direction-panel"))).toHaveLength(0);
});

it("tints surprise panels from authoritative kind without changing their state", async () => {
  const effects = new Sb4StageEffects(); await effects.load();
  const state = arena();
  state.grid.floor[18] = Floor.Surprise;
  state.stageState = { surprise: { 18: { kind: "ice", hits: 2 } } };
  effects.draw(state);
  expect(visible(effects.ground).find(node => node.texture.url.includes("direction-panel"))).toMatchObject({ tint: 0x9ee8ff });
  expect(state.stageState.surprise![18]).toEqual({ kind: "ice", hits: 2 });
});



it("shows server reel symbols and stopped state without choosing a result", async () => {
  const effects = new Sb4StageEffects(); await effects.load();
  const state = arena();
  state.stageState = { roulette: { cooldown: 0, until: 99, active: true, reels: ["seven", "bar", "skull"], stopped: [true, false, true] } };
  effects.draw(state);
  const labels = effects.above.children.filter(child => "text" in child) as unknown as { text: string; alpha: number; visible: boolean }[];
  expect(labels.map(label => label.text)).toEqual(["7", "BAR", "SKULL"]);
  expect(labels.map(label => label.alpha)).toEqual([1, 0.55, 1]);
  state.stageState = {};
  effects.draw(state);
  expect(labels.every(label => !label.visible)).toBe(true);
});

type Drawn = { texture: { url: string }; position: { x: number; y: number }; rotation: number; scale: { x: number; y: number }; skew: { x: number; y: number }; anchor: { x: number; y: number } };
function seesawParts(effects: Sb4StageEffects) {
  const parts = visible(effects.ground) as unknown as Drawn[];
  return { bases: parts.filter(node => node.texture.url.includes("seesaw-base")), planks: parts.filter(node => node.texture.url.includes("seesaw-plank")) };
}
function seesawArena(raised: boolean, dir: "right" | "left" = "right") {
  const state = arena();
  state.stage = "sb4-09";
  for (const x of [2, 3, 4]) state.grid.floor[3 * state.grid.width + x] = Floor.Seesaw;
  state.stageState = { seesaws: [{ x: 3, y: 3, dir, raised }] };
  return state;
}

it("draws each seesaw once from its pivot: a fixed base and a three-tile plank", async () => {
  const effects = new Sb4StageEffects(); await effects.load();
  const state = arena();
  state.grid.floor.fill(Floor.Seesaw);
  state.stageState = { seesaws: [
    { x: 3, y: 3, dir: "right", raised: false }, { x: 9, y: 3, dir: "down", raised: false },
    { x: 3, y: 9, dir: "left", raised: false }, { x: 9, y: 9, dir: "up", raised: true },
  ] };
  effects.draw(state);
  const { bases, planks } = seesawParts(effects);
  expect(bases).toHaveLength(4);
  expect(planks).toHaveLength(4);
  expect(visible(effects.ground).some(node => /seesaw(?!-)/.test(node.texture.url))).toBe(false);
  expect(planks[0]!.position.x).toBe(56);
  expect(planks[0]!.scale.x * 128).toBeGreaterThanOrEqual(48);
});

it("lays a horizontal plank flat in its own row, the right way up, never rotated", async () => {
  const effects = new Sb4StageEffects(); await effects.load();
  for (const dir of ["right", "left"] as const) for (const raised of [false, true]) {
    effects.draw(seesawArena(raised, dir));
    const { bases, planks } = seesawParts(effects);
    const plank = planks[0]!;
    expect(plank.rotation).toBe(0);
    expect(plank.scale.y).toBeGreaterThan(0);
    // The plank lies across the row its ends are walked on (tile row 3: y 48..64), not half a tile above it.
    expect(plank.position.y).toBeGreaterThanOrEqual(48);
    expect(plank.position.y).toBeLessThan(64);
    // The base stands on the pivot tile and does not tilt with the plank.
    expect(bases[0]!.rotation).toBe(0);
    expect(bases[0]!.skew.y).toBe(0);
    expect(bases[0]!.position.x).toBe(56);
  }
});

it("tilts only the plank, by raising one end, and flips it when the seesaw turns", async () => {
  const effects = new Sb4StageEffects(); await effects.load();
  effects.draw(seesawArena(false));
  const level = seesawParts(effects);
  const flat = { skew: level.planks[0]!.skew.y, base: { ...level.bases[0]!.position } };
  effects.draw(seesawArena(true));
  const turned = seesawParts(effects);
  expect(flat.skew).not.toBe(0);
  expect(turned.planks[0]!.skew.y).toBeCloseTo(-flat.skew);
  expect(turned.bases[0]!.position).toEqual(flat.base);
  // raised=false: the +dir (right) end is down, so the plank falls to the right (screen y grows with x).
  expect(flat.skew).toBeGreaterThan(0);
  effects.draw(seesawArena(false, "left"));
  expect(seesawParts(effects).planks[0]!.skew.y).toBeLessThan(0);
});

it("stands a player on the plank: the high end above the low one, nothing off it", () => {
  const raised = seesawArena(false); // +dir (right, x 4) end down, left (x 2) up
  const at = (x: number) => seesawStandLift(raised, x * 16 + 8, 3 * 16 + 8);
  expect(at(2)).toBeGreaterThan(at(3));
  expect(at(3)).toBeGreaterThan(at(4));
  expect(at(4)).toBeGreaterThan(0);
  expect(at(5)).toBe(0);
  expect(seesawStandLift(raised, 4 * 16 + 8, 4 * 16 + 8)).toBe(0);
  const turned = seesawArena(true);
  expect(seesawStandLift(turned, 4 * 16 + 8, 56)).toBe(at(2));
  expect(seesawStandLift(arena(), 56, 56)).toBe(0);
});

it("draws up the end a player steps on to tip the seesaw, as in Super Bomberman 4", () => {
  for (const seed of [1, 2]) {
    const state = createMatch({ seed, playerIds: ["qa"], stage: "sb4-09", revenge: false });
    step(state, {});
    for (const saw of state.stageState!.seesaws!) for (const dx of [-1, 0, 1]) state.grid.tiles[saw.y * state.grid.width + saw.x + dx] = Tile.Empty;
    const saw = state.stageState!.seesaws![0]!;
    const lift = (x: number) => seesawStandLift(state, x * 16 + 8, saw.y * 16 + 8);
    const up = lift(saw.x - 1) > lift(saw.x + 1) ? saw.x - 1 : saw.x + 1;
    const before = saw.raised;
    placePlayerAt(state, "qa", up, saw.y);
    for (let t = 0; t < 4; t++) step(state, {});
    expect(saw.raised).not.toBe(before);
  }
});

it("rests a bomb on the plank like a player, but not one in the air or in hand", () => {
  const state = seesawArena(true); // right end (x 4) up
  const high = { x: 4 * 16 + 8, y: 3 * 16 + 8 };
  expect(seesawBombLift(state, {}, high.x, high.y)).toBe(seesawStandLift(state, high.x, high.y));
  expect(seesawBombLift(state, {}, high.x, high.y)).toBeGreaterThan(0);
  expect(seesawBombLift(state, { air: {} }, high.x, high.y)).toBe(0);
  expect(seesawBombLift(state, { heldBy: "qa" }, high.x, high.y)).toBe(0);
  expect(seesawBombLift(state, {}, 6 * 16 + 8, high.y)).toBe(0);
});

it("lifts stage flights on a 24-tick parabola without double-lifting carried players", () => {
  const pose = { y: 100, bodyHeight: 24, elevated: false };
  expect(stageFlightLift({ ...pose, flight: { ticks: 24 } })).toBe(0);
  expect(stageFlightLift({ ...pose, flight: { ticks: 12 } })).toBe(12);
  expect(stageFlightLift({ ...pose, flight: { ticks: 6 } })).toBe(9);
  expect(stageFlightLift({ ...pose, flight: { ticks: 0 } })).toBe(0);
  expect(stageFlightLift({ ...pose, flight: undefined })).toBe(0);
  expect(stageFlightLift({ ...pose, flight: { ticks: 12 }, elevated: true })).toBe(0);
});

it("uses the ROM seesaw hop profile rather than the legacy flight parabola", () => {
  const pose = { y: 80, bodyHeight: 24, elevated: false };
  expect(stageFlightLift({ ...pose, flight: { kind: "seesaw", ticks: 16 } })).toBe(0);
  expect(stageFlightLift({ ...pose, flight: { kind: "seesaw", ticks: 12 } })).toBe(6);
  expect(stageFlightLift({ ...pose, flight: { kind: "seesaw", ticks: 8 } })).toBe(16);
  expect(stageFlightLift({ ...pose, elevated: true, flight: { kind: "seesaw", ticks: 8 } })).toBe(0);
});

it("renders the repeated native C22026 rebound arcs through the shared lift profile", () => {
  const pose = { y: 79, bodyHeight: 24, elevated: false };
  expect(stageFlightLift({ ...pose, flight: { kind: "seesawRebound", ticks: 32 } })).toBe(0);
  expect(stageFlightLift({ ...pose, flight: { kind: "seesawRebound", ticks: 31 } })).toBe(4);
  expect(stageFlightLift({ ...pose, flight: { kind: "seesawRebound", ticks: 30 } })).toBe(6);
  expect(stageFlightLift({ ...pose, flight: { kind: "seesawRebound", ticks: 24 } })).toBe(0);
  expect(stageFlightLift({ ...pose, flight: { kind: "seesawRebound", ticks: 23 } })).toBe(4);
});

it("caps flight lift at the top edge so the measured character body stays inside the viewport", () => {
  const flight = Object.freeze({ ticks: 12 });
  for (const y of [24, 25, 30, 32, 48]) {
    const lift = stageFlightLift({ flight, y, bodyHeight: 24, elevated: false });
    expect(lift).toBe(Math.min(12, y - 24));
    expect(y - lift - 24).toBeGreaterThanOrEqual(0);
  }
  expect(flight.ticks).toBe(12);
});
