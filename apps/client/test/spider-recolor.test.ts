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
});
