import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { paintSheet, SHEETS, type SheetLayout } from "../src/render/sprites";
import { previewPose } from "../src/ui/sheet-art";

const samples: [string, SheetLayout, number, readonly number[]][] = [
  ["side walk", SHEETS.panther, 4, [231, 155, 160]],
  ["carrying", SHEETS.panther, 14, [241, 159, 158]],
  ["purple fur shadows", SHEETS.panther, 14, [43, 30, 46]],
  ["lobby", previewPose(SHEETS.panther, "walk").sheet!, 0, [248, 164, 166]],
];

describe("Panther production fur variants", () => {
  it.each(samples)("removes stray pink from %s without changing yellow eyes or transparency", (name, sheet, row, color) => {
    const source = fileURLToPath(new URL(`../public/${sheet.url.split("?")[0]}`, import.meta.url));
    const raw = new Uint8ClampedArray(execFileSync("python", ["-c", "from PIL import Image; import sys; im=Image.open(sys.argv[1]).convert('RGBA'); y=int(sys.argv[2]); sys.stdout.buffer.write(im.crop((0,y,im.width,y+224)).tobytes())", source, String(row * sheet.frameH)], { maxBuffer: 4 * 1024 * 1024 }));
    const witnesses: number[] = [];
    const eyes: number[] = [];
    for (let index = 0; index < raw.length; index += 4) {
      if (!raw[index + 3]) continue;
      if (color.every((value, channel) => raw[index + channel] === value)) witnesses.push(index);
      if (raw[index]! > 100 && raw[index + 1]! > 100 && raw[index + 2]! < 60) eyes.push(index);
    }
    expect(witnesses.length).toBeGreaterThan(0);
    for (const target of [[58, 58, 72], [232, 74, 74], [61, 123, 242], [69, 194, 91]] as const) {
      const pixels = raw.slice();
      paintSheet(pixels, sheet, target, row);
      expect(witnesses.some(index => color.every((value, channel) => pixels[index + channel] === value)), `${name} ${target}`).toBe(false);
      expect(eyes.some(index => [0, 1, 2, 3].some(channel => pixels[index + channel] !== raw[index + channel]))).toBe(false);
      expect(pixels.some((value, index) => index % 4 === 3 && value !== raw[index])).toBe(false);
    }
  });
});
