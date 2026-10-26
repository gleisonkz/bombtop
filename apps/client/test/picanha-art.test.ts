import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("pixi.js", () => ({
  Assets: { load: mocks.load },
  Rectangle: class {
    constructor(public x: number, public y: number, public width: number, public height: number) {}
  },
  Texture: class {
    source: unknown;
    frame: unknown;
    constructor(options: { source: unknown; frame: unknown }) {
      this.source = options.source;
      this.frame = options.frame;
    }
  },
}));

import { loadPicanhaArt } from "../src/render/picanha-art";

beforeEach(() => { mocks.load.mockReset(); });

describe("picanha art", () => {
  it("loads four adjacent native 64px frames sharing one nearest-filtered source", async () => {
    const source = { scaleMode: "linear" };
    mocks.load.mockResolvedValue({ source });
    const frames = await loadPicanhaArt();
    expect(mocks.load).toHaveBeenCalledTimes(1);
    expect(mocks.load).toHaveBeenCalledWith(`${import.meta.env.BASE_URL}sprites/picanha-pixel.png`);
    expect(source.scaleMode).toBe("nearest");
    expect(frames).toHaveLength(4);
    expect(new Set(frames).size).toBe(4);
    frames.forEach((texture, index) => {
      expect(texture.source).toBe(source);
      expect(texture.frame).toEqual({ x: index * 64, y: 0, width: 64, height: 64 });
    });
  });

  it("propagates asset failure so the caller can keep its existing fallback", async () => {
    const error = new Error("missing picanha atlas");
    mocks.load.mockRejectedValue(error);
    await expect(loadPicanhaArt()).rejects.toBe(error);
  });
});
