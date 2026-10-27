import { describe, expect, it } from "vitest";
import { paintSheet, SHEETS } from "../src/render/sprites";

describe("John Stewart approved appearance", () => {
  it("uses the complete 18-row redraw", () => {
    expect([SHEETS.lantern.width, SHEETS.lantern.height]).toEqual([1188, 2952]);
    expect([SHEETS.lantern.frameW, SHEETS.lantern.frameH]).toEqual([132, 164]);
    expect(SHEETS.lantern.lobby.frames).toBe(8);
  });

  it("keeps emerald eyes while recoloring the suit", () => {
    const sheet = SHEETS.lantern;
    const region = sheet.colorProtection.rows[0]![0]![0]!;
    const pixels = new Uint8ClampedArray(sheet.width * sheet.frameH * 4);
    const eye = (region.top * sheet.width + region.left) * 4;
    pixels.set([12, 191, 92, 255], eye);
    pixels.set([18, 120, 89, 255], 0);
    paintSheet(pixels, sheet, [232, 74, 74]);
    expect([...pixels.slice(eye, eye + 4)]).toEqual([12, 191, 92, 255]);
    expect([...pixels.slice(0, 4)]).toEqual([232, 74, 74, 255]);
  });
});
