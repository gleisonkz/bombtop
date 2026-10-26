import { TEST_SHEETS } from "./fixtures/sheets";
import { describe, expect, it } from "vitest";
import { FUSE_TICKS } from "@bombtop/shared";
import { carriedBombPose } from "../src/render/carried-bomb";
import { BOMBS, SHEETS, bombLook, playerFrame, type SheetLayout } from "../src/render/sprites";
import anchors from "../src/render/carry-anchors.json";

const bomb = { fuse: FUSE_TICKS, type: "normal" as const };

describe("carried bomb attachment", () => {
  it("preserves round proportions throughout the held bomb fuse pulse", () => {
    for (const fuse of [FUSE_TICKS, 15, 1]) {
      for (let tick = 0; tick < 120; tick++) {
        const look = bombLook({ ...bomb, fuse, tick, carrying: true });
        expect(look.sx).toBe(look.sy);
        expect(look.sx).toBeGreaterThanOrEqual(0.9);
        expect(look.sx).toBeLessThanOrEqual(1.1);
      }
    }
  });

  it("keeps the bomb at its native size through every walking and turning pose", () => {
    for (const name of Object.keys(anchors.characters)) {
      const sheet = SHEETS[name as keyof typeof SHEETS];
      for (const facing of ["down", "up", "left", "right"] as const) {
        for (let tick = 0; tick < 120; tick++) {
          const frame = playerFrame(sheet, { facing, moving: true, carrying: true, tick });
          expect(carriedBombPose({ sheet, frame, cx: 80, feetY: 100, bomb, tick }).scale).toBe(1);
        }
      }
    }
  });

  it("covers every carry frame in the production roster and mirrors side grips", () => {
    for (const [name, data] of Object.entries(anchors.characters)) {
      const sheet: SheetLayout = SHEETS[name as keyof typeof SHEETS];
      for (const moving of [false, true]) {
        for (const facing of ["down", "up", "right", "left"] as const) {
          const strip = (moving ? sheet.carryWalk! : sheet.carryIdle!)[facing === "left" || facing === "right" ? "side" : facing];
          const per = moving ? sheet.ticksPerFrame : sheet.idleTicksPerFrame;
          for (let col = 0; col < strip.frames; col++) {
            const tick = col * per!;
            const frame = playerFrame(sheet, { facing, moving, carrying: true, tick });
            const pose = carriedBombPose({ sheet, frame, cx: 80, feetY: 100, bomb, tick });
            if (data.frameW !== sheet.frameW || data.frameH !== sheet.frameH) {
              expect(pose.scale).toBe(1);
              continue;
            }
            const grip = data.rows[String(strip.row) as keyof typeof data.rows][frame.x / sheet.frameW]!;
            const scale = sheet.scale ?? 1;
            const expectedX = 80 + (grip.x - sheet.anchorX) * scale * (frame.flip ? -1 : 1);
            // Palm points lie on the bomb's lower elliptical contour, including its fuse pulse.
            const look = bombLook({ ...bomb, tick, carrying: true });
            const rx = 42 * BOMBS.scale * look.sx * pose.scale;
            const ry = 42 * BOMBS.scale * look.sy * pose.scale;
            const halfSpan = grip.span * scale / 2;
            const handY = 100 + (grip.y - sheet.anchorY) * scale;
            const horizontalContact = grip.span === 0 ? pose.x - expectedX : Math.min(halfSpan, rx);
            if (grip.span !== 0) expect(pose.x).toBeCloseTo(expectedX);
            expect((horizontalContact / rx) ** 2 + ((handY - pose.y) / ry) ** 2).toBeCloseTo(1);
          }
        }
      }
    }
  });

  it("uses safe overhead placement for sheets without carry sockets", () => {
    const sheet = TEST_SHEETS.james;
    const frame = playerFrame(sheet, { facing: "down", moving: false, carrying: true, tick: 0 });
    expect(carriedBombPose({ sheet, frame, cx: 80, feetY: 100, bomb, tick: 0 }))
      .toEqual({ x: 80, y: 100 - 6 - sheet.bodyH, scale: 1, front: false });
  });

  it("keeps hands in the carry pose while stunned or casting with a held bomb", () => {
    const sheet = SHEETS.bomber;
    for (const facing of ["up", "down", "left", "right"] as const) {
      const frame = playerFrame(sheet, { facing, moving: true, carrying: true, stunned: true, casting: 7, shielding: 7, tick: 14 });
      const view = facing === "left" || facing === "right" ? "side" : facing;
      expect(frame.y).toBe(sheet.carryWalk[view].row * sheet.frameH);
    }
  });

  it("mirrors the one-handed side contact and covers the captain's baked prop", () => {
    for (const name of Object.keys(anchors.characters)) {
      const sheet: SheetLayout = SHEETS[name as keyof typeof SHEETS];
      const pose = (facing: "left" | "right") => carriedBombPose({
        sheet, frame: playerFrame(sheet, { facing, moving: true, carrying: true, tick: 21 }),
        cx: 80, feetY: 100, bomb, tick: 21,
      });
      const left = pose("left");
      const right = pose("right");
      expect(left.x + right.x).toBeCloseTo(160);
      expect(left.y).toBe(right.y);
      expect(left.scale).toBe(right.scale);
      expect(left.front).toBe(name === "captain");
    }
  });

  it("replaces Naruto's carry frame with missing hands by the matching settling pose", () => {
    const sheet = SHEETS.naruto;
    const selected = playerFrame(sheet, { facing: "down", moving: true, carrying: true, tick: 5 * sheet.ticksPerFrame });
    expect(selected).toMatchObject({ x: 0, y: 14 * sheet.frameH });
    const walk = playerFrame(sheet, { facing: "down", moving: true, carrying: false, tick: 5 * sheet.ticksPerFrame });
    expect(walk.x).toBe(5 * sheet.frameW);
  });
});
