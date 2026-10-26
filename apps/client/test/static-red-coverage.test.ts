import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { paintSheet, SHEETS } from "../src/render/sprites";

it("recolors real directional coat shadows while preserving the tilted board and alpha", () => {
  const path = fileURLToPath(new URL("../public/sprites/static-final.png", import.meta.url));
  const raw = execFileSync("python", ["-c", "from PIL import Image; import sys; sys.stdout.buffer.write(Image.open(sys.argv[1]).convert('RGBA').tobytes())", path], { maxBuffer: 64 * 1024 * 1024 });
  const pixels = new Uint8ClampedArray(raw);
  paintSheet(pixels, SHEETS.static, [220, 40, 40]);
  for (const [row, x, y] of [[0, 68, 122], [1, 100, 128], [2, 98, 124], [3, 66, 118], [4, 50, 123], [5, 70, 120], [8, 109, 124], [9, 61, 119], [11, 56, 125], [17, 53, 130], [18, 65, 121]]) {
    const index = ((row! * 186 + y!) * SHEETS.static.width + x!) * 4;
    expect(pixels[index], `coat ${row}/${x}/${y}`).toBeGreaterThan(pixels[index + 2]!);
  }
  for (const [column, x, y] of [[0, 76, 163], [1, 92, 163], [2, 76, 163], [3, 73, 163], [4, 80, 163], [5, 63, 163], [6, 65, 163], [7, 70, 163], [8, 65, 163], [9, 52, 163]]) {
    const index = ((17 * 186 + y!) * SHEETS.static.width + column! * 168 + x!) * 4;
    expect(raw[index + 3], `visible board ${column}`).toBeGreaterThan(128);
    expect([...pixels.slice(index, index + 4)], `tilted board ${column}/${x}/${y}`).toEqual([...raw.subarray(index, index + 4)]);
  }
  expect(pixels.some((value, index) => index % 4 === 3 && value !== raw[index])).toBe(false);
});
