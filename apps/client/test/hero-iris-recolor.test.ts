import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { paintSheet, SHEETS, type SheetLayout } from "../src/render/sprites";
import captainProtection from "../src/render/captain-paint-regions.json";
import thorProtection from "../src/render/thor-paint-regions.json";
import lobbyProtection from "../src/render/thor-lobby-paint-regions.json";

const cases = [
  { name: "captain", protection: captainProtection, sheet: SHEETS.captain, occupied: 108, witness: [49, 46] },
  { name: "thor", protection: thorProtection, sheet: SHEETS.thor, occupied: 108, witness: [60, 50] },
  { name: "thor-lobby", protection: lobbyProtection,
    sheet: { ...SHEETS.thor, ...SHEETS.thor.lobby!.image! }, occupied: 16, witness: [80, 94] },
] as const;
const colors = [[32, 32, 32], [232, 74, 74], [70, 130, 230], [65, 190, 95]] as const;

it("reproduces all three masks from unchanged production PNGs", () => {
  const script = fileURLToPath(new URL("../scripts/build-hero-iris-regions.py", import.meta.url));
  const output = execFileSync("python", ["-B", script, "--check"], { encoding: "utf8" });
  for (const { name } of cases) expect(output).toContain(`${name}: iris regions match the production atlas`);
});

for (const { name, protection, sheet: sourceSheet, occupied, witness } of cases) {
  describe(`${name} iris protection`, () => {
    it("wires the production sheet to its own measured mask", () => {
      expect(sourceSheet.colorProtection).toEqual(protection);
    });
    const source = fileURLToPath(new URL(`../public/sprites/${name}.png`, import.meta.url));
    const raw = new Uint8ClampedArray(execFileSync("python", ["-c",
      "from PIL import Image; import sys; sys.stdout.buffer.write(Image.open(sys.argv[1]).convert('RGBA').tobytes())",
      source], { maxBuffer: 16 * 1024 * 1024 }));
    const sheet: SheetLayout = { ...sourceSheet, colorProtection: protection };
    const mask = new Uint8Array(raw.length / 4);
    const eyes: number[] = [];
    for (const [row, cells] of protection.rows.entries()) {
      for (const [column, regions] of cells.entries()) {
        for (const region of regions ?? []) {
          for (let y = region.top; y < region.bottom; y++) {
            for (let x = region.left; x < region.right; x++) {
              const pixel = (row * sheet.frameH + y) * sheet.width + column * sheet.frameW + x;
              mask[pixel] = 1;
              eyes.push(pixel * 4);
            }
          }
        }
      }
    }

    it("binds exact occupied cells and iris pixels to the source hash", () => {
      expect(protection.sourceSha256).toBe(createHash("sha256").update(readFileSync(source)).digest("hex"));
      expect([protection.frameW, protection.frameH]).toEqual([sheet.frameW, sheet.frameH]);
      expect(protection.rows.flat().filter((cell) => cell !== null)).toHaveLength(occupied);
      expect(eyes.length).toBeGreaterThan(100);
      expect(mask[witness[1] * sheet.width + witness[0]]).toBe(1);
      for (const [row, cells] of protection.rows.entries()) {
        for (const [column, regions] of cells.entries()) {
          const start = (row * sheet.frameH * sheet.width + column * sheet.frameW) * 4;
          let hasArt = false;
          for (let y = 0; y < sheet.frameH && !hasArt; y++) {
            for (let x = 0; x < sheet.frameW; x++) {
              if (raw[start + (y * sheet.width + x) * 4 + 3]) { hasArt = true; break; }
            }
          }
          expect(regions !== null).toBe(hasArt);
          for (const region of regions ?? []) {
            expect(region.left).toBeGreaterThanOrEqual(0);
            expect(region.right).toBeLessThanOrEqual(sheet.frameW);
            expect(region.top).toBeGreaterThanOrEqual(0);
            expect(region.bottom).toBeLessThanOrEqual(sheet.frameH);
          }
        }
      }
    });

    it.each(colors)("preserves irises and changes clothing for RGB %j", (r, g, b) => {
      const painted = raw.slice();
      const unrestricted = raw.slice();
      const { colorProtection: _mask, ...unprotectedSheet } = sheet;
      paintSheet(painted, sheet, [r, g, b]);
      paintSheet(unrestricted, unprotectedSheet, [r, g, b]);
      expect(eyes.some((offset) => painted.subarray(offset, offset + 4)
        .some((value, channel) => value !== raw[offset + channel]))).toBe(false);
      const offset = (witness[1] * sheet.width + witness[0]) * 4;
      expect([...unrestricted.slice(offset, offset + 3)]).not.toEqual([...raw.slice(offset, offset + 3)]);
      expect(painted.some((value, index) => !mask[index >> 2] && value !== unrestricted[index])).toBe(false);
      expect(painted.some((value, index) => index % 4 === 3 && value !== raw[index])).toBe(false);
      for (const [row, cells] of protection.rows.entries()) {
        for (const [column, regions] of cells.entries()) {
          if (regions === null) continue;
          let changedClothing = false;
          for (let y = Math.ceil(sheet.frameH * .6); y < sheet.frameH && !changedClothing; y++) {
            for (let x = 0; x < sheet.frameW; x++) {
              const i = ((row * sheet.frameH + y) * sheet.width + column * sheet.frameW + x) * 4;
              if (!mask[i >> 2] && painted.slice(i, i + 3).some((value, ch) => value !== raw[i + ch])) {
                changedClothing = true;
                break;
              }
            }
          }
          expect(changedClothing, `${name} clothing ${row}/${column}`).toBe(true);
        }
      }
      const cropped = raw.slice();
      const rowBytes = sheet.width * sheet.frameH * 4;
      for (let row = 0; row < protection.rows.length; row++) {
        const start = row * rowBytes;
        paintSheet(cropped.subarray(start, start + rowBytes), sheet, [r, g, b], row);
      }
      expect(cropped.some((value, index) => value !== painted[index])).toBe(false);
    });
  });
}
