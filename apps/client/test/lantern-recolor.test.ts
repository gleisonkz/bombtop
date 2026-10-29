import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { paintSheet, SHEETS } from "../src/render/sprites";

const path = fileURLToPath(new URL("../public/sprites/lantern.png", import.meta.url));
const raw = new Uint8ClampedArray(execFileSync("python", ["-c", "from PIL import Image; import sys; sys.stdout.buffer.write(Image.open(sys.argv[1]).convert('RGBA').tobytes())", path], { maxBuffer: 16 * 1024 * 1024 }));

it("reproduces Lantern's head protection against the production atlas", () => {
  const script = fileURLToPath(new URL("../scripts/build-lantern-paint-regions.py", import.meta.url));
  expect(execFileSync("python", ["-B", script, "--check"], { encoding: "utf8" }))
    .toContain("Lantern head silhouette matches the production atlas");
});

it.each([[58, 58, 72], [232, 74, 74], [61, 123, 242], [69, 194, 91]] as const)(
  "recolors Lantern's collar while preserving the face and irises for %j", (r, g, b) => {
    const sheet = SHEETS.lantern;
    const pixels = raw.slice();
    paintSheet(pixels, sheet, [r, g, b]);
    const collar = (83 * sheet.width + 46) * 4;
    expect([...raw.slice(collar, collar + 3)]).toEqual([22, 123, 94]);
    expect([...pixels.slice(collar, collar + 3)]).not.toEqual([...raw.slice(collar, collar + 3)]);
    for (const [x, y] of [[54, 53], [77, 53], [60, 35], [65, 70]]) {
      const index = (y! * sheet.width + x!) * 4;
      expect([...pixels.slice(index, index + 4)]).toEqual([...raw.slice(index, index + 4)]);
    }
    expect(pixels.some((value, index) => index % 4 === 3 && value !== raw[index])).toBe(false);
    const cropped = raw.slice();
    const rowBytes = sheet.width * sheet.frameH * 4;
    for (let row = 0; row < sheet.height / sheet.frameH; row++) {
      const start = row * rowBytes;
      paintSheet(cropped.subarray(start, start + rowBytes), sheet, [r, g, b], row);
    }
    expect(cropped.some((value, index) => value !== pixels[index])).toBe(false);
  },
);

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
