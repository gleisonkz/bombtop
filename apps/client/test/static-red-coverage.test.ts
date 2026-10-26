import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { paintSheet, SHEETS } from "../src/render/sprites";

it("recolors real directional coat shadows while preserving the tilted board and alpha", () => {
  const path = fileURLToPath(new URL("../public/sprites/static-final.png", import.meta.url));
  const raw = execFileSync("python", ["-c", "from PIL import Image; import sys; sys.stdout.buffer.write(Image.open(sys.argv[1]).convert('RGBA').tobytes())", path], { maxBuffer: 64 * 1024 * 1024 });
  const pixels = new Uint8ClampedArray(raw);
  paintSheet(pixels, SHEETS.static, [220, 40, 40]);
  for (const [row, x, y] of [[0, 68, 122], [1, 100, 128], [2, 98, 124], [3, 66, 118], [4, 50, 123], [5, 70, 120], [8, 104, 126], [9, 104, 126], [11, 56, 125], [17, 51, 118], [18, 58, 125]]) {
    const index = ((row! * 186 + y!) * SHEETS.static.width + x!) * 4;
    expect(pixels[index], `coat ${row}/${x}/${y}`).toBeGreaterThan(pixels[index + 2]!);
  }
  for (const [column, x, y] of [[0, 88, 167], [1, 70, 166], [2, 73, 165], [3, 74, 166], [4, 68, 166], [5, 60, 164], [6, 41, 163], [7, 110, 164], [8, 104, 163], [9, 76, 167]]) {
    const index = ((17 * 186 + y!) * SHEETS.static.width + column! * 168 + x!) * 4;
    expect([...pixels.slice(index, index + 4)], `tilted board ${column}/${x}/${y}`).toEqual([...raw.subarray(index, index + 4)]);
  }
  expect(pixels.some((value, index) => index % 4 === 3 && value !== raw[index])).toBe(false);
});
