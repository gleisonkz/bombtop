import { TEST_SHEETS } from "./fixtures/sheets";
import { describe, expect, it } from "vitest";
import { scorePortraitCrop, scorePortraitScale } from "../src/render/score-portrait";
import { SHEETS, type SheetLayout } from "../src/render/sprites";
import profiles from "../src/render/score-portraits.json";

describe("scoreboard head portraits", () => {
  it("covers the production roster with valid source-cell bounds", () => {
    expect(Object.keys(profiles)).toHaveLength(18);
    for (const [name, profile] of Object.entries(profiles)) {
      const sheet = SHEETS[name as keyof typeof SHEETS];
      expect(profile.url).toBe(sheet.url.split("?")[0]);
      expect(profile.frame).toEqual([sheet.frameW, sheet.frameH]);
      const [x, y, width, height] = profile.crop;
      expect(x! + width!).toBeLessThanOrEqual(sheet.frameW);
      expect(y! + height!).toBeLessThanOrEqual(sheet.frameH);
    }
  });

  it("trims transparent padding and uses the actual first idle playback column", () => {
    const sheet: SheetLayout = { ...TEST_SHEETS.james, width: 24, height: 48,
      idle: { ...TEST_SHEETS.james.idle, down: { row: 1, frames: 1, columns: [2] } } };
    const pixels = new Uint8ClampedArray(sheet.width * sheet.height * 4);
    for (let y = 17; y < 22; y++) for (let x = 18; x < 22; x++) pixels[(y * sheet.width + x) * 4 + 3] = 255;
    expect(scorePortraitCrop({ sheet, pixels })).toMatchObject({ x: 18, y: 17, width: 4, height: 5 });
  });

  it("fits both axes, keeps aspect ratio and leaves room before the win count", () => {
    for (const [width, height] of [[120, 50], [40, 100], [70, 70]]) {
      const scale = scorePortraitScale({ width: width!, height: height! });
      expect(width! * scale).toBeLessThanOrEqual(13);
      expect(height! * scale).toBeLessThanOrEqual(13);
      expect(-5 + width! * scale / 2).toBeLessThan(3);
      expect(14.5 - height! * scale).toBeGreaterThanOrEqual(1.5);
    }
  });

  it("compensates tall ears and wide hair without cutting them or overlapping the score", () => {
    const goku = scorePortraitScale({ width: 79, height: 63, box: [15.5, 13] });
    const bugs = scorePortraitScale({ width: 60, height: 89, box: [13, 15] });
    expect(goku / scorePortraitScale({ width: 79, height: 63 })).toBeGreaterThan(1.15);
    expect(bugs / scorePortraitScale({ width: 60, height: 89 })).toBeGreaterThan(1.12);
    for (const width of [13, 15.5]) {
      const x = -5 - Math.max(0, (width - 13) / 2);
      expect(x - width / 2).toBeGreaterThanOrEqual(-14);
      expect(3 - (x + width / 2)).toBeGreaterThanOrEqual(1.5);
    }
  });

  it("returns a bounded fallback when the source has no opaque pixels", () => {
    const sheet = TEST_SHEETS.james;
    const crop = scorePortraitCrop({ sheet, pixels: new Uint8ClampedArray(sheet.width * sheet.height * 4) });
    expect(crop.width).toBeGreaterThan(0);
    expect(crop.height).toBeGreaterThan(0);
    expect(crop.x + crop.width).toBeLessThanOrEqual(sheet.frameW);
    expect(crop.y + crop.height).toBeLessThanOrEqual(sheet.frameH);
  });
});
