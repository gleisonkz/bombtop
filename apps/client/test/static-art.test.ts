import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { playerFrame, SHEETS } from "../src/render/sprites";
import { previewPose } from "../src/ui/sheet-art";

describe("supplied Super Choque", () => {
  it("registers the actual packed PNG and keeps the standing arena size", () => {
    const sheet = SHEETS.static;
    const png = readFileSync(new URL("../public/sprites/static-final.png", import.meta.url));
    expect(sheet.url).toBe("sprites/static-final.png?v=20261025-supplied-214803");
    expect(png.readUInt32BE(16)).toBe(sheet.width);
    expect(png.readUInt32BE(20)).toBe(sheet.height);
    expect(sheet.bodyH * sheet.scale).toBeCloseTo(21.588);
  });

  it("uses supplied disc travel in the lobby and gestures for victory", () => {
    expect(previewPose(SHEETS.static, "walk")).toMatchObject({ row: 17, frames: 10 });
    expect(previewPose(SHEETS.static, "win")).toMatchObject({ row: 18, frames: 11 });
  });

  it("plays each supplied directional walk sequence and mirrors left", () => {
    for (const facing of ["down", "up", "left", "right"] as const) {
      const view = facing === "left" || facing === "right" ? "side" : facing;
      const count = SHEETS.static.walk[view].frames;
      const frame = playerFrame(SHEETS.static, { facing, moving: true, carrying: false, tick: (count - 1) * 7 });
      expect(frame.x).toBe((count - 1) * SHEETS.static.frameW);
      expect(frame.flip).toBe(facing === "left");
    }
  });
});
