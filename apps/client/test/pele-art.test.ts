import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { playerFrame, SHEETS } from "../src/render/sprites";
import { previewPose } from "../src/ui/sheet-art";

describe("approved option-4 Pele artwork", () => {
  it("loads a runtime grid matching the actual PNG", () => {
    const image = readFileSync(new URL("../public/sprites/pele-final.png", import.meta.url));
    expect(image.readUInt32BE(16)).toBe(SHEETS.pele.width);
    expect(image.readUInt32BE(20)).toBe(SHEETS.pele.height);
    expect(SHEETS.pele.width / SHEETS.pele.frameW).toBe(9);
    expect(SHEETS.pele.height / SHEETS.pele.frameH).toBe(18);
    expect(SHEETS.pele.bodyH * SHEETS.pele.scale).toBeCloseTo(21.6, 0);
    expect(SHEETS.pele.frameW).toBe(192);
    expect(SHEETS.pele.frameH).toBe(192);
    expect(SHEETS.pele.url).toContain("pele-final");
  });

  it("uses the new celebration for lobby and winner previews", () => {
    const pose = previewPose(SHEETS.pele, "walk");
    expect(pose).toMatchObject({ row: 17, frames: 7 });
    expect(pose.sheet).toBeUndefined();
    expect(previewPose(SHEETS.pele, "win")).toEqual(pose);
    expect(SHEETS.pele.lobby).not.toHaveProperty("image");
  });

  it("keeps directional carry frames and left mirroring on the registered rows", () => {
    for (const facing of ["down", "right", "left", "up"] as const) {
      const direction = facing === "left" || facing === "right" ? "side" : facing;
      const frame = playerFrame(SHEETS.pele, { facing, moving: true, carrying: true, tick: 14 });
      expect(frame.y).toBe(SHEETS.pele.carryWalk[direction].row * SHEETS.pele.frameH);
      expect(frame.flip).toBe(facing === "left");
    }
  });
});
