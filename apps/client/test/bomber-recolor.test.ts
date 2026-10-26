import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { paintSheet, SHEETS } from "../src/render/sprites";
import { CHARACTER_SHEETS } from "../src/ui/sheet-art";
import protection from "../src/render/bomber-paint-regions.json";

const samples = [
  { name: "iron head below the fuse", row: 0, x: 49, y: 66, rgba: [41, 29, 31, 248], preserve: true },
  { name: "red antialiased head contour", row: 0, x: 35, y: 79, rgba: [43, 19, 12, 228], preserve: false },
  { name: "red contour below the head", row: 0, x: 51, y: 103, rgba: [35, 1, 3, 253], preserve: false },
  { name: "neutral black head", row: 0, x: 56, y: 102, rgba: [30, 25, 26, 253], preserve: true },
  { name: "cape collar under the chin", row: 0, x: 48, y: 104, rgba: [255, 10, 30, 253], preserve: false },
  { name: "left cape collar beside the head rim", row: 0, x: 40, y: 99, rgba: [202, 3, 20, 253], preserve: false },
  { name: "curved cape collar below the head", row: 0, x: 43, y: 101, rgba: [193, 2, 20, 253], preserve: false },
  { name: "idle eye fringe", row: 0, x: 47, y: 86, rgba: [195, 49, 46, 253], preserve: true },
  { name: "idle cape highlight", row: 0, x: 20, y: 99, rgba: [255, 83, 27, 248], preserve: false },
  { name: "idle glove highlight", row: 0, x: 34, y: 113, rgba: [253, 66, 29, 253], preserve: false },
  { name: "cast eyes", row: 8, x: 58, y: 93, rgba: [244, 141, 17, 253], preserve: true },
  { name: "cast gloves", row: 8, x: 25, y: 115, rgba: [238, 78, 74, 252], preserve: false },
  { name: "carry eyes", row: 11, x: 47, y: 87, rgba: [250, 148, 13, 253], preserve: true },
  { name: "carry cape", row: 11, x: 19, y: 105, rgba: [251, 82, 29, 249], preserve: false },
  { name: "raised idle gloves", row: 11, x: 33, y: 70, rgba: [253, 45, 32, 255], preserve: false },
  { name: "raised walking gloves", row: 14, x: 34, y: 75, rgba: [249, 58, 32, 253], preserve: false },
  { name: "lobby eyes", row: 17, x: 57, y: 88, rgba: [249, 148, 34, 253], preserve: true },
  { name: "lobby gloves", row: 17, x: 29, y: 109, rgba: [237, 84, 64, 253], preserve: false },
  { name: "walking cape beside the face", row: 3, col: 4, x: 67, y: 106, rgba: [249, 14, 31, 253], preserve: false },
  ...[
    [0, 0, 52, 105, 139, 0, 18, 253],
    [0, 3, 49, 105, 172, 4, 22, 253],
    [11, 0, 52, 105, 132, 17, 41, 254],
    [11, 3, 52, 105, 119, 24, 39, 253],
    [14, 0, 51, 109, 144, 4, 19, 253],
    [14, 3, 52, 107, 190, 14, 19, 253],
    [17, 0, 48, 104, 146, 18, 32, 253],
    [17, 3, 52, 105, 169, 21, 30, 253],
    [2, 0, 43, 101, 251, 47, 29, 253],
    [2, 3, 54, 100, 250, 24, 27, 252],
    [13, 0, 52, 101, 235, 16, 33, 253],
    [13, 3, 52, 101, 236, 13, 34, 253],
    [16, 0, 52, 98, 243, 16, 35, 253],
    [16, 3, 52, 98, 230, 13, 31, 253],
  ].map(([row, col, x, y, ...rgba]) => ({ name: `cape collar row ${row} frame ${col}`, row: row!, col: col!, x: x!, y: y!, rgba, preserve: false })),
];

