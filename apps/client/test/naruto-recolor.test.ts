import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { paintSheet, SHEETS } from "../src/render/sprites";
import protection from "../src/render/naruto-paint-regions.json";

const source = fileURLToPath(new URL("../public/sprites/naruto.png", import.meta.url));
const raw = new Uint8ClampedArray(execFileSync("python", ["-c",
  "from PIL import Image; import sys; sys.stdout.buffer.write(Image.open(sys.argv[1]).convert('RGBA').tobytes())",
  source], { maxBuffer: 16 * 1024 * 1024 }));
const sheet = SHEETS.naruto;
const colors = [
  { name: "black", rgb: [32, 32, 32] },
  { name: "red", rgb: [232, 74, 74] },
  { name: "blue", rgb: [70, 130, 230] },
  { name: "green", rgb: [65, 190, 95] },
] as const;
const occupiedFrames = [4, 4, 4, 6, 6, 6, 6, 7, 9, 9, 9, 4, 4, 4, 6, 6, 6, 8];
const protectedPixels = new Uint8Array(raw.length / 4);
const eyeOffsets: number[] = [];

for (const [row, cells] of protection.rows.entries()) {
  for (const [column, regions] of cells.entries()) {
    for (const region of regions ?? []) {
      for (let y = region.top; y < region.bottom; y++) {
        for (let x = region.left; x < region.right; x++) {
          const pixel = (row * sheet.frameH + y) * sheet.width + column * sheet.frameW + x;
          protectedPixels[pixel] = 1;
          eyeOffsets.push(pixel * 4);
        }
      }
    }
  }
}

// An actual navy witness in each occupied cell, independent of the eye regions.
// Restrict witnesses to the lower body so none can be an iris or headband.
const clothesOffsets: number[] = [];
for (const [row, count] of occupiedFrames.entries()) {
  for (let column = 0; column < count; column++) {
    let witness: number | undefined;
    for (let y = 70; y < sheet.frameH && witness === undefined; y++) {
      for (let x = 0; x < sheet.frameW; x++) {
        const offset = ((row * sheet.frameH + y) * sheet.width + column * sheet.frameW + x) * 4;
        if (raw[offset + 3] !== 0 && raw[offset + 2]! > raw[offset]! + 30
          && raw[offset + 2]! > raw[offset + 1]! + 20 && raw[offset + 1]! > 15) {
          witness = offset;
          break;
        }
      }
    }
    if (witness === undefined) throw new Error(`No actual navy clothing in Naruto ${row}/${column}`);
    clothesOffsets.push(witness);
  }
}

it("binds the reviewed eye regions to the actual PNG and all 108 occupied frames", () => {
  expect(protection.sourceSha256).toBe(createHash("sha256").update(readFileSync(source)).digest("hex"));
  expect(sheet.colorProtection).toEqual(protection);
  expect([protection.frameW, protection.frameH]).toEqual([sheet.frameW, sheet.frameH]);
  expect(protection.rows).toHaveLength(18);
  expect(protection.rows.every((row) => row.length === 9)).toBe(true);
  expect(protection.rows.flat().filter((regions) => regions !== null)).toHaveLength(108);
  expect(protection.rows.flat().filter((regions) => regions !== null && regions.length > 0)).toHaveLength(58);
  expect(eyeOffsets.length).toBeGreaterThan(500);
  expect(clothesOffsets).toHaveLength(108);
  for (const row of [2, 5, 6, 7, 10, 13, 16]) {
    expect(protection.rows[row]!.every((regions) => regions === null || regions.length === 0)).toBe(true);
  }
  expect(protection.rows[17]!.filter((regions) => regions !== null && regions.length > 0)).toHaveLength(4);
});

it("reproduces the checked-in mask without modifying source art", () => {
  const script = fileURLToPath(new URL("../scripts/build-naruto-paint-regions.py", import.meta.url));
  expect(execFileSync("python", ["-B", script, "--check"], { encoding: "utf8" }))
    .toContain("Naruto eye regions match the production atlas");
  expect(createHash("sha256").update(readFileSync(source)).digest("hex")).toBe(protection.sourceSha256);
});

it.each([[32, 32, 32], [232, 74, 74], [70, 130, 230], [65, 190, 95]] as const)(
  "preserves actual Naruto irises for color %j", (r, g, b) => {
    const pixels = raw.slice();
    paintSheet(pixels, sheet, [r, g, b]);
    for (const x of [41, 53]) {
      const index = (53 * sheet.width + x) * 4;
      expect([...pixels.slice(index, index + 4)]).toEqual([...raw.slice(index, index + 4)]);
    }
  },
);

it.each(colors)("preserves every measured iris and recolors clothing for $name (full atlas)", ({ rgb }) => {
  const pixels = raw.slice();
  const unprotected = raw.slice();
  const { colorProtection: _protection, ...unprotectedSheet } = sheet;
  paintSheet(pixels, sheet, rgb);
  paintSheet(unprotected, unprotectedSheet, rgb);
  expect(eyeOffsets.some((index) => pixels[index] !== raw[index]
    || pixels[index + 1] !== raw[index + 1] || pixels[index + 2] !== raw[index + 2]
    || pixels[index + 3] !== raw[index + 3])).toBe(false);
  expect(clothesOffsets.some((index) => pixels[index] === raw[index]
    && pixels[index + 1] === raw[index + 1] && pixels[index + 2] === raw[index + 2])).toBe(false);
  // All non-eye pixels must paint identically to the original unrestricted path.
  // This also catches accidental protection of raised sleeves and the headband.
  expect(pixels.some((value, index) => protectedPixels[index >> 2] === 0
    && value !== unprotected[index])).toBe(false);
  expect(pixels.some((value, index) => index % 4 === 3 && value !== raw[index])).toBe(false);
  for (const [x, y] of [[35, 43], [36, 69], [36, 118]]) {
    const offset = (y! * sheet.width + x!) * 4;
    expect([...pixels.slice(offset, offset + 3)]).not.toEqual([...raw.slice(offset, offset + 3)]);
  }
});

it.each(colors)("matches full-atlas painting for $name across all 18 cropped rows", ({ rgb }) => {
  const full = raw.slice();
  const cropped = raw.slice();
  const rowBytes = sheet.width * sheet.frameH * 4;
  paintSheet(full, sheet, rgb);
  for (let row = 0; row < 18; row++) {
    const start = row * rowBytes;
    paintSheet(cropped.subarray(start, start + rowBytes), sheet, rgb, row);
  }
  expect(cropped.some((value, index) => value !== full[index])).toBe(false);
});
