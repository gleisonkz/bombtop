import { describe, expect, it } from "vitest";
import { TICK_RATE } from "@bombtop/shared";
import { CHARACTER_SHEETS, previewPose } from "../src/ui/sheet-art";
import { SHEETS } from "../src/render/sprites";

describe("character previews", () => {
  it("shows each character with its own sheet", () => {
    expect(CHARACTER_SHEETS.bomb).toBe(SHEETS.bomber);
    expect(CHARACTER_SHEETS.ninja).toBe(SHEETS.ninja);
  });

  it("walks toward us, breathes when idle, reels when dizzy", () => {
    const s = SHEETS.bomber;
    expect(previewPose(s, "walk")).toEqual({ row: s.walk.down.row, frames: 4, seconds: (4 * s.ticksPerFrame) / TICK_RATE });
    expect(previewPose(s, "idle").row).toBe(s.idle.down.row);
    expect(previewPose(s, "dizzy").row).toBe(s.stun.row);
  });

  it("plays a sheet's own lobby pose when it has one", () => {
    const s = SHEETS.ninja;
    expect(previewPose(s, "walk").row).toBe(s.lobby!.row);
    expect(previewPose(s, "walk").frames).toBe(s.lobby!.frames);
  });

  it("falls back to idle when a sheet has no stun row", () => {
    const { stun: _, ...plain } = SHEETS.bomber;
    expect(previewPose(plain, "dizzy").row).toBe(plain.idle.down.row);
  });
});