describe("Bomba spatial recoloring", () => {
  for (const sample of samples) {
    it.each([false, true])(`${sample.name} with cropped row %s`, (cropped) => {
      const sheet = SHEETS.bomber;
      const height = cropped ? sheet.frameH : sheet.height;
      const pixels = new Uint8ClampedArray(sheet.width * height * 4);
      const offset = (((cropped ? 0 : sample.row * sheet.frameH) + sample.y) * sheet.width + (sample.col ?? 0) * sheet.frameW + sample.x) * 4;
      pixels.set(sample.rgba, offset);
      paintSheet(pixels, sheet, [65, 190, 95], cropped ? sample.row : 0);
      const result = [...pixels.slice(offset, offset + 4)];
      if (sample.preserve) expect(result).toEqual(sample.rgba);
      else {
        expect(result[1]).toBeGreaterThan(result[0]!);
        expect(result[1]).toBeGreaterThan(result[2]!);
        expect(result[3]).toBe(sample.rgba[3]);
      }
    });
  }

  it("keeps protection synchronized with the original packed atlas", () => {
    const image = readFileSync(new URL("../public/sprites/bomber-atlas.png", import.meta.url));
    expect(protection.sourceSha256).toBe(createHash("sha256").update(image).digest("hex"));
    expect(protection.rows).toHaveLength(SHEETS.bomber.height / SHEETS.bomber.frameH);
    for (const row of protection.rows) expect(row).toHaveLength(SHEETS.bomber.width / SHEETS.bomber.frameW);
  });

  it("distinguishes identical red pixels in the eyes and cape", () => {
    const sheet = SHEETS.bomber;
    const pixels = new Uint8ClampedArray(sheet.width * sheet.frameH * 4);
    const eye = (86 * sheet.width + 47) * 4;
    const cape = (99 * sheet.width + 20) * 4;
    const rgba = [195, 49, 46, 253];
    pixels.set(rgba, eye);
    pixels.set(rgba, cape);
    paintSheet(pixels, sheet, [65, 190, 95]);
    expect([...pixels.slice(eye, eye + 4)]).toEqual(rgba);
    expect(pixels[cape + 1]).toBeGreaterThan(pixels[cape]!);
  });

  it("scales head protection to the native-resolution menu", () => {
    const sheet = CHARACTER_SHEETS.bomb;
    const pixels = new Uint8ClampedArray(sheet.width * sheet.frameH * 4);
    const eye = (182 * sheet.width + 120) * 4;
    const cape = (197 * sheet.width + 42) * 4;
    const glove = (227 * sheet.width + 68) * 4;
    pixels.set([250, 154, 26, 253], eye);
    pixels.set([255, 83, 33, 251], cape);
    pixels.set([255, 105, 37, 253], glove);
    paintSheet(pixels, sheet, [65, 190, 95]);
    expect([...pixels.slice(eye, eye + 4)]).toEqual([250, 154, 26, 253]);
    expect(pixels[cape + 1]).toBeGreaterThan(pixels[cape]!);
    expect(pixels[glove + 1]).toBeGreaterThan(pixels[glove]!);
  });

  it.each([
    [0, 98, 210, 197, 9, 26],
    [11, 104, 210, 141, 18, 27],
    [14, 104, 214, 215, 18, 28],
    [17, 104, 210, 185, 16, 34],
    [2, 108, 200, 251, 26, 28],
    [13, 104, 202, 238, 14, 34],
    [16, 104, 196, 236, 14, 31],
  ])("recolors the native menu collar in row %s", (row, x, y, r, g, b) => {
    const sheet = CHARACTER_SHEETS.bomb;
    const pixels = new Uint8ClampedArray(sheet.width * sheet.frameH * 4);
    const offset = (y * sheet.width + 3 * sheet.frameW + x) * 4;
    pixels.set([r, g, b, 253], offset);
    paintSheet(pixels, sheet, [65, 190, 95], row);
    expect(pixels[offset + 1]).toBeGreaterThan(pixels[offset]!);
    expect(pixels[offset + 3]).toBe(253);
  });
});
