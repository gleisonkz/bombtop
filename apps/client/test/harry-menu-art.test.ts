import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SHEETS, PATRONUS } from "../src/render/sprites";
import { previewPose, characterMoves } from "../src/ui/sheet-art";

describe("Harry menu Patronus presentation", () => {
  it("plays the complete coherent summon at its registered size and 5.6-second timing", () => {
    const pose = previewPose(SHEETS.harry, "walk");
    expect(pose.frames).toBe(48);
    expect(pose.seconds).toBeCloseTo(5.6);
    expect(pose.sheet?.url).toBe("sprites/harry-lobby-patronus-v2.png");
    const image = readFileSync(new URL("../public/sprites/harry-lobby-patronus-v2.png", import.meta.url));
    expect(image.readUInt32BE(16)).toBe(pose.sheet!.width);
    expect(image.readUInt32BE(20)).toBe(pose.sheet!.height);
    expect(pose.sheet!.frameW).toBe(320);
    expect(pose.sheet!.anchorX).toBe(112);
    expect(pose.sheet!.anchorY).toBe(194);
  });

  it("uses this presentation in the guide while keeping the snitch victory and gameplay spell separate", () => {
    const lobby = characterMoves(SHEETS.harry).find(move => move.label === "Na sala")!;
    expect(lobby.frames).toBe(48);
    expect(lobby.seconds).toBeCloseTo(5.6);
    expect(previewPose(SHEETS.harry, "win").sheet?.url).toBe("sprites/harry-victory.png");
    expect(PATRONUS.url).toBe("sprites/patronus-pixel.png");
    expect(SHEETS.harry.cast!.down.frames).toBe(9);
  });
});
