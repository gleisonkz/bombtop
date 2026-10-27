import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildHeadAnchors } from "../src/render/head-anchor";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { playerFrame, SHEETS } from "../src/render/sprites";
import { previewPose } from "../src/ui/sheet-art";

describe("supplied Super Choque", () => {
  it("registers the actual packed PNG and keeps the standing arena size", () => {
    const sheet = SHEETS.static;
    const png = readFileSync(new URL("../public/sprites/static-final.png", import.meta.url));
    expect(sheet.url).toBe("sprites/static-final.png?v=20261026-option4-v1");
    expect(png.readUInt32BE(16)).toBe(sheet.width);
    expect(png.readUInt32BE(20)).toBe(sheet.height);
    expect(sheet).toMatchObject({ width: 2352, height: 4256, frameW: 168, frameH: 224, anchorX: 82, anchorY: 208, bodyH: 148 });
    expect(sheet.bodyH * sheet.scale).toBeCloseTo(21.588);
  });

  it("finds visible heads in every gameplay row of the new atlas", () => {
    const sheet = SHEETS.static;
    const path = fileURLToPath(new URL("../public/sprites/static-final.png", import.meta.url));
    const raw = execFileSync("python", ["-c", "from PIL import Image; import sys; sys.stdout.buffer.write(Image.open(sys.argv[1]).convert('RGBA').tobytes())", path], { maxBuffer: 64 * 1024 * 1024 });
    const heads = buildHeadAnchors(new Uint8ClampedArray(raw), sheet);
    for (const row of [0, 1, 2, 3, 4, 5, 6, 11, 12, 13, 14, 15, 16]) {
      const head = heads.get(row);
      expect(head, `head row ${row}`).toBeDefined();
      expect(head!.x).toBeGreaterThan(1);
      expect(head!.x).toBeLessThan(167);
      expect(head!.y).toBeGreaterThan(1);
      expect(head!.y).toBeLessThan(sheet.anchorY - sheet.bodyH / 2);
    }
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
