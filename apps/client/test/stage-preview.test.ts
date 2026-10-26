import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMatch, Floor, getFloor, SB4_STAGE_DEFINITIONS, SB4_STAGES, Tile, type StageId } from "@bombtop/shared";
import { TILES, tileCell } from "../src/render/sprites";
import * as shared from "@bombtop/shared";

const battleStages = Array.from({ length: 12 }, (_, index) => `sb4-${String(index + 1).padStart(2, "0")}` as StageId);
const loaded: string[] = [];

class PreviewImage {
  onload: (() => void) | null = null;
  url = "";
  set src(value: string) { this.url = value; loaded.push(value); queueMicrotask(() => this.onload?.()); }
  get src() { return this.url; }
  setAttribute() {}
}

const drawImage = vi.fn();
const moveTo = vi.fn();
const lineTo = vi.fn();
const toDataURL = vi.fn(() => "data:image/png;base64,preview");
beforeEach(() => {
  vi.resetModules(); drawImage.mockClear(); toDataURL.mockClear();
  loaded.length = 0;
  moveTo.mockClear(); lineTo.mockClear();
  vi.stubGlobal("Image", PreviewImage);
  vi.stubGlobal("document", { createElement: (tag: string) => tag === "img" ? new PreviewImage() : {
    width: 0, height: 0, getContext: () => ({ drawImage, moveTo, lineTo, beginPath() {}, stroke() {} }), toDataURL,
  } });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("stage thumbnails", () => {
  it("names all twelve shared battle stages", async () => {
    const { STAGE_NAMES } = await import("../src/ui/stage-names");
    expect(SB4_STAGES).toEqual(battleStages);
    expect(STAGE_NAMES["sb4-01"]).toBe("SB4 01 · Usual");
    expect(STAGE_NAMES["sb4-02"]).toBe("SB4 02 · Fast ’n Slow");
    for (const [index, stage] of battleStages.entries()) {
      if (index < 2) continue;
      expect(STAGE_NAMES[stage]).toBe(`SB4 ${String(index + 1).padStart(2, "0")} · ${SB4_STAGE_DEFINITIONS[index]!.name}`);
    }
  });
  it.each(battleStages)("renders runtime tiles for %s and caches concurrent requests", async stage => {
    const { stagePreview } = await import("../src/ui/stage-preview");
    const image = stagePreview(stage);
    const second = stagePreview(stage);
    await vi.waitFor(() => expect(image.src).toContain("data:image/png"));
    expect(second.src).toBe(image.src);
    const tiles = drawImage.mock.calls.filter(([source]) => source.src.includes(`tiles-${stage.slice(-2)}.png`));
    const { grid } = createMatch({ seed: 14, stage, playerIds: ["preview1", "preview2"], blockDensity: 0.4 });
    expect(tiles).toHaveLength(grid.width * grid.height);
    expect(tiles.map(args => args.slice(1))).toEqual(grid.tiles.map((tile, index) => {
      const x = index % grid.width;
      const y = Math.floor(index / grid.width);
      return [tileCell(tile, x, y, grid.width, grid.height) * TILES.size, 0, TILES.size, TILES.size, x * 32, y * 32, 32, 32];
    }));
    expect(toDataURL).toHaveBeenCalledOnce();
    expect(loaded.some(path => /\/(?:stage|art-preview)-\d/.test(path))).toBe(false);
  });
  it("draws each shared floor overlay from its real PNG and reuses loaded assets", async () => {
    const { stagePreview } = await import("../src/ui/stage-preview");
    const images = battleStages.map(stage => stagePreview(stage));
    await vi.waitFor(() => expect(images.every(image => image.src.startsWith("data:image/png"))).toBe(true));
    const assetPaths = loaded.filter(path => !path.startsWith("data:"));
    expect(new Set(assetPaths).size).toBe(assetPaths.length);
    const props = new Map([
      [Floor.Pit, "forest-pit"], [Floor.Surprise, "direction-panel"], [Floor.Foliage, "foliage"],
      [Floor.Slot, "slot-switch"],
    ]);
    for (const [floor, prop] of props) {
      const expected = battleStages.reduce((count, stage) => {
        const state = createMatch({ seed: 14, stage, playerIds: ["preview1", "preview2"], blockDensity: 0.4 });
        return count + state.grid.tiles.filter((tile, index) => tile === Tile.Empty && getFloor(state, index % state.grid.width, Math.floor(index / state.grid.width)) === floor).length;
      }, 0);
      expect(expected).toBeGreaterThan(0);
      expect(drawImage.mock.calls.filter(([source]) => source.src.endsWith(`prop-${prop}.png`))).toHaveLength(expected);
      expect(loaded.filter(path => path.endsWith(`prop-${prop}.png`))).toHaveLength(1);
    }
  });
  it("connects adjacent rails and draws a single runtime trolley", async () => {
    const stage = "sb4-11" as StageId;
    const state = createMatch({ seed: 14, stage, playerIds: ["preview1", "preview2"], blockDensity: 0.4 });
    state.stageState = { trolley: { px: 5.25 * shared.TILE, py: 3.5 * shared.TILE, dir: "right" } };
    vi.spyOn(await import("@bombtop/shared"), "createMatch").mockReturnValue(state);
    const { stagePreview } = await import("../src/ui/stage-preview");
    const image = stagePreview(stage);
    await vi.waitFor(() => expect(image.src).toContain("data:image/png"));
    expect(lineTo.mock.calls.length).toBeGreaterThan(0);
    expect(moveTo.mock.calls).toHaveLength(lineTo.mock.calls.length);
    const trolley = state.stageState?.trolley;
    expect(trolley).toBeDefined();
    const carts = drawImage.mock.calls.filter(([source]) => source.src.endsWith("prop-trolley.png"));
    expect(carts).toHaveLength(1);
    expect(carts[0]!.slice(1)).toEqual([(trolley!.px / shared.TILE - 0.5) * 32, (trolley!.py / shared.TILE - 0.5) * 32, 32, 32]);
  });
  it.each(["sb4-03", "sb4-09", "sb4-10", "sb4-12"] as StageId[])("draws runtime props for %s", async stage => {
    const state = createMatch({ seed: 14, stage, playerIds: ["preview1", "preview2"], blockDensity: 0.4 });
    const { stagePreview } = await import("../src/ui/stage-preview");
    const image = stagePreview(stage);
    await vi.waitFor(() => expect(image.src).toContain("data:image/png"));
    const dynamic = state.stageState;
    const expected = [
      ["rolling-ball", dynamic?.balls?.length ?? 0], ["seesaw", dynamic?.seesaws?.length ?? 0],
      ["costume-mask", dynamic?.honey?.filter(honey => !honey.takenBy && shared.getTile(state, honey.x, honey.y) === Tile.Empty).length ?? 0],
      ["flag", dynamic?.flags?.filter(flag => !flag.destroyed && !flag.carriedBy).length ?? 0],
    ] as const;
    for (const [prop, count] of expected) {
      expect(drawImage.mock.calls.filter(([source]) => source.src.endsWith(`prop-${prop}.png`))).toHaveLength(count);
    }
  });
  it("renders exposed runtime props while hiding destroyed flags and covered or taken honey", async () => {
    const state = createMatch({ seed: 14, stage: "classic", playerIds: ["preview1", "preview2"], blockDensity: 0 });
    state.stageState = {
      balls: [{ px: 5.5 * shared.TILE, py: 3.5 * shared.TILE, dir: null }],
      flags: [{ x: 1, y: 1 }, { x: 3, y: 1, destroyed: true }, { x: 5, y: 1, carriedBy: "preview1" }],
      seesaws: [{ x: 3, y: 3, dir: "right", raised: false }],
      honey: [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 1, takenBy: "preview1" }],
    };
    vi.spyOn(await import("@bombtop/shared"), "createMatch").mockReturnValue(state);
    const { stagePreview } = await import("../src/ui/stage-preview");
    const image = stagePreview("classic");
    await vi.waitFor(() => expect(image.src).toContain("data:image/png"));
    for (const [prop, x, y] of [["rolling-ball", 5, 3], ["flag", 1, 1], ["seesaw", 3, 3], ["costume-mask", 1, 1]] as const) {
      const draws = drawImage.mock.calls.filter(([source]) => source.src.endsWith(`prop-${prop}.png`));
      expect(draws).toHaveLength(1);
      expect(draws[0]!.slice(1)).toEqual([x * 32, y * 32, 32, 32]);
    }
  });
  it.each(["classic", "conveyor", "warp"] as const)("renders the real %s layout and its matching artwork", async stage => {
    const { stagePreview } = await import("../src/ui/stage-preview");
    const image = stagePreview(stage);
    await vi.waitFor(() => expect(image.src).toContain("data:image/png"));
    const belts = drawImage.mock.calls.filter(([source]) => source.src.includes("conveyors.png"));
    const portals = drawImage.mock.calls.filter(([source]) => source.src.includes("ground-effects.png"));
    expect(belts).toHaveLength(stage === "conveyor" ? 26 : 0);
    expect(portals).toHaveLength(stage === "warp" ? 4 : 0);
    expect(portals.every(args => args[2] === 0)).toBe(true);
    const count = drawImage.mock.calls.length;
    stagePreview(stage);
    await Promise.resolve();
    expect(drawImage.mock.calls).toHaveLength(count);
    expect(toDataURL).toHaveBeenCalledOnce();
  });
});
