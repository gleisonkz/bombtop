import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class PreviewImage {
  onload: (() => void) | null = null;
  url = "";
  set src(value: string) { this.url = value; queueMicrotask(() => this.onload?.()); }
  get src() { return this.url; }
  setAttribute() {}
}

const drawImage = vi.fn();
const toDataURL = vi.fn(() => "data:image/png;base64,preview");
beforeEach(() => {
  vi.resetModules(); drawImage.mockClear(); toDataURL.mockClear();
  vi.stubGlobal("Image", PreviewImage);
  vi.stubGlobal("document", { createElement: (tag: string) => tag === "img" ? new PreviewImage() : {
    width: 0, height: 0, getContext: () => ({ drawImage }), toDataURL,
  } });
});
afterEach(() => vi.unstubAllGlobals());

describe("stage thumbnails", () => {
  it.each(["sb4-01", "sb4-02"] as const)("uses the original Battle Game screenshot for %s", async stage => {
    const { stagePreview } = await import("../src/ui/stage-preview");
    const image = stagePreview(stage);
    expect(image.src).toContain(`sprites/sb4-battle/stage-${stage.slice(-2)}.png`);
    expect(drawImage).not.toHaveBeenCalled();
    expect(toDataURL).not.toHaveBeenCalled();
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
