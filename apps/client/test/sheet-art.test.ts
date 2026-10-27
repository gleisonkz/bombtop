import { describe, expect, it } from "vitest";
import { TICK_RATE } from "@bombtop/shared";
import { CHARACTER_SHEETS, characterMoves, previewPose, TITLE_BOMBER_SHEET } from "../src/ui/sheet-art";
import { SHEETS } from "../src/render/sprites";

describe("character previews", () => {
  it("uses the dedicated flying Bomber on the title screen", () => {
    expect(TITLE_BOMBER_SHEET).toEqual({
      url: "sprites/bomber-title-fly.png?v=20261025-clean-menu-hd",
      columns: 3,
      rows: 3,
      frames: 9,
    });
  });

  it("shows each character with its own sheet", () => {
    expect(CHARACTER_SHEETS.bomb).toMatchObject({
      url: "sprites/bomber-menu-atlas.png?v=20261025-hd-family-v1",
      frameW: SHEETS.bomber.frameW * 2,
      frameH: SHEETS.bomber.frameH * 2,
      anchorX: SHEETS.bomber.anchorX * 2,
      anchorY: SHEETS.bomber.anchorY * 2,
      scale: SHEETS.bomber.scale / 2,
    });
    expect(CHARACTER_SHEETS.bomb.bodyH * CHARACTER_SHEETS.bomb.scale!).toBe(SHEETS.bomber.bodyH * SHEETS.bomber.scale);
    expect(CHARACTER_SHEETS.thor).toBe(SHEETS.thor);
  });

  it("walks toward us, breathes when idle, reels when dizzy", () => {
    const { lobby: _, ...s } = SHEETS.bomber;
    expect(s.walk.down.frames).toBe(6);
    expect(previewPose(s, "walk")).toEqual({ row: s.walk.down.row, frames: 6, seconds: (6 * s.ticksPerFrame) / TICK_RATE });
    expect(previewPose(s, "idle").row).toBe(s.idle.down.row);
    expect(previewPose(s, "dizzy").row).toBe(s.stun.row);
  });

  it("plays a sheet's own lobby pose when it has one", () => {
    const s = SHEETS.flash;
    expect(previewPose(s, "walk").row).toBe(s.lobby!.row);
    expect(previewPose(s, "walk").frames).toBe(s.lobby!.frames);
  });

  it("plays a lobby kept in its own image from that image, in the sheet's colors and size", () => {
    const s = SHEETS.goku;
    const image = s.lobby!.image!;
    const pose = previewPose(s, "walk");
    expect(pose).toMatchObject({ row: 0, frames: 60 });
    expect(pose.sheet).toMatchObject({ ...image, hues: s.hues, scale: s.scale });
    expect(previewPose(s, "idle").sheet).toBeUndefined();
    const win = characterMoves(s).find((m) => m.label === "Vitória")!;
    expect(win).toMatchObject({ row: 0, frames: 60, sheet: { url: image.url } });
    expect(characterMoves(s).find((m) => m.label === "Parado")!.sheet).toBeUndefined();
  });

  it("celebrates a win with its own victory pose when it has one, else its lobby pose", () => {
    const goku = SHEETS.goku;
    expect(previewPose(goku, "win")).toEqual(previewPose(goku, "walk"));
    const image = { url: "sprites/x-victory.png", width: 1600, height: 200, frameW: 100, frameH: 200, anchorX: 50, anchorY: 190 };
    const s = { ...goku, victory: { row: 0, frames: 16, image } };
    const win = previewPose(s, "win");
    expect(win).toMatchObject({ row: 0, frames: 16, sheet: { ...image, hues: goku.hues, scale: goku.scale } });
    expect(previewPose(s, "walk").sheet!.url).toBe(goku.lobby!.image!.url); // the lobby still plays the lobby
    const moves = characterMoves(s);
    expect(moves.find((m) => m.label === "Vitória")!.sheet!.url).toBe(image.url);
    expect(moves.find((m) => m.label === "Na sala")!.sheet!.url).toBe(goku.lobby!.image!.url);
    expect(characterMoves(goku).some((m) => m.label === "Na sala")).toBe(false);
  });

  it("uses a showpiece image's cadence without changing gameplay or idle cadence", () => {
    const goku = SHEETS.goku;
    const custom = { ...goku, lobby: { ...goku.lobby!, image: { ...goku.lobby!.image!, ticksPerFrame: 3 } } };
    expect(previewPose(custom, "walk").seconds).toBe((custom.lobby.frames * 3) / TICK_RATE);
    expect(previewPose(custom, "idle").seconds).toBe((custom.idle.down.frames * custom.idleTicksPerFrame) / TICK_RATE);
    expect(custom.ticksPerFrame).toBe(goku.ticksPerFrame);
    expect(characterMoves(custom).find((move) => move.label === "Vitória")!.seconds).toBe((custom.lobby.frames * 3) / TICK_RATE);
  });

  it("falls back to idle when a sheet has no stun row", () => {
    const { stun: _, ...plain } = SHEETS.bomber;
    expect(previewPose(plain, "dizzy").row).toBe(plain.idle.down.row);
  });
});
