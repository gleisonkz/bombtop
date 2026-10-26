import { describe, expect, it } from "vitest";
import { paintSheet, SHEETS, type SheetLayout } from "../src/render/sprites";

describe("Super Choque hair protection", () => {
  it.each([false, true])("preserves the board and electric trail in all ten poses (cropped: %s)", (cropped) => {
    const sheet: SheetLayout = SHEETS.static;
    const pixels = new Uint8ClampedArray(sheet.width * (cropped ? sheet.frameH : sheet.height) * 4);
    const offsets: number[] = [];
    for (let column = 0; column < 10; column++) {
      for (const region of sheet.colorProtection!.rows[17]![column]!.filter((region) => region.top > 150).slice(-1)) {
        const y = region.top;
        const offset = (((cropped ? 0 : 17 * sheet.frameH) + y) * sheet.width + column * sheet.frameW + region.left) * 4;
        pixels.set([24, 61, 94, 255], offset);
        offsets.push(offset);
      }
    }
    paintSheet(pixels, sheet, [220, 40, 40], cropped ? 17 : 0);
    for (const offset of offsets) expect([...pixels.slice(offset, offset + 4)]).toEqual([24, 61, 94, 255]);
  });
  it.each([false, true])("preserves hair and recolors the coat (cropped: %s)", (cropped) => {
    const sheet: SheetLayout = SHEETS.static;
    expect(sheet.colorProtection).toBeDefined();
    const rows = sheet.colorProtection!.rows;
    const batches = cropped ? rows.map((_, index) => index) : [0];
    for (const firstRow of batches) {
      for (const color of [[210, 40, 40], [40, 180, 80], [220, 190, 40]] as const) {
        const pixels = new Uint8ClampedArray(sheet.width * (cropped ? sheet.frameH : sheet.height) * 4);
        const samples: { hair: number; coat: number }[] = [];
        for (const [row, columns] of rows.entries()) {
          if (cropped && row !== firstRow) continue;
          for (const [column, regions] of columns.entries()) {
            if (!regions?.length) continue;
            const region = regions[0]!;
            const x = column * sheet.frameW + region.left;
            const y = region.top + (cropped ? 0 : row * sheet.frameH);
            const hair = (y * sheet.width + x) * 4;
            const coatY = row === 17 ? 120 : 165;
            const coat = (((cropped ? 0 : row * sheet.frameH) + coatY) * sheet.width + column * sheet.frameW + 82) * 4;
            pixels.set([24, 31, 40, 255], hair);
            pixels.set([24, 31, 40, 255], coat);
            samples.push({ hair, coat });
          }
        }
        paintSheet(pixels, sheet, color, firstRow);
        for (const { hair, coat } of samples) {
          expect([...pixels.slice(hair, hair + 4)]).toEqual([24, 31, 40, 255]);
          expect([...pixels.slice(coat, coat + 3)]).not.toEqual([24, 31, 40]);
        }
      }
    }
  });
});
