import { TEST_SHEETS } from "./fixtures/sheets";
import { describe, expect, it } from "vitest";
import { buildHeadAnchors, headAnchor, avoidHeldBomb } from "../src/render/head-anchor";
import { type SheetLayout } from "../src/render/sprites";

const sheet: SheetLayout = { ...TEST_SHEETS.james, width: 24, height: 16, frameW: 8, frameH: 8, anchorX: 4, anchorY: 7, scale: 0.5,
  idle: { down: { row: 0, frames: 1 }, side: { row: 0, frames: 1 }, up: { row: 0, frames: 1 } },
  walk: { down: { row: 0, frames: 1 }, side: { row: 0, frames: 1 }, up: { row: 0, frames: 1 } },
  stun: { row: 1, frames: 2, columns: [0, 2] },
};
const pixels = () => {
  const data = new Uint8ClampedArray(sheet.width * sheet.height * 4);
  const fill = (col: number, top: number, left: number, right: number) => {
    for (let y = top; y < 7; y++) for (let x = left; x <= right; x++) data[((y + 8) * sheet.width + col * 8 + x) * 4 + 3] = 255;
  };
  fill(0, 2, 1, 4); fill(2, 1, 2, 5);
  fill(1, 0, 0, 7);
  return data;
};

describe("opaque head anchors", () => {
  it("measures carry crowns across every frame without mistaking raised side hands for the head", () => {
    const carrySheet: SheetLayout = { ...sheet, bodyH: 8,
      carryIdle: { down: { row: 0, frames: 2 }, side: { row: 0, frames: 2 }, up: { row: 0, frames: 2 } } };
    const data = pixels();
    const opaque = (col: number, x: number, y: number) => { data[(y * sheet.width + col * 8 + x) * 4 + 3] = 255; };
    opaque(0, 0, 0);
    opaque(0, 3, 3);
    opaque(1, 4, 2);
    expect(buildHeadAnchors(data, carrySheet).get(0)?.y).toBe(2);
  });
  it("unifies only playback cells, excluding transparent padding and skipped cells", () => {
    const anchors = buildHeadAnchors(pixels(), sheet);
    expect(anchors.get(1)).toEqual({ x: 3.5, y: 1 });
    for (const x of [0, 16]) expect(headAnchor({ sheet, anchors, frame: { x, y: 8, flip: false }, x: 30, feetY: 50 }))
      .toEqual({ x: 29.75, headY: 47 });
  });
  it("mirrors the opaque center with the same feet and scale as placeSprite", () => {
    expect(headAnchor({ sheet, anchors: buildHeadAnchors(pixels(), sheet), frame: { x: 0, y: 8, flip: true }, x: 30, feetY: 50 }))
      .toEqual({ x: 30.25, headY: 47 });
  });
  it("centers over the opaque head region rather than an outstretched arm or tail", () => {
    const data = pixels();
    data[((8 + 6) * sheet.width + 7) * 4 + 3] = 255;
    expect(buildHeadAnchors(data, sheet).get(1)).toEqual({ x: 3.5, y: 1 });
  });
  it("falls back safely for transparent rows", () => {
    expect(headAnchor({ sheet, anchors: buildHeadAnchors(pixels(), sheet), frame: { x: 0, y: 0, flip: false }, x: 30, feetY: 50 }))
      .toEqual({ x: 30, headY: 50 - sheet.bodyH * 0.5 });
  });
  it("keeps the measured head reference when a carry frame contains raised hands or a baked bomb", () => {
    const anchors = buildHeadAnchors(pixels(), sheet);
    expect(headAnchor({ sheet, anchors, frame: { x: 0, y: 0, flip: false }, headRow: 1, x: 30, feetY: 50 }))
      .toEqual({ x: 29.75, headY: 47 });
  });
  it("keeps the head anchor when a held bomb does not overlap", () => {
    expect(avoidHeldBomb({ x: 30, headY: 40 }, { x: 30, y: 10, rx: 5, ry: 5 })).toEqual({ x: 30, headY: 40 });
  });
  it("clears an overlapping bomb to the closest side without lifting above it", () => {
    const pose = avoidHeldBomb({ x: 30, headY: 40 }, { x: 32, y: 31, rx: 5, ry: 6 });
    expect(pose.headY).toBe(40);
    expect(pose.x + 16).toBeLessThan(32 - 5);
  });
});
