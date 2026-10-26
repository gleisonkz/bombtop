import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SHEETS, PATRONUS } from "../src/render/sprites";
import { previewPose, characterMoves } from "../src/ui/sheet-art";

describe("Harry clean PixelLab animations", () => {
  it("versions gameplay and menu images together to avoid mixing cached layouts", () => {
    const sheet = SHEETS.harry;
    const urls = [sheet.url, sheet.lobby.image.url, sheet.victory.image.url];
    const revisions = urls.map(url => new URL(url, "https://bombtop.test/").searchParams.get("v"));
    expect(revisions.every(Boolean)).toBe(true);
    expect(new Set(revisions).size).toBe(1);
  });
  it("registers all 100 gameplay frames in the 9-column, 17-row atlas", () => {
    const sheet = SHEETS.harry;
    expect([sheet.frameW, sheet.frameH]).toEqual([224, 224]);
    expect([sheet.width, sheet.height]).toEqual([9 * 224, 17 * 224]);
    const strips = [
      ...Object.values(sheet.idle), ...Object.values(sheet.walk), sheet.stun, sheet.death,
      ...Object.values(sheet.cast!), ...Object.values(sheet.carryIdle!), ...Object.values(sheet.carryWalk!),
    ];
    expect(strips.sort((a, b) => a.row - b.row).map(({ row, frames }) => [row, frames])).toEqual([
      [0, 4], [1, 4], [2, 4], [3, 6], [4, 6], [5, 6], [6, 6], [7, 7],
      [8, 9], [9, 9], [10, 9], [11, 4], [12, 4], [13, 4], [14, 6], [15, 6], [16, 6],
    ]);
    expect(strips.reduce((total, strip) => total + strip.frames, 0)).toBe(100);
    const image = readFileSync(new URL(`../public/${sheet.url}`, import.meta.url));
    expect([image.readUInt32BE(16), image.readUInt32BE(20)]).toEqual([sheet.width, sheet.height]);
  });

  it.each([
    { state: "walk" as const, frames: 8, url: "sprites/harry-lobby-pixellab.png", width: 1792 },
    { state: "win" as const, frames: 16, url: "sprites/harry-victory-pixellab.png", width: 3584 },
  ])("plays the clean $state presentation at its registered dimensions and timing", ({ state, frames, url, width }) => {
    const pose = previewPose(SHEETS.harry, state);
    expect(pose.row).toBe(0);
    expect(pose.frames).toBe(frames);
    expect(pose.seconds).toBeCloseTo(frames * 7 / 60);
    expect(pose.sheet?.url.split("?")[0]).toBe(url);
    expect(pose.sheet).toMatchObject({ width, height: 224, frameW: 224, frameH: 224, anchorX: 111.5, anchorY: 211 });
    const image = readFileSync(new URL(`../public/${url}`, import.meta.url));
    expect(image.readUInt32BE(16)).toBe(pose.sheet!.width);
    expect(image.readUInt32BE(20)).toBe(pose.sheet!.height);
  });

  it("uses the clean presentations in the guide and keeps the gameplay Patronus separate", () => {
    const moves = characterMoves(SHEETS.harry);
    const lobby = moves.find(move => move.label === "Na sala")!;
    const victory = moves.find(move => move.label === "Vitória")!;
    expect(lobby).toMatchObject({ row: 0, frames: 8 });
    expect(lobby.sheet?.url.split("?")[0]).toBe("sprites/harry-lobby-pixellab.png");
    expect(lobby.seconds).toBeCloseTo(8 * 7 / 60);
    expect(victory).toMatchObject({ row: 0, frames: 16 });
    expect(victory.sheet?.url.split("?")[0]).toBe("sprites/harry-victory-pixellab.png");
    expect(victory.seconds).toBeCloseTo(16 * 7 / 60);
    expect(PATRONUS.url).toBe("sprites/patronus-pixel.png");
    expect(SHEETS.harry.cast!.down.frames).toBe(9);
  });
});
