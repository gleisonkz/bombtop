import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { playerFrame, SHEETS } from "../src/render/sprites";
import { previewPose } from "../src/ui/sheet-art";

describe("approved option-1 Lula artwork", () => {
  it("matches the installed atlas and preserves standing arena height", () => {
    const image = readFileSync(new URL("../public/sprites/lula.png", import.meta.url));
    const sheet = SHEETS.lula;
    expect([image.readUInt32BE(16), image.readUInt32BE(20)]).toEqual([sheet.width, sheet.height]);
    expect([sheet.width / sheet.frameW, sheet.height / sheet.frameH]).toEqual([9, 18]);
    expect([sheet.frameW, sheet.frameH]).toEqual([192, 192]);
    expect(sheet.bodyH * sheet.scale).toBeCloseTo(21.672, 3);
    expect(sheet.url).toContain("pele-style-option1");
  });

  it("uses the new eight-frame celebration for lobby and victory", () => {
    const pose = previewPose(SHEETS.lula, "walk");
    expect(pose).toMatchObject({ row: 17, frames: 8 });
    expect(pose.sheet).toBeUndefined();
    expect(previewPose(SHEETS.lula, "win")).toEqual(pose);
  });

  it("preserves directional carry playback and left mirroring", () => {
    for (const facing of ["down", "right", "left", "up"] as const) {
      const direction = facing === "left" || facing === "right" ? "side" : facing;
      const sheet = SHEETS.lula;
      const frame = playerFrame(sheet, { facing, moving: true, carrying: true, tick: 14 });
      expect(frame.y).toBe(sheet.carryWalk[direction].row * sheet.frameH);
      expect(frame.flip).toBe(facing === "left");
    }
  });
});
