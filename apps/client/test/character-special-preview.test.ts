import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { specialShowcase } from "../src/game/showcase";

const mocks = vi.hoisted(() => ({ draw: vi.fn(), colors: vi.fn(), options: [] as unknown[] }));
vi.mock("pixi.js", () => ({ Application: class {
  canvas = { parentElement: null };
  stage = { addChild() {}, scale: { set() {} }, position: { set() {} } };
  ticker = { start() {}, stop() {}, add() {} };
  renderer = { resize() {} };
  async init() {}
} }));
vi.mock("../src/render/renderer", () => ({ TILE_PX: 16, Renderer: class {
  root = {};
  constructor(...args: unknown[]) { mocks.options.push(args); }
  setCharacters() {}
  setColors = mocks.colors;
  draw = mocks.draw;
  async useTileArt() {} async useItemArt() {} async useBombArt() {} async useFlameArt() {}
  async useKameArt() {} async useRasenganArt() {} async useBubbleArt() {} async usePatronusArt() {}
  async useTruckArt() {} async useBallArt() {} async useSpiralArt() {} async useSheet() {}
} }));
import { ItemPreview } from "../src/ui/item-preview";

beforeEach(() => {
  mocks.draw.mockReset(); mocks.colors.mockReset(); mocks.options.length = 0;
  vi.stubGlobal("window", { devicePixelRatio: 1, addEventListener() {} });
});
afterEach(() => vi.unstubAllGlobals());

describe("character special preview palette", () => {
  it("updates the preview caster while keeping special artwork in its original colors", async () => {
    const scene = specialShowcase("bomb");
    const onView = vi.fn();
    const preview = new ItemPreview(onView, { characterColors: true });
    preview.setCharacterColor("#3d7bf2");
    await preview.play(scene, { clientWidth: 416, appendChild() {} } as unknown as HTMLElement);
    const tick = () => (preview as unknown as { frame(ms: number): void }).frame(0);
    tick();
    expect(mocks.options[0]).toEqual([false]);
    expect(mocks.colors).toHaveBeenLastCalledWith(new Map([["you", 3], ["rival", -1]]));
    let view = mocks.draw.mock.lastCall![0];
    expect(view.players.find((p: { id: string }) => p.id === "you").ownColors).toBeUndefined();
    expect(view.players.find((p: { id: string }) => p.id === "rival").ownColors).toBe(true);
    expect(scene.state.players[0]!.ownColors).toBe(true);
    const audioFrames = onView.mock.calls.length;
    preview.setCharacterColor(null);
    expect(onView).toHaveBeenCalledTimes(audioFrames);
    tick();
    view = mocks.draw.mock.lastCall![0];
    expect(mocks.colors).toHaveBeenLastCalledWith(new Map([["you", -1], ["rival", -1]]));
    expect(view.players[0].ownColors).toBe(true);
  });

  it("leaves ordinary item previews unchanged", async () => {
    const preview = new ItemPreview();
    preview.setCharacterColor("#3d7bf2");
    await preview.play(specialShowcase("goku"), { clientWidth: 416, appendChild() {} } as unknown as HTMLElement);
    (preview as unknown as { frame(ms: number): void }).frame(0);
    expect(mocks.options[0]).toEqual([false]);
    expect(mocks.draw.mock.lastCall![0].players[0].ownColors).toBe(true);
  });
});
