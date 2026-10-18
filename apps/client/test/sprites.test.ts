import { describe, expect, it } from "vitest";
import { BOMBS, MotionTracker, SHEETS, bombFrame, bombPulse, deathFrame, paintHues, playerFrame, recolor } from "../src/render/sprites";

describe("playerFrame", () => {
  const foozle = SHEETS.foozle;

  it("stands on the idle frame of the facing direction", () => {
    const f = playerFrame(foozle, { facing: "down", moving: false, carrying: false, tick: 99 });
    expect(f).toMatchObject({ x: 0, y: 0, flip: false });
    expect(playerFrame(foozle, { facing: "up", moving: false, carrying: false, tick: 0 }).y).toBe(51 * 64);
  });

  it("cycles the walk row while moving", () => {
    const frames = new Set<number>();
    for (let tick = 0; tick < 120; tick++) {
      const f = playerFrame(foozle, { facing: "down", moving: true, carrying: false, tick });
      expect(f.y).toBe(3 * 64);
      frames.add(f.x);
    }
    expect(frames.size).toBe(8);
  });

  it("mirrors the side frames for the opposite side", () => {
    const right = playerFrame(foozle, { facing: "right", moving: true, carrying: false, tick: 7 });
    const left = playerFrame(foozle, { facing: "left", moving: true, carrying: false, tick: 7 });
    expect({ ...left, flip: !left.flip }).toEqual(right);
  });

  it("uses the arms-up rows while holding a bomb, when the sheet has them", () => {
    expect(playerFrame(foozle, { facing: "down", moving: false, carrying: true, tick: 0 }).y).toBe(5 * 64);
    const james = SHEETS.james;
    const held = playerFrame(james, { facing: "down", moving: false, carrying: true, tick: 0 });
    expect(held).toEqual(playerFrame(james, { facing: "down", moving: false, carrying: false, tick: 0 }));
  });

  it("stays inside the sheet for every direction and state", () => {
    for (const sheet of Object.values(SHEETS)) {
      for (const facing of ["up", "down", "left", "right"] as const) {
        for (const moving of [false, true]) {
          for (let tick = 0; tick < 60; tick++) {
            const f = playerFrame(sheet, { facing, moving, carrying: moving, tick });
            expect(f.x + sheet.frameW).toBeLessThanOrEqual(sheet.width);
            expect(f.y + sheet.frameH).toBeLessThanOrEqual(sheet.height);
          }
        }
      }
    }
  });
});

describe("recolor", () => {
  it("repaints only the listed colors, keeping their relative shading", () => {
    const px = new Uint8ClampedArray([
      82, 174, 35, 255, // clothes, mid
      4, 57, 31, 255, // clothes, dark
      206, 82, 206, 255, // hair: untouched
    ]);
    recolor(px, [[82, 174, 35], [4, 57, 31]], [232, 74, 74]);
    expect([...px.slice(0, 4)]).toEqual([232, 74, 74, 255]);
    const dark = [...px.slice(4, 7)];
    expect(dark[0]!).toBeLessThan(232);
    expect(dark[0]!).toBeGreaterThan(dark[1]!); // still red, only darker
    expect([...px.slice(8)]).toEqual([206, 82, 206, 255]);
  });

  it("ignores transparent pixels", () => {
    const px = new Uint8ClampedArray([82, 174, 35, 0]);
    recolor(px, [[82, 174, 35]], [0, 0, 255]);
    expect([...px]).toEqual([82, 174, 35, 0]);
  });
});

describe("MotionTracker", () => {
  it("is still until the position changes", () => {
    const m = new MotionTracker();
    expect(m.moving("a", 10, 10)).toBe(false);
    expect(m.moving("a", 10, 10)).toBe(false);
    expect(m.moving("a", 11, 10)).toBe(true);
  });

  it("keeps walking across frames where a snapshot has not moved it yet", () => {
    const m = new MotionTracker(4);
    m.moving("a", 0, 0);
    m.moving("a", 1, 0);
    for (let i = 0; i < 4; i++) expect(m.moving("a", 1, 0)).toBe(true);
    expect(m.moving("a", 1, 0)).toBe(false);
  });

  it("tracks each player separately", () => {
    const m = new MotionTracker();
    m.moving("a", 0, 0);
    m.moving("b", 0, 0);
    expect(m.moving("a", 5, 0)).toBe(true);
    expect(m.moving("b", 0, 0)).toBe(false);
  });
});

