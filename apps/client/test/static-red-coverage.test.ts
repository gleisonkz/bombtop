import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { paintSheet, SHEETS } from "../src/render/sprites";

const path = fileURLToPath(new URL("../public/sprites/static-final.png", import.meta.url));
const raw = new Uint8ClampedArray(execFileSync("python", ["-c", "from PIL import Image; import sys; sys.stdout.buffer.write(Image.open(sys.argv[1]).convert('RGBA').tobytes())", path], { maxBuffer: 64 * 1024 * 1024 }));

// Physical disc samples measured from the ten option4 menu poses.
const discs = [
  [0, [63, 201, 146, 152, 161, 255]],
  [1, [61, 201, 0, 2, 4, 255]],
  [2, [49, 201, 53, 56, 58, 255]],
  [3, [88, 201, 156, 163, 172, 255]],
  [4, [68, 201, 148, 156, 164, 255]],
  [5, [74, 201, 141, 148, 158, 255]],
  [6, [128, 200, 77, 87, 98, 255]],
  [7, [74, 201, 143, 151, 162, 255]],
  [8, [63, 201, 146, 152, 161, 255]],
  [9, [39, 201, 57, 62, 73, 255]],
] as const;

it.each([false, true])("preserves physical discs and all alpha (cropped: %s)", (cropped) => {
  const sheet = SHEETS.static;
  const start = cropped ? 17 * sheet.frameH * sheet.width * 4 : 0;
  const original = cropped ? raw.slice(start, start + sheet.frameH * sheet.width * 4) : raw;
  const pixels = original.slice();
  paintSheet(pixels, sheet, [220, 40, 40], cropped ? 17 : 0);
  expect(discs).toHaveLength(10);
  for (const [column, [x, y, ...rgba]] of discs) {
    const index = ((17 * sheet.frameH + y) * sheet.width + column * sheet.frameW + x) * 4 - start;
    expect([...original.slice(index, index + 4)], `source disc ${column}`).toEqual(rgba);
    expect([...pixels.slice(index, index + 4)], `disc ${column}`).toEqual(rgba);
  }
  expect(pixels.some((value, index) => index % 4 === 3 && value !== original[index])).toBe(false);
});
