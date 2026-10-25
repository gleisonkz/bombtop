import { afterEach, describe, expect, it, vi } from "vitest";
import { FLAMES } from "../src/render/sprites";

const mocks = vi.hoisted(() => ({ load: vi.fn(), textures: [] as { source: { resource: unknown; scaleMode: string; addressMode: string } }[] }));
vi.mock("pixi.js", () => ({
  Assets: { load: mocks.load },
  Texture: { from: (resource: unknown) => {
    const texture = { source: { resource, scaleMode: "nearest", addressMode: "repeat" } };
    mocks.textures.push(texture);
    return texture;
  } },
}));

import { loadFlameArt } from "../src/render/flame-art";

afterEach(() => { vi.unstubAllGlobals(); mocks.textures.length = 0; });

describe("flame texture isolation", () => {
  it("gives every lifetime frame its own clamped pixel source to prevent neighbour bleeding", async () => {
    const sheet = {};
    const draws: unknown[][] = [];
    mocks.load.mockResolvedValue({ source: { resource: sheet } });
    vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => ({
      drawImage: (...args: unknown[]) => draws.push(args),
      save: vi.fn(), restore: vi.fn(), translate: vi.fn(), rotate: vi.fn(),
    }) }) });
    const art = await loadFlameArt();
    const textures = [...art.center.flat(), ...art.mid.flat(), ...art.end];
    expect(textures).toHaveLength(105);
    expect(new Set(textures.map(t => t.source.resource)).size).toBe(105);
    expect(art.center).toHaveLength(16);
    expect(textures.every(t => t.source.scaleMode === "linear")).toBe(true);
    expect(textures.every(t => t.source.addressMode === "clamp-to-edge")).toBe(true);
    expect(draws).toContainEqual([sheet, 0, 0, 128, 128, 0, 0, 128, 128]);
    expect(draws).toContainEqual([sheet, 512, 640, 128, 128, 0, 0, 128, 128]);
    expect(art.mid).toHaveLength(FLAMES.variants);
  });
});