describe("ninja sheet", () => {
  const ninja = SHEETS.ninja;
  const at = (facing: "up" | "down" | "left" | "right", o: { moving?: boolean; stunned?: boolean; tick?: number } = {}) =>
    playerFrame(ninja, { facing, moving: o.moving ?? false, carrying: false, stunned: o.stunned ?? false, tick: o.tick ?? 0 });

  it("walks with 6 frames in each direction, mirroring east for west", () => {
    const xs = new Set<number>();
    for (let tick = 0; tick < 120; tick++) xs.add(at("up", { moving: true, tick }).x);
    expect(xs.size).toBe(6);
    expect(at("left", { moving: true }).flip).toBe(true);
    expect(at("right", { moving: true }).flip).toBe(false);
  });

  it("shows the hit reaction while stunned, whatever the facing", () => {
    expect(at("up", { stunned: true }).y).toBe(ninja.stun!.row * ninja.frameH);
    expect(at("left", { stunned: true }).flip).toBe(false);
  });
});

describe("deathFrame", () => {
  const ninja = SHEETS.ninja;
  const last = ninja.death!.frames * ninja.ticksPerFrame;

  it("plays the death row once, then the body is gone", () => {
    expect(deathFrame(ninja, 0)).toEqual({ x: 0, y: ninja.death!.row * ninja.frameH, flip: false });
    expect(deathFrame(ninja, last - 1)!.x).toBe((ninja.death!.frames - 1) * ninja.frameW);
    expect(deathFrame(ninja, last + 30)).toBeNull();
  });

  it("has nothing to play on sheets without a death row", () => {
    expect(deathFrame(SHEETS.james, 0)).toBeNull();
  });
});

describe("paintHues", () => {
  it("moves pixels in the hue range to the player's hue, keeping their shading", () => {
    const px = new Uint8ClampedArray([
      40, 90, 200, 255, // blue armor
      10, 30, 80, 255, // dark blue
      230, 190, 150, 255, // skin: untouched
    ]);
    paintHues(px, [180, 260], [232, 74, 74]);
    const [r, g, b] = px.slice(0, 3);
    expect(r!).toBeGreaterThan(g!);
    expect(r!).toBeGreaterThan(b!);
    const [dr] = px.slice(4, 7);
    expect(dr!).toBeLessThan(r!); // dark stays darker
    expect([...px.slice(8)]).toEqual([230, 190, 150, 255]);
  });

  it("turns them grey for an unsaturated player color", () => {
    const px = new Uint8ClampedArray([40, 90, 200, 255]);
    paintHues(px, [180, 260], [245, 245, 245]);
    expect(Math.max(px[0]!, px[1]!, px[2]!) - Math.min(px[0]!, px[1]!, px[2]!)).toBeLessThan(12);
  });
});

describe("bomb sheet", () => {
  it("has one cell per bomb type, inside the sheet", () => {
    const xs = (["normal", "pierce", "remote"] as const).map((t) => bombFrame(t));
    expect(new Set(xs).size).toBe(3);
    for (const x of xs) expect(x + BOMBS.size).toBeLessThanOrEqual(BOMBS.width);
  });

  it("pulses around its drawn size as the fuse burns", () => {
    const sizes = Array.from({ length: 60 }, (_, t) => bombPulse(t));
    expect(Math.max(...sizes)).toBeGreaterThan(1);
    expect(Math.min(...sizes)).toBeLessThan(1);
    expect(Math.max(...sizes)).toBeLessThan(1.2);
  });
});
