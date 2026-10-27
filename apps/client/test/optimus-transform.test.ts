import { describe, expect, it } from "vitest";
import { TRUCK_SHIFT } from "@bombtop/shared";
import { paintSheet, playerFrame, SHEETS } from "../src/render/sprites";
import { previewPose } from "../src/ui/sheet-art";

const pose = (casting: number, facing: "down" | "right" | "left" | "up" = "down") =>
  playerFrame(SHEETS.optimus, { facing, moving: false, carrying: false, casting, tick: 0 });

describe("Optimus mechanical transformation", () => {
  it("registers the complete 224px menu and victory image with the packed feet anchor", () => {
    for (const state of ["walk", "win"] as const) {
      const preview = previewPose(SHEETS.optimus, state);
      expect(preview.frames).toBe(16);
      expect(preview.sheet).toMatchObject({ width: 5120, height: 224, frameW: 320, frameH: 224, anchorX: 160, anchorY: 211 });
      expect(preview.sheet!.height % preview.sheet!.frameH).toBe(0);
      expect(preview.sheet!.url).toContain("?v=");
    }
  });

  it("plays all six folding stages inside the existing special windup", () => {
    for (let frame = 0; frame < 6; frame++) {
      const tick = Math.ceil(frame * TRUCK_SHIFT / 6);
      expect(pose(tick).x).toBe(frame * SHEETS.optimus.frameW);
    }
  });

  it("starts at the exact truck handoff, then unfolds all six return stages", () => {
    for (let frame = 0; frame < 6; frame++) {
      expect(pose(TRUCK_SHIFT + frame * 4).x).toBe((frame + 6) * SHEETS.optimus.frameW);
    }
    expect(pose(TRUCK_SHIFT + 24).y).toBe(SHEETS.optimus.idle.down.row * SHEETS.optimus.frameH);
  });

  it("uses the same mechanical phase in every direction and mirrors left", () => {
    for (const facing of ["down", "right", "left", "up"] as const) {
      const frame = pose(8, facing);
      expect(frame.x).toBe(4 * SHEETS.optimus.frameW);
      expect(frame.flip).toBe(facing === "left");
    }
  });

  it("keeps other characters' existing cast cadence", () => {
    const sheet = SHEETS.naruto;
    const frame = playerFrame(sheet, { facing: "down", moving: false, carrying: false, casting: 8, tick: 0 });
    expect(frame.x).toBe(2 * sheet.frameW);
  });

  it("recolors the blue armor without bleaching the cyan eyes, windows or red cab", () => {
    const colors = new Uint8ClampedArray([27, 77, 206, 255, 19, 185, 245, 255, 90, 220, 255, 255, 220, 33, 42, 255]);
    const original = colors.slice();
    paintSheet(colors, SHEETS.optimus, [59, 202, 94]);
    expect(colors.slice(0, 4)).not.toEqual(original.slice(0, 4));
    expect(colors.slice(4)).toEqual(original.slice(4));
  });
});
