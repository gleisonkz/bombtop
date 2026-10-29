import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { paintSheet, SHEETS, type SheetLayout } from "../src/render/sprites";
import { characterMoves } from "../src/ui/sheet-art";

const layouts: [string, SheetLayout, number][] = [
  ["gameplay", SHEETS.harry, 0],
  ["carrying", SHEETS.harry, 11],
  ...characterMoves(SHEETS.harry).flatMap(move => move.sheet ? [[move.label, move.sheet, 0] as [string, SheetLayout, number]] : []),
];

describe("Harry production robe colors", () => {
  it.each(layouts)("repaints burgundy shadows in %s without changing alpha", (name, sheet, row) => {
    const source = fileURLToPath(new URL(`../public/${sheet.url.split("?")[0]}`, import.meta.url));
    const pixels = new Uint8ClampedArray(execFileSync("python", ["-c", "from PIL import Image; import sys; im=Image.open(sys.argv[1]).convert('RGBA'); y=int(sys.argv[2]); sys.stdout.buffer.write(im.crop((0,y,im.width,y+224)).tobytes())", source, String(row * sheet.frameH)], { maxBuffer: 4 * 1024 * 1024 }));
    const shade = row === 11 ? [70, 11, 27] : [72, 10, 26];
    let index = -1;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] && shade.every((value, channel) => pixels[i + channel] === value)) { index = i; break; }
    }
    expect(index).toBeGreaterThanOrEqual(0);
    for (const color of [[58, 58, 72], [232, 74, 74], [61, 123, 242], [69, 194, 91]] as const) {
      const result = pixels.slice();
      paintSheet(result, sheet, color, row);
      expect([...result.slice(index, index + 3)], `${name} ${color}`).not.toEqual(shade);
      expect(result.some((value, offset) => offset % 4 === 3 && value !== pixels[offset])).toBe(false);
    }
  });
});
