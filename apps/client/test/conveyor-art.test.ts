import { beforeEach, describe, expect, it, vi } from "vitest";
import { Floor } from "@bombtop/shared";

const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("pixi.js", () => {
  class Point { x = 0; y = 0; set(x: number, y = x) { this.x = x; this.y = y; } }
  return {
    Assets: { load: mocks.load },
    Container: class { children: unknown[] = []; addChild(child: unknown) { this.children.push(child); } },
    Sprite: class { anchor = new Point(); scale = new Point(); position = new Point(); visible = true; texture: unknown; },
  };
});
vi.mock("../src/render/texture-cells", () => ({
  isolatedTextureRow: (_image: unknown, row: number, _size: number, frames: number) =>
    Array.from({ length: frames }, (_, frame) => ({ row, frame })),
}));
import { ConveyorArt } from "../src/render/conveyor-art";

beforeEach(() => { mocks.load.mockReset(); mocks.load.mockResolvedValue({ source: { resource: {} } }); });

describe("conveyor art", () => {
  it("uses four directional rows with synchronized looping motion and exact tile bounds", async () => {
    const art = new ConveyorArt();
    expect(art.draw(Floor.ConveyorRight, 16, 32, 0)).toBe(false);
    await art.load();
    const floors = [Floor.ConveyorRight, Floor.ConveyorDown, Floor.ConveyorLeft, Floor.ConveyorUp];
    for (const [row, floor] of floors.entries()) {
      expect(art.draw(floor, row * 16, 32, 6)).toBe(true);
      const sprite = art.root.children[row] as unknown as { texture: unknown; position: { x: number; y: number }; scale: { x: number; y: number } };
      expect(sprite.texture).toEqual({ row, frame: 3 });
      expect(sprite.position).toMatchObject({ x: row * 16, y: 32 });
      expect(sprite.scale).toMatchObject({ x: 0.125, y: 0.125 });
    }
    art.beginFrame();
    art.draw(Floor.ConveyorRight, 0, 0, 32);
    expect(art.root.children[0]).toMatchObject({ texture: { row: 0, frame: 0 }, visible: true });
    expect(art.root.children[1]).toMatchObject({ visible: false });
    expect(art.root.children).toHaveLength(4);
    expect(art.draw(Floor.Normal, 0, 0, 0)).toBe(false);
  });

  it("keeps a still frame for invalid ticks and can retry an unavailable asset", async () => {
    const art = new ConveyorArt();
    mocks.load.mockRejectedValueOnce(new Error("offline"));
    await art.load();
    expect(art.draw(Floor.ConveyorUp, 0, 0, 0)).toBe(false);
    await art.load();
    for (const tick of [Number.NaN, Infinity, -2]) {
      art.beginFrame();
      art.draw(Floor.ConveyorUp, 0, 0, tick);
      expect(art.root.children[0]).toMatchObject({ texture: { row: 3, frame: 0 } });
    }
    await art.load();
    expect(mocks.load).toHaveBeenCalledTimes(2);
  });
});
