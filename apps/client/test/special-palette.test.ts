import { afterEach, describe, expect, it, vi } from "vitest";
import { Rectangle, Texture, TextureSource } from "pixi.js";
import { specialEffectColor, specialInk, specialTexture } from "../src/render/special-palette";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("special palette", () => {
  it("treats the white selection as original artwork just like character painting", () => {
    const colors = [0xf5f5f5, 0x3a3a48, 0xe84a4a, 0x3d7bf2, 0x45c25b];
    expect(specialEffectColor({}, 0, colors)).toBeNull();
    for (let seat = 0; seat < colors.length; seat++) {
      expect(specialEffectColor({ ownColors: true }, seat, colors)).toBeNull();
    }
    expect(specialEffectColor({}, 3, colors)).toBe(0x3d7bf2);
  });
  it.each([0xf5f5f5, 0x3a3a48, 0xe84a4a])("preserves actual bright cores against selected color %i", (color) => {
    const amber = specialInk(0xffb63c, color);
    expect(amber).toBe(color);
    for (const core of [0xb9f1ff, 0xfff3cf, 0xffefb9]) {
      expect(specialInk(core, color)).toBe(core);
      expect(specialInk(core, color)).not.toBe(amber);
    }
  });
  it("keeps missing and original owners neutral and follows the seat fallback", () => {
    expect(specialEffectColor(undefined, 1, [0xff0000, 0x00ff00])).toBeNull();
    expect(specialEffectColor({ ownColors: true }, 1, [0xff0000, 0x00ff00])).toBeNull();
    expect(specialEffectColor({}, 1, [0xff0000, 0x00ff00])).toBe(0x00ff00);
    expect(specialEffectColor({}, 99, [0xff0000])).toBe(0xff0000);
    expect(specialEffectColor({}, -1, [0xff0000])).toBeNull();
  });
  it("preserves original textures without touching canvas", () => {
    const texture = new Texture();
    expect(specialTexture(texture, null)).toBe(texture);
    expect(specialTexture(texture, undefined)).toBe(texture);
    expect(specialInk(0x124578, null)).toBe(0x124578);
  });
  it("retains white cores and shadows while mapping colored shades", () => {
    expect(specialInk(0xffffff, 0xff0000)).toBe(0xffffff);
    expect(specialInk(0xe0e1e3, 0xff0000)).toBe(0xe0e1e3);
    expect(specialInk(0x080810, 0xff0000)).toBe(0x080810);
    const dark = specialInk(0x004080, 0xff0000);
    const light = specialInk(0x0080ff, 0xff0000);
    expect(dark & 0xffff).toBe(0);
    expect(light & 0xffff).toBe(0);
    expect(light).toBeGreaterThan(dark);
  });
  it("caches colors per atlas, preserves alpha and frame metadata", () => {
    const pixels = new Uint8ClampedArray([0, 128, 255, 127, 255, 255, 255, 255, 8, 8, 16, 255, 20, 40, 80, 0]);
    const outputs: Uint8ClampedArray[] = [];
    const drawImage = vi.fn();
    vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage, getImageData: () => ({ data: pixels.slice() }), putImageData: (data: {data: Uint8ClampedArray}) => outputs.push(data.data) }) }) });
    vi.spyOn(Texture, "from").mockImplementation(() => new Texture({ source: new TextureSource({ width: 4, height: 1 }) }));
    const source = new TextureSource({ resource: {} as HTMLCanvasElement, width: 4, height: 1 });
    const frame = new Rectangle(0, 0, 2, 1);
    const orig = new Rectangle(0, 0, 3, 2);
    const trim = new Rectangle(1, 1, 2, 1);
    const texture = new Texture({ source, frame, orig, trim, rotate: 0 });
    const other = new Texture({ source, frame: new Rectangle(2, 0, 2, 1) });
    const red = specialTexture(texture, 0xff0000);
    expect(red).toBe(specialTexture(texture, 0xff0000));
    expect(specialTexture(other, 0xff0000).source).toBe(red.source);
    expect(specialTexture(texture, 0x00ff00).source).not.toBe(red.source);
    expect(drawImage).toHaveBeenCalledTimes(2);
    expect(red.frame).toEqual(frame);
    expect(red.orig).toEqual(orig);
    expect(red.trim).toEqual(trim);
    expect(outputs[0]).toEqual(new Uint8ClampedArray([255, 0, 0, 127, 255, 255, 255, 255, 8, 8, 16, 255, 20, 40, 80, 0]));
    expect(pixels[0]).toBe(0);
  });
});
