import { describe, expect, it } from "vitest";
import { paintSheet, SHEETS } from "../src/render/sprites";

describe("Spider-Man selected colors", () => {
  it("changes blue suit panels to red while preserving red fabric, eyes and alpha", () => {
    const pixels = new Uint8ClampedArray([
      5, 89, 194, 255,
      210, 35, 42, 255,
      245, 245, 245, 255,
      5, 89, 194, 0,
    ]);
    paintSheet(pixels, SHEETS.spider, [232, 74, 74]);
    expect([...pixels.slice(0, 4)]).toEqual([232, 74, 74, 255]);
    expect([...pixels.slice(4)]).toEqual([
      210, 35, 42, 255, 245, 245, 245, 255, 5, 89, 194, 0,
    ]);
  });

  it("keeps original colors for the original white selection", () => {
    const pixels = new Uint8ClampedArray([5, 89, 194, 255]);
    paintSheet(pixels, SHEETS.spider, [245, 245, 245]);
    expect([...pixels]).toEqual([5, 89, 194, 255]);
  });

  it("preserves blue-tinted eye whites while repainting the suit", () => {
    const sheet = SHEETS.spider;
    const region = sheet.colorProtection.rows[0]![0]![0]!;
    const pixels = new Uint8ClampedArray(sheet.width * sheet.frameH * 4);
    const eye = (region.top * sheet.width + region.left) * 4;
    pixels.set([152, 169, 195, 255], eye);
    pixels.set([5, 89, 194, 255], 0);
    paintSheet(pixels, sheet, [232, 74, 74]);
    expect([...pixels.slice(eye, eye + 4)]).toEqual([152, 169, 195, 255]);
    expect([...pixels.slice(0, 4)]).toEqual([232, 74, 74, 255]);
  });
});
