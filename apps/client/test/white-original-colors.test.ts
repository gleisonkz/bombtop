import { TEST_SHEETS } from "./fixtures/sheets";
import { describe, expect, it } from "vitest";
import { paintSheet, SHEETS, type SheetLayout } from "../src/render/sprites";
import { CHARACTER_SHEETS, characterMoves } from "../src/ui/sheet-art";
import { PLAYER_COLORS } from "../src/ui/art";

const white = [1, 3, 5].map((index) => Number.parseInt(PLAYER_COLORS[0].slice(index, index + 2), 16)) as [number, number, number];
const layouts: [string, SheetLayout][] = [
  ...Object.entries(SHEETS),
  ...Object.entries(TEST_SHEETS),
  ...Object.entries(CHARACTER_SHEETS).flatMap(([name, sheet]): [string, SheetLayout][] => [
    [`${name} menu`, sheet],
    ...characterMoves(sheet).flatMap((move): [string, SheetLayout][] => move.sheet ? [[`${name} ${move.label}`, move.sheet]] : []),
  ]),
];

describe("white always means the character's original artwork", () => {
  it.each(layouts)("preserves %s without recoloring", (_name, sheet) => {
    const base = sheet.hueBase ?? sheet.clothes?.[0];
    expect(base).toBeDefined();
    const pixels = new Uint8ClampedArray([...base!, 253, 25, 27, 32, 255, 255, 160, 25, 0]);
    const original = pixels.slice();
    paintSheet(pixels, sheet, white);
    expect(pixels).toEqual(original);
  });
});
