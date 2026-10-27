import { TEST_SHEETS } from "./fixtures/sheets";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BLAST_TICKS, BUBBLE_TICKS, FLAME_TICKS, FUSE_TICKS, WEB_TICKS, SNEAK_TICKS, PATRONUS_FADE, ItemKind, KAME_CHARGE, RASENGAN_TICKS, SHIELD_TICKS, SPECIAL_COOLDOWN, TICK_RATE, TILE, Tile } from "@bombtop/shared";
import { BEAM_DELAY, rasenganLook, RASENGAN, kameSegments, castTicks, outsideBeams, outsideBubbles, boltOrigin, boltPoints, magnetWaves, speedLines, tunnelMounds, spinLook, kissHearts, charmHearts, sneakAlpha, patronusLook, PATRONUS, bubbleLook, BUBBLE, bracing, SPIRAL, spiralFrame, BOMBS, ITEMS, TILES, burnCell, castsShadow, tileCell, itemCell, itemFrame, CAST_TICKS_PER_FRAME, FLAMES, MASCOT, flameFrame, flamePiece, flameVariant, flameConnections, beamAlpha, webbedLook, cocoon, MotionTracker, between, SHEETS, bombFrame, bombLook, MEGA_SCALE, deathFrame, mascotDeath, mascotPose, paintHues, paintSheet, playerFrame, recolor, shadeHues, type SheetLayout } from "../src/render/sprites";

describe("playerFrame", () => {
  const foozle = TEST_SHEETS.foozle;

  it("tiptoes on the cast row while sneaking: cycling it as he walks, its first frame standing", () => {
    const sheet = SHEETS.panther;
    const cols = new Set<number>();
    for (let tick = 0; tick < 120; tick++) {
      const f = playerFrame(sheet, { facing: "down", moving: true, carrying: false, sneaking: true, tick });
      expect(f.y).toBe(sheet.cast!.down.row * sheet.frameH);
      cols.add(f.x);
    }
    expect(cols.size).toBe(sheet.cast!.down.frames);
    const still = playerFrame(sheet, { facing: "right", moving: false, carrying: false, sneaking: true, tick: 50 });
    expect(still).toMatchObject({ x: 0, y: sheet.cast!.side.row * sheet.frameH });
  });

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
    const james = TEST_SHEETS.james;
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

describe("a PixelLab character sheet", () => {
  const sheet = SHEETS.pikachu;
  const at = (facing: "up" | "down" | "left" | "right", o: { moving?: boolean; stunned?: boolean; tick?: number } = {}) =>
    playerFrame(sheet, { facing, moving: o.moving ?? false, carrying: false, stunned: o.stunned ?? false, tick: o.tick ?? 0 });

  it("walks with 6 frames in each direction, mirroring east for west", () => {
    const xs = new Set<number>();
    for (let tick = 0; tick < 120; tick++) xs.add(at("up", { moving: true, tick }).x);
    expect(xs.size).toBe(6);
    expect(at("left", { moving: true }).flip).toBe(true);
    expect(at("right", { moving: true }).flip).toBe(false);
  });

  it("shows the hit reaction while stunned, whatever the facing", () => {
    expect(at("up", { stunned: true }).y).toBe(sheet.stun!.row * sheet.frameH);
    expect(at("left", { stunned: true }).flip).toBe(false);
  });

  it("breathes slowly while standing, not at walking pace", () => {
    const frames = (moving: boolean) => {
      let changes = 0;
      for (let tick = 1; tick < 120; tick++) if (at("down", { moving, tick }).x !== at("down", { moving, tick: tick - 1 }).x) changes++;
      return changes;
    };
    expect(frames(false)).toBeGreaterThan(0);
    expect(frames(false)).toBeLessThan(frames(true) / 2);
  });

  it("holds the bomb overhead: carry rows while carrying", () => {
    const carry = (moving: boolean) => playerFrame(sheet, { facing: "down", moving, carrying: true, tick: 0 }).y;
    expect(carry(false)).toBe(sheet.carryIdle!.down.row * sheet.frameH);
    expect(carry(true)).toBe(sheet.carryWalk!.down.row * sheet.frameH);
  });

  it("every row fits inside the image", () => {
    const strips = [sheet.idle, sheet.walk, sheet.cast!, sheet.carryIdle!, sheet.carryWalk!].flatMap((s) => Object.values(s));
    for (const s of [...strips, sheet.stun!, sheet.death!, sheet.lobby!]) {
      expect((s.row + 1) * sheet.frameH).toBeLessThanOrEqual(sheet.height);
      expect(s.frames * sheet.frameW).toBeLessThanOrEqual(sheet.width);
    }
  });
});

describe("deathFrame", () => {
  const sheet = SHEETS.pikachu;
  const last = sheet.death!.frames * sheet.ticksPerFrame;

  it("plays the death row once, then the body is gone", () => {
    expect(deathFrame(sheet, 0)).toEqual({ x: 0, y: sheet.death!.row * sheet.frameH, flip: false });
    expect(deathFrame(sheet, last - 1)!.x).toBe((sheet.death!.frames - 1) * sheet.frameW);
    expect(deathFrame(sheet, last + 30)).toBeNull();
  });

  it("has nothing to play on sheets without a death row", () => {
    expect(deathFrame(TEST_SHEETS.james, 0)).toBeNull();
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

  it("takes a range that wraps past 360 (reds), leaving the hues outside it", () => {
    const px = new Uint8ClampedArray([
      210, 56, 53, 255, // red, hue ~1
      111, 31, 49, 255, // dark crimson, hue ~345
      248, 231, 40, 255, // yellow boots: untouched
    ]);
    paintHues(px, [335, 12], [61, 123, 242]);
    expect(px[2]!).toBeGreaterThan(px[0]!);
    expect(px[6]!).toBeGreaterThan(px[4]!);
    expect([...px.slice(8)]).toEqual([248, 231, 40, 255]);
  });

  it("turns them grey for an unsaturated player color", () => {
    const px = new Uint8ClampedArray([40, 90, 200, 255]);
    paintHues(px, [180, 260], [245, 245, 245]);
    expect(Math.max(px[0]!, px[1]!, px[2]!) - Math.min(px[0]!, px[1]!, px[2]!)).toBeLessThan(12);
  });
});

describe("bomb sheet", () => {
    it("shows the energy stage at the final instant before detonation", () => {
      expect(BOMBS.stages).toContain("detonation-start");
      expect(bombLook({ fuse: 1, tick: 1, type: "normal" }).stage).toBe("detonation-start");
      expect(bombLook({ fuse: TICK_RATE, tick: 1, type: "normal" }).stage).toBe("critical");
    });
  it("has one cell per bomb type, inside the sheet", () => {
    const xs = (["normal", "pierce", "remote"] as const).map((t) => bombFrame(t));
    expect(new Set(xs).size).toBe(3);
    for (const x of xs) expect(x + BOMBS.size).toBeLessThanOrEqual(BOMBS.width);
  });

  const look = (fuse: number, tick: number, type: "normal" | "pierce" | "remote" = "normal") => bombLook({ fuse, tick, type });
  const flips = (fuse: number) => {
    let n = 0;
    for (let t = 1; t < 120; t++) if (Math.sign(look(fuse, t).sx - 1) !== Math.sign(look(fuse, t - 1).sx - 1)) n++;
    return n;
  };

  it("breathes: wider while flatter, and back", () => {
    const xs = Array.from({ length: 60 }, (_, t) => look(FUSE_TICKS, t));
    expect(Math.max(...xs.map((l) => l.sx))).toBeGreaterThan(1);
    expect(Math.min(...xs.map((l) => l.sx))).toBeLessThan(1);
    for (const l of xs) expect(Math.sign(l.sx - 1)).toBe(-Math.sign(l.sy - 1) || 0);
  });

  it("breathes faster while retaining the original colors in its last second", () => {
    expect(flips(30)).toBeGreaterThan(flips(FUSE_TICKS));
    const calm = Array.from({ length: 60 }, (_, t) => look(FUSE_TICKS, t).tint);
    expect(new Set(calm)).toEqual(new Set([0xffffff]));
    const late = Array.from({ length: 60 }, (_, t) => look(30, t).tint);
    expect(new Set(late)).toEqual(new Set([0xffffff]));
    const flashes = Array.from({ length: TICK_RATE }, (_, elapsed) => look(TICK_RATE - elapsed, elapsed).flash);
    expect(flashes).toContain(true);
    expect(flashes).toContain(false);
  });

  it("draws the bomb mascot's mega bomb bigger without squashing its sphere", () => {
    const mega = bombLook({ fuse: FUSE_TICKS, tick: 5, type: "pierce", mega: true });
    const plain = look(FUSE_TICKS, 5, "pierce");
    expect(mega.sx / plain.sx).toBeCloseTo(MEGA_SCALE);
    expect(mega.sy).toBe(mega.sx);
    expect(mega.sy / plain.sx).toBeCloseTo(MEGA_SCALE);
    expect(MEGA_SCALE).toBeGreaterThan(1.3);
  });

  it("keeps breathing throughout the remote bomb fuse", () => {
    expect(look(FUSE_TICKS, 7, "remote").sx).not.toBe(look(FUSE_TICKS, 0, "remote").sx);
  });

  it("flickers the fuse spark (or the remote light)", () => {
    for (const type of ["normal", "remote"] as const) {
      const on = Array.from({ length: 60 }, (_, t) => look(FUSE_TICKS, t, type).glow);
      expect(on).toContain(true);
      expect(on).toContain(false);
      expect(BOMBS.glow[type]).toBeDefined();
    }
  });
});

describe("mascot in the arena", () => {
  const pose = (o: { moving?: boolean; stunned?: boolean; facing?: "up" | "down" | "left" | "right"; tick?: number } = {}) =>
    mascotPose({ moving: o.moving ?? false, stunned: o.stunned ?? false, facing: o.facing ?? "down", tick: o.tick ?? 0 });
  const over = (o: Parameters<typeof pose>[0] = {}) => Array.from({ length: 60 }, (_, tick) => pose({ ...o, tick }));

  it("breathes in place while standing, happy", () => {
    const xs = over();
    expect(xs.every((p) => p.dy === 0 && p.rot === 0 && p.mood === "happy")).toBe(true);
    expect(Math.max(...xs.map((p) => p.sx))).toBeGreaterThan(1);
    for (const p of xs) expect(Math.sign(p.sx - 1)).toBe(-Math.sign(p.sy - 1) || 0);
  });

  it("walks through four steps with a little bounce", () => {
    const xs = over({ moving: true });
    expect(new Set(xs.map((p) => p.step))).toEqual(new Set([0, 1, 2, 3]));
    expect(xs.every((p) => p.dy <= 0)).toBe(true);
    expect(Math.min(...xs.map((p) => p.dy))).toBeLessThan(-0.5);
    expect(over().every((p) => p.step === 0)).toBe(true);
  });

  it("shows its face going down, its back going up, its side going left or right", () => {
    expect(pose({ facing: "down" })).toMatchObject({ view: "front", flip: false });
    expect(pose({ facing: "up" })).toMatchObject({ view: "back", flip: false });
    expect(pose({ facing: "right" })).toMatchObject({ view: "side", flip: false });
    expect(pose({ facing: "left" })).toMatchObject({ view: "side", flip: true });
  });

  it("wobbles, wide-eyed, while stunned", () => {
    const xs = over({ stunned: true, moving: true });
    expect(xs.every((p) => p.mood === "wow")).toBe(true);
    expect(new Set(xs.map((p) => Math.sign(p.rot))).size).toBeGreaterThan(1);
  });

  it("floats away and fades when killed, then is gone", () => {
    const first = mascotDeath(0)!;
    expect(first.alpha).toBe(1);
    expect(first.mood).toBe("sad");
    const late = mascotDeath(MASCOT.deathTicks - 1)!;
    expect(late.alpha).toBeLessThan(0.2);
    expect(late.dy).toBeLessThan(first.dy);
    expect(mascotDeath(MASCOT.deathTicks)).toBeNull();
  });
});

describe("special cast visuals", () => {
  const sheet = SHEETS.pikachu;
  const cast = sheet.cast!;
  const frame = (facing: "up" | "down" | "left" | "right", casting: number) =>
    playerFrame(sheet, { facing, moving: true, carrying: false, casting, tick: 0 });

  it("plays the cast row for the facing direction, mirroring east for west", () => {
    expect(frame("down", 0).y).toBe(cast.down.row * sheet.frameH);
    expect(frame("up", 0).y).toBe(cast.up.row * sheet.frameH);
    expect(frame("left", 0)).toMatchObject({ y: cast.side.row * sheet.frameH, flip: true });
    const last = frame("down", cast.down.frames * CAST_TICKS_PER_FRAME - 1);
    expect(last.x).toBe((cast.down.frames - 1) * sheet.frameW);
    expect(last.x + sheet.frameW).toBeLessThanOrEqual(sheet.width);
  });

  it("goes back to walking once the cast is over", () => {
    const after = frame("down", cast.down.frames * CAST_TICKS_PER_FRAME);
    expect(after.y).toBe(sheet.walk.down.row * sheet.frameH);
  });

  it("the beam appears when the hands thrust forward and fades out", () => {
    expect(beamAlpha(0)).toBe(0);
    expect(beamAlpha(BEAM_DELAY)).toBeGreaterThan(0.8);
    expect(beamAlpha(BLAST_TICKS - 1)).toBeLessThan(beamAlpha(BEAM_DELAY));
  });

  it("a lightning bolt zigzags from end to end, within a few pixels of the line, and flickers over time", () => {
    const pts = boltPoints(0, 10, 64, 10, 3);
    expect(pts[0]).toEqual([0, 10]);
    expect(pts.at(-1)).toEqual([64, 10]);
    expect(pts.length).toBeGreaterThan(4);
    for (const [, y] of pts) expect(Math.abs(y - 10)).toBeLessThanOrEqual(4);
    expect(pts.some(([, y]) => y !== 10)).toBe(true);
    expect(boltPoints(0, 10, 64, 10, 3)).toEqual(pts);
    expect(boltPoints(0, 10, 64, 10, 4)).not.toEqual(pts);
    const down = boltPoints(5, 0, 5, 48, 1);
    for (const [x] of down) expect(Math.abs(x - 5)).toBeLessThanOrEqual(4);
  });

  it("the magnet pull sends rings of force from the one pulled back to the caster, shrinking as they arrive", () => {
    const at = (age: number) => magnetWaves(0, 10, 64, 10, age);
    const waves = at(4);
    expect(waves.length).toBeGreaterThanOrEqual(2);
    for (const w of waves) {
      expect(w.y).toBe(10);
      expect(w.x).toBeGreaterThanOrEqual(0);
      expect(w.x).toBeLessThanOrEqual(64);
    }
    // Each ring moves toward the caster tick by tick.
    expect(at(5)[0]!.x).toBeLessThan(waves[0]!.x);
    const near = waves.reduce((a, b) => (a.x < b.x ? a : b));
    const far = waves.reduce((a, b) => (a.x > b.x ? a : b));
    expect(near.r).toBeLessThan(far.r);
    const down = magnetWaves(5, 0, 5, 48, 3);
    for (const w of down) expect(w.x).toBe(5);
  });

  it("braces whoever holds a pose: the captain behind his shield, the green lantern kneeling in his bubble unless he walks", () => {
    expect(bracing({ shield: 0, bubble: 0 }, false)).toBeUndefined();
    expect(bracing({ shield: SHIELD_TICKS - 10, bubble: 0 }, false)).toBe(10);
    expect(bracing({ shield: 0, bubble: BUBBLE_TICKS - 25 }, false)).toBe(25);
    expect(bracing({ shield: 0, bubble: BUBBLE_TICKS - 25 }, true)).toBeUndefined(); // walking in it
  });

  it("the green lantern's bubble forms, holds shimmering, flickers in its last second and gives way as it ends", () => {
    expect(bubbleLook(0, 0)).toBeNull();
    expect(bubbleLook(BUBBLE_TICKS, 0)).toEqual({ row: BUBBLE.rows.form, frame: 0, alpha: 1 });
    const formed = BUBBLE_TICKS - BUBBLE.frames.form * BUBBLE.ticks;
    const loop = [0, 1, 2, 3].map((t) => bubbleLook(formed - 30, t * BUBBLE.ticks)!);
    for (const l of loop) expect(l.row).toBe(BUBBLE.rows.loop);
    expect(new Set(loop.map((l) => l.frame)).size).toBe(4); // shimmering
    const lastSecond = Array.from({ length: 20 }, (_, t) => bubbleLook(40, t)!);
    expect(lastSecond.some((l) => l.alpha < 1)).toBe(true); // flickering
    expect(bubbleLook(1, 0)).toEqual({ row: BUBBLE.rows.pop, frame: BUBBLE.frames.pop - 1, alpha: 1 });
    const pops = Array.from({ length: BUBBLE.frames.pop * BUBBLE.ticks }, (_, i) => bubbleLook(BUBBLE.frames.pop * BUBBLE.ticks - i, 0)!);
    for (const l of pops) expect(l.row).toBe(BUBBLE.rows.pop);
    expect(pops.map((l) => l.frame)).toEqual([...pops.map((l) => l.frame)].sort((a, b) => a - b));
  });

  it("bugs' tunnel heaves up a ridge of dirt mounds from where he went under to where he came out, running ahead fast", () => {
    const all = tunnelMounds(0, 10, 80, 10, 30);
    expect(all.length).toBeGreaterThanOrEqual(5);
    for (const m of all) {
      expect(m.y).toBe(10); // along the tunnel
      expect(m.x).toBeGreaterThan(0);
      expect(m.x).toBeLessThan(80);
      expect(m.r).toBeGreaterThan(0);
    }
    const xs = all.map((m) => m.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b)); // in order from the start
    expect(tunnelMounds(0, 10, 80, 10, 1).length).toBeLessThan(all.length); // still running ahead
    expect(tunnelMounds(0, 10, 80, 10, 1).length).toBeGreaterThan(0);
    for (const m of tunnelMounds(5, 0, 5, 48, 30)) expect(m.x).toBe(5);
  });

  it("penelope's kiss flies as a heart from her hand to where it stopped, then bursts into little hearts", () => {
    const [first] = kissHearts(0, 10, 80, 10, 0);
    expect(first!.x).toBeCloseTo(0);
    const mid = kissHearts(0, 10, 80, 10, 8);
    expect(mid[0]!.x).toBeGreaterThan(0);
    expect(mid[0]!.x).toBeLessThan(80);
    for (const h of mid) expect(h.y).toBeLessThanOrEqual(10 + 4);
    // landed: a ring of little hearts round the end, fading out with the blast
    const burst = kissHearts(0, 10, 80, 10, BLAST_TICKS - 6);
    expect(burst.length).toBeGreaterThan(3);
    for (const h of burst) expect(Math.hypot(h.x - 80, h.y - 10)).toBeLessThan(16);
    expect(kissHearts(0, 10, 80, 10, BLAST_TICKS).every((h) => h.alpha === 0)).toBe(true);
    // straight up the column too
    for (const h of kissHearts(5, 60, 5, 0, 6)) expect(Math.abs(h.x - 5)).toBeLessThan(4);
  });

  it("harry's stag gallops from him the way he cast it, all the way to where it stopped, then fades into sparkles", () => {
    const run = 40; // ticks it takes to get there
    const start = patronusLook(0, 20, 160, 20, "right", run, 0)!;
    expect(start.x).toBeCloseTo(0);
    const mid = patronusLook(0, 20, 160, 20, "right", run, 20)!;
    expect(mid.x).toBeCloseTo(80, 0); // a steady gallop
    // bounding along: never below the path
    const ys = Array.from({ length: run }, (_, i) => patronusLook(0, 20, 160, 20, "right", run, i)!.y);
    expect(Math.max(...ys)).toBeLessThanOrEqual(20);
    expect(Math.min(...ys)).toBeLessThan(19);
    // its legs go round the gallop frames as it runs
    const frames = new Set(Array.from({ length: run }, (_, i) => patronusLook(0, 20, 160, 20, "right", run, i)!.frame));
    expect(frames.size).toBe(PATRONUS.frames);
    // a trail of sparkles behind it
    expect(mid.sparkles.length).toBeGreaterThan(2);
    for (const s of mid.sparkles) expect(s.x).toBeLessThanOrEqual(mid.x + 1);
    // there, then fading out
    const end = patronusLook(0, 20, 160, 20, "right", run, run + PATRONUS_FADE - 4)!;
    expect(end.x).toBeCloseTo(160);
    expect(end.alpha).toBeLessThan(0.6);
    expect(patronusLook(0, 20, 160, 20, "right", run, run + PATRONUS_FADE)).toBeNull();
    // seen from the side running left or right, from the front running down, from behind running up
    expect(mid).toMatchObject({ view: "side", flip: false });
    expect(patronusLook(160, 20, 0, 20, "left", run, 5)).toMatchObject({ view: "side", flip: true });
    expect(patronusLook(20, 0, 20, 160, "down", run, 5)).toMatchObject({ view: "down", flip: false });
    const up = patronusLook(20, 160, 20, 0, "up", run, 20)!;
    expect(up).toMatchObject({ view: "up" });
    expect(up.y).toBeLessThan(160);
    expect(PATRONUS.url).toContain("patronus");
  });

  it("a charmed player has hearts circling over their head, none once it wears off", () => {
    expect(charmHearts(0, 10)).toEqual([]);
    const hearts = charmHearts(120, 10);
    expect(hearts.length).toBe(3);
    const later = charmHearts(119, 11);
    expect(later[0]!.dx).not.toBeCloseTo(hearts[0]!.dx, 3); // they move round
    for (const h of hearts) expect(h.dy).toBeLessThan(0); // above the anchor
  });

  it("donatello's staff spin turns his bo round him twice, a whoosh ring swelling out and fading", () => {
    const start = spinLook(0);
    const end = spinLook(BLAST_TICKS);
    expect(end.angle - start.angle).toBeGreaterThanOrEqual(4 * Math.PI);
    for (let t = 1; t <= BLAST_TICKS; t++) expect(spinLook(t).angle).toBeGreaterThan(spinLook(t - 1).angle);
    expect(spinLook(BLAST_TICKS / 2).ring).toBeGreaterThan(start.ring);
    expect(start.alpha).toBeGreaterThan(0.5);
    expect(end.alpha).toBe(0);
  });

  it("the flash's dash leaves speed lines from where he left to where he stopped, the tail catching up as they fade", () => {
    const at = (age: number) => speedLines(0, 10, 80, 10, age);
    const lines = at(0);
    expect(lines.length).toBeGreaterThanOrEqual(3);
    for (const l of lines) {
      expect(l.y0).toBe(l.y1); // along the dash
      expect(l.x1).toBeCloseTo(80, 0);
      expect(l.x0).toBeGreaterThanOrEqual(0);
    }
    expect(new Set(lines.map((l) => l.y0)).size).toBe(lines.length); // side by side
    expect(Math.min(...at(10).map((l) => l.x0))).toBeGreaterThan(Math.min(...lines.map((l) => l.x0)));
    for (const l of speedLines(5, 0, 5, 48, 3)) expect(l.x0).toBe(l.x1);
  });

});

describe("spider web", () => {
  it("a webbed player struggles in place, and the web loosens (flickers) in its last second", () => {
    expect(webbedLook(0, 0)).toBeNull();
    const tight = Array.from({ length: 30 }, (_, t) => webbedLook(WEB_TICKS, t)!);
    expect(new Set(tight.map((l) => l.wraps))).toEqual(new Set([true]));
    expect(new Set(tight.map((l) => l.shake)).size).toBeGreaterThan(1);
    for (const l of tight) expect(Math.abs(l.shake)).toBeLessThanOrEqual(1);
    const loose = Array.from({ length: 30 }, (_, t) => webbedLook(30, t)!.wraps);
    expect(new Set(loose)).toEqual(new Set([true, false]));
  });

  it("the cocoon wraps the body from over the head to the feet, strands crossing it", () => {
    const body = 21;
    const c = cocoon(100, 50, body);
    const feet = 50 + 6;
    expect(c.y).toBeLessThan(feet - body);
    expect(c.y + c.h).toBeGreaterThan(feet);
    expect(c.x + c.w / 2).toBe(100);
    expect(c.strands.length).toBeGreaterThanOrEqual(5);
    expect(c.back.length).toBeGreaterThanOrEqual(2);
    for (const [x0, y0, x1, y1] of [...c.strands, ...c.back]) {
      for (const [x, y] of [[x0, y0], [x1, y1]] as const) {
        expect(x).toBeGreaterThanOrEqual(c.x);
        expect(x).toBeLessThanOrEqual(c.x + c.w);
        expect(y).toBeGreaterThanOrEqual(c.y);
        expect(y).toBeLessThanOrEqual(c.y + c.h);
      }
      expect(y1).not.toBe(y0); // slanted, wound round him
    }
  });
});

describe("explosion flames", () => {
  it("connects a corner only towards burning neighbours, without square stubs into empty tiles", () => {
    const burning = (x: number, y: number) => (x === 1 && y === 0) || (x === 0 && y === 1);
    expect(flameConnections(burning, 0, 0)).toBe(3);
    expect(flameConnections(() => false, 0, 0)).toBe(0);
    expect(flameConnections(() => true, 0, 0)).toBe(15);
  });
  const at = (tiles: [number, number][]) => (x: number, y: number) => tiles.some(([tx, ty]) => tx === x && ty === y);
  // A cross of range 2 around (5,5).
  const cross = at([[5, 5], [4, 5], [3, 5], [6, 5], [7, 5], [5, 4], [5, 3], [5, 6], [5, 7]]);
  const Q = Math.PI / 2;

  it("puts the fireball where arms meet or where a flame stands alone", () => {
    expect(flamePiece(cross, 5, 5)).toEqual({ kind: "center", rot: 0 });
    expect(flamePiece(at([[1, 1]]), 1, 1)).toEqual({ kind: "center", rot: 0 });
  });

  it("runs arms through the middle tiles, turned for vertical ones", () => {
    expect(flamePiece(cross, 4, 5)).toEqual({ kind: "mid", rot: 0 });
    expect(flamePiece(cross, 5, 4)).toEqual({ kind: "mid", rot: Q });
  });

  it("caps each arm with a tip that faces away from the blast", () => {
    expect(flamePiece(cross, 7, 5)).toEqual({ kind: "end", rot: 0 }); // joins on its left
    expect(flamePiece(cross, 3, 5)).toEqual({ kind: "end", rot: 2 * Q });
    expect(flamePiece(cross, 5, 7)).toEqual({ kind: "end", rot: Q }); // joins above
    expect(flamePiece(cross, 5, 3)).toEqual({ kind: "end", rot: -Q });
  });

  it("flares up, burns, then dies down over the flame's life", () => {
    const frames = Array.from({ length: FLAME_TICKS }, (_, i) => flameFrame(FLAME_TICKS - i));
    expect(frames[0]).toBe(0);
    expect(frames.at(-1)).toBe(FLAMES.frames - 1);
    expect([...frames].sort((a, b) => a - b)).toEqual(frames);
    expect(new Set(frames).size).toBe(FLAMES.frames);
  });

  it("provides four arm variants with no identical neighbours, including negative coordinates", () => {
    expect(FLAMES.variants).toBe(4);
    for (let x = -8; x < 12; x++) {
      for (let y = -8; y < 12; y++) {
        const row = flameVariant(x, y);
        expect(row).toBeGreaterThanOrEqual(0);
        expect(row).toBeLessThan(FLAMES.variants);
        expect(row).not.toBe(flameVariant(x + 1, y));
        expect(row).not.toBe(flameVariant(x, y + 1));
      }
    }
  });
});

describe("item art", () => {
  it("has a cell for every item kind", () => {
    expect([...ITEMS.order].sort()).toEqual(Object.values(ItemKind).sort());
    expect(itemCell(ITEMS.order[3]!)).toBe(3 * ITEMS.size);
  });

  it("is drawn a bit smaller than its tile", () => {
    expect(ITEMS.size * ITEMS.scale).toBeLessThan(16);
    expect(ITEMS.size * ITEMS.scale).toBeGreaterThan(12);
  });

  it("glints now and then, not all items at once", () => {
    const glints = (x: number, y: number) =>
      Array.from({ length: 4 * TICK_RATE }, (_, tick) => itemFrame(tick, x, y)).filter((f) => f > 0).length;
    expect(glints(3, 3)).toBeGreaterThan(0);
    expect(glints(3, 3)).toBeLessThan(TICK_RATE);
    const same = Array.from({ length: 4 * TICK_RATE }, (_, tick) => itemFrame(tick, 3, 3) === itemFrame(tick, 4, 3));
    expect(same.every(Boolean)).toBe(false);
  });

  it("the glint sweeps through every shine frame", () => {
    const frames = new Set(Array.from({ length: 4 * TICK_RATE }, (_, tick) => itemFrame(tick, 1, 1)));
    expect([...frames].sort()).toEqual(Array.from({ length: ITEMS.frames }, (_, i) => i));
  });
});

describe("tile art", () => {
  const w = 15;
  const h = 13;

  it("the border, inner pillars and blocks each get their own art", () => {
    expect(tileCell(Tile.Wall, 0, 5, w, h)).toBe(TILES.cells.border);
    expect(tileCell(Tile.Wall, 7, h - 1, w, h)).toBe(TILES.cells.border);
    expect(tileCell(Tile.Wall, 2, 2, w, h)).toBe(TILES.cells.pillar);
    expect(tileCell(Tile.Block, 3, 1, w, h)).toBe(TILES.cells.block);
  });

  it("a blown-up block burns away in six frames over its flame's life: struck, ablaze, breaking, collapsing, embers, ash", () => {
    expect(TILES.cells.burn).toHaveLength(6);
    const frames = Array.from({ length: FLAME_TICKS }, (_, i) => burnCell(FLAME_TICKS - i));
    expect(frames[0]).toBe(TILES.cells.burn[0]);
    expect(frames.at(-1)).toBe(TILES.cells.burn.at(-1));
    expect([...frames].sort((a, b) => a - b)).toEqual(frames);
    expect(new Set(frames)).toEqual(new Set(TILES.cells.burn));
  });

  it("grass alternates two shades like a lawn, with the odd flower patch", () => {
    const a = tileCell(Tile.Empty, 1, 1, w, h);
    const b = tileCell(Tile.Empty, 2, 1, w, h);
    expect(TILES.cells.grassA).toContain(a);
    expect(TILES.cells.grassB).toContain(b);
    const cells = new Set<number>();
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) if ((x + y) % 2 === 0) cells.add(tileCell(Tile.Empty, x, y, w, h));
    expect(cells.size).toBeGreaterThan(1); // some variety
    expect(tileCell(Tile.Empty, 5, 5, w, h)).toBe(tileCell(Tile.Empty, 5, 5, w, h)); // stable
  });

  it("walls and blocks cast a shadow on the floor below them", () => {
    expect(castsShadow(Tile.Wall)).toBe(true);
    expect(castsShadow(Tile.Block)).toBe(true);
    expect(castsShadow(Tile.Empty)).toBe(false);
  });
});

describe("bomber sheet", () => {
  const sheet = SHEETS.bomber;

  it("preserves the warm eye glow when changing player colors", () => {
    const eyes = new Uint8ClampedArray(sheet.width * sheet.frameH * 4);
    eyes.set([195, 49, 46, 253, 198, 36, 27, 253, 255, 178, 8, 253], (86 * sheet.width + 47) * 4);
    const original = eyes.slice();
    paintSheet(eyes, sheet, [65, 190, 95]);
    expect([...eyes.slice((86 * sheet.width + 47) * 4, (86 * sheet.width + 50) * 4)])
      .toEqual([...original.slice((86 * sheet.width + 47) * 4, (86 * sheet.width + 50) * 4)]);
  });

  it("makes the red seat visibly darker than the original scarlet armor", () => {
    const armor = new Uint8ClampedArray([215, 17, 30, 255]);
    paintSheet(armor, sheet, [232, 74, 74]);
    expect(armor[0]).toBeLessThan(170);
  });

  it("matches the reusable visual identity's runtime contract", () => {
    const identity = JSON.parse(readFileSync(new URL("../../../concept/characters.identity.json", import.meta.url), "utf8")) as {
      animationGrid: { runtimeGameplay: { cell: number[]; size: number[]; anchor: number[]; bodyHeight: number; scale: number } };
    };
    const runtime = identity.animationGrid.runtimeGameplay;
    expect(runtime.cell).toEqual([sheet.frameW, sheet.frameH]);
    expect(runtime.size).toEqual([sheet.width, sheet.height]);
    expect(runtime.anchor).toEqual([sheet.anchorX, sheet.anchorY]);
    expect(runtime.bodyHeight).toBe(sheet.bodyH);
    expect(runtime.scale).toBe(sheet.scale);
  });

  it("matches the PNG dimensions and its nine-by-eighteen grid", () => {
    const png = readFileSync(new URL("../public/sprites/bomber-atlas.png", import.meta.url));
    expect(sheet.width).toBe(png.readUInt32BE(16));
    expect(sheet.height).toBe(png.readUInt32BE(20));
    expect(sheet.frameW * 9).toBeCloseTo(sheet.width);
    expect(sheet.frameH * 18).toBeCloseTo(sheet.height);
  });

  it("fits every strip inside the image", () => {
    const strips = [
      ...[sheet.idle, sheet.walk, sheet.cast, sheet.carryIdle, sheet.carryWalk].flatMap((set) => Object.values(set)),
      sheet.stun,
      sheet.death,
      sheet.lobby,
    ];
    for (const s of strips) {
      expect((s.row + 1) * sheet.frameH).toBeLessThanOrEqual(sheet.height);
      expect(s.frames * sheet.frameW).toBeLessThanOrEqual(sheet.width);
    }
  });

  it("walks through 6 steps per view, mirroring right for left", () => {
    const cols = new Set(Array.from({ length: 64 }, (_, tick) => playerFrame(sheet, { facing: "down", moving: true, carrying: false, tick }).x));
    expect(cols.size).toBe(6);
    expect(playerFrame(sheet, { facing: "left", moving: true, carrying: false, tick: 0 }).flip).toBe(true);
    expect(playerFrame(sheet, { facing: "up", moving: true, carrying: false, tick: 0 }).y).toBe(sheet.walk.up.row * sheet.frameH);
  });

  it.each([[232, 74, 74], [70, 130, 230], [65, 190, 95]])("repaints his red details for seat color %j", (r, g, b) => {
    const data = new Uint8ClampedArray([
      215, 17, 30, 255,
      106, 8, 15, 255,
      25, 27, 32, 255,
      255, 160, 25, 255,
    ]);
    paintSheet(data, sheet, [r, g, b]);
    expect([...data.slice(0, 3)]).toEqual(r === 232 ? [145, 24, 52] : [r, g, b]);
    expect(data[4]).toBeLessThan(r);
    expect([...data.slice(8)]).toEqual([25, 27, 32, 255, 255, 160, 25, 255]);
  });

  it("plants his mega bomb on the cast rows", () => {
    const f = playerFrame(sheet, { facing: "down", moving: false, carrying: false, casting: 2 * CAST_TICKS_PER_FRAME, tick: 0 });
    expect(f.y).toBe(sheet.cast.down.row * sheet.frameH);
  });

  it("plays its death once, then is gone", () => {
    expect(deathFrame(sheet, 0)).not.toBeNull();
    expect(deathFrame(sheet, sheet.death.frames * sheet.ticksPerFrame)).toBeNull();
  });
});

describe("HD art", () => {
  it("is drawn at the same size on the stage as the old pixel art", () => {
    expect(TILES.size * TILES.scale).toBe(16);
    expect(FLAMES.size * FLAMES.scale).toBeGreaterThanOrEqual(16);
    expect(FLAMES.size * FLAMES.scale).toBeLessThanOrEqual(16.25);
    expect(BOMBS.size * BOMBS.scale).toBeCloseTo(128 * 0.1);
    expect(ITEMS.size * ITEMS.scale).toBeCloseTo(48 * 0.29);
    expect(SHEETS.bomber.bodyH * SHEETS.bomber.scale).toBeCloseTo(SHEETS.goku.bodyH * SHEETS.goku.scale, 0); // as tall as Goku
  });
});

describe("shadeHues", () => {
  const px = (...cs: [number, number, number][]) => new Uint8ClampedArray(cs.flatMap((c) => [...c, 255]));

  it("paints the base shade exactly in the player's color, darker shades darker", () => {
    const data = px([78, 64, 160], [39, 32, 80]);
    shadeHues(data, [225, 285], [78, 64, 160], [232, 74, 74]);
    expect([...data.slice(0, 3)]).toEqual([232, 74, 74]);
    expect(data[4]!).toBeLessThan(140);
    expect(data[4]!).toBeGreaterThan(90);
  });

  it("lightens past the base toward white instead of clipping", () => {
    const data = px([156, 128, 255]);
    shadeHues(data, [225, 285], [78, 64, 160], [232, 74, 74]);
    expect(data[1]!).toBeGreaterThan(74);
    expect(data[0]!).toBeLessThanOrEqual(255);
  });

  it("leaves other colors alone (feet, cap, eyes)", () => {
    const data = px([255, 178, 60], [112, 112, 112], [255, 255, 255]);
    const before = [...data];
    shadeHues(data, [225, 285], [78, 64, 160], [232, 74, 74]);
    expect([...data]).toEqual(before);
  });
});

describe("paintSheet", () => {
  const navy = SHEETS.captain.hueBase;
  const px = () => new Uint8ClampedArray([...navy, 255, 255, 255, 255, 255]);

  it("repaints a character's clothes in the player's color", () => {
    const data = px();
    paintSheet(data, SHEETS.captain, [232, 74, 74]);
    expect([...data.slice(0, 3)]).toEqual([232, 74, 74]);
  });

  it("keeps the captain's own navy for the white player, whose color is already all over his art", () => {
    const data = px();
    paintSheet(data, SHEETS.captain, [245, 245, 245]);
    expect([...data.slice(0, 3)]).toEqual([...navy]);
  });
});

describe("between", () => {
  const from = { px: 1000, py: 500 };
  it("interpolates a player between two snapshots", () => {
    expect(between(from, { px: 1100, py: 500 }, 0.5)).toEqual({ px: 1050, py: 500 });
  });

  it("carries a walk on a little past the newest snapshot", () => {
    expect(between(from, { px: 1100, py: 500 }, 1.5)).toEqual({ px: 1150, py: 500 });
  });

  it("never carries a teleport (warp, respawn) past where it landed", () => {
    expect(between(from, { px: 1000 + 3 * TILE, py: 500 }, 1.5)).toEqual({ px: 1000 + 3 * TILE, py: 500 });
  });
});

describe("rasenganLook", () => {
  it("spins the ball in naruto's hand all through his dash", () => {
    expect(rasenganLook(RASENGAN_TICKS, undefined)).toEqual({ orb: 0 });
    expect(rasenganLook(RASENGAN_TICKS - 3, undefined)).toEqual({ orb: 3 });
    expect(rasenganLook(RASENGAN_TICKS - 9, undefined)).toEqual({ orb: 9 % RASENGAN.frames });
  });

  it("bursts where it strikes, a frame every 2 ticks, then is gone", () => {
    const struck = (age: number) => ({ ttl: BLAST_TICKS - age, kind: "rasengan" as const });
    expect(rasenganLook(0, struck(0))).toEqual({ burst: 0 });
    expect(rasenganLook(0, struck(5))).toEqual({ burst: 2 });
    expect(rasenganLook(0, struck(2 * RASENGAN.frames))).toBeNull();
    expect(rasenganLook(0, { ttl: BLAST_TICKS, kind: "lightning" })).toBeNull();
    expect(rasenganLook(0, undefined)).toBeNull();
  });
});

describe("castTicks", () => {
  it("lula's runs from when he uses his special (it leaves no blast: the picanha is an item)", () => {
    const lula = { charge: 0, rasengan: 0, character: "lula" as const };
    expect(castTicks({ ...lula, specialCooldown: SPECIAL_COOLDOWN }, undefined)).toBe(0);
    expect(castTicks({ ...lula, specialCooldown: SPECIAL_COOLDOWN - 10 }, undefined)).toBe(10);
    expect(castTicks({ ...lula, specialCooldown: SPECIAL_COOLDOWN - 9 * CAST_TICKS_PER_FRAME }, undefined)).toBeUndefined();
    expect(castTicks({ charge: 0, rasengan: 0, character: "pele", specialCooldown: SPECIAL_COOLDOWN }, undefined)).toBeUndefined();
  });

  const still = { charge: 0, rasengan: 0 };
  it("runs goku's cast from the start of his charge: the beam leaves on the thrust frame", () => {
    expect(castTicks({ charge: KAME_CHARGE, rasengan: 0 }, undefined)).toBe(0);
    expect(castTicks({ charge: 1, rasengan: 0 }, undefined)).toBe(KAME_CHARGE - 1);
    const beam = { ttl: BLAST_TICKS, kind: "kamehameha" } as const;
    expect(castTicks(still, beam)).toBe(KAME_CHARGE);
    expect(KAME_CHARGE).toBe(5 * CAST_TICKS_PER_FRAME);
  });

  it("runs naruto's from the start of his dash: the strike comes on the lunge frame", () => {
    expect(castTicks({ charge: 0, rasengan: RASENGAN_TICKS }, undefined)).toBe(0);
    expect(castTicks({ charge: 0, rasengan: 1 }, undefined)).toBe(RASENGAN_TICKS - 1);
    expect(castTicks(still, { ttl: BLAST_TICKS - 2, kind: "rasengan" })).toBe(RASENGAN_TICKS + 2);
    expect(RASENGAN_TICKS).toBe(3 * CAST_TICKS_PER_FRAME);
  });

  it("runs the bomb mascot's from the moment his mega bomb lands", () => {
    expect(castTicks(still, undefined, { fuse: FUSE_TICKS })).toBe(0);
    expect(castTicks(still, undefined, { fuse: FUSE_TICKS - 7 })).toBe(7);
  });

  it("other casts start with their blast", () => {
    expect(castTicks(still, { ttl: BLAST_TICKS - 3, kind: "lightning" })).toBe(3);
    expect(castTicks(still, undefined)).toBeUndefined();
  });
});

describe("kameSegments", () => {
  it.each(["up", "down"] as const)("keeps Goku's %s release pose throughout the beam", facing => {
    for (let age = 4; age < BLAST_TICKS; age++) {
      const casting = castTicks({ charge: 0, rasengan: 0 }, { kind: "kamehameha", ttl: BLAST_TICKS - age });
      const frame = playerFrame(SHEETS.goku, { facing, moving: false, carrying: false, casting, tick: age });
      expect(frame.x).toBe(6 * SHEETS.goku.frameW);
      expect(frame.y).toBe(SHEETS.goku.cast[facing].row * SHEETS.goku.frameH);
    }
  });
  it("lays the kamehameha out: its ball at his hands, beam pieces a tile apart, its head where it stops", () => {
    const parts = kameSegments(0, 10, 64, 10);
    expect(parts[0]).toEqual({ kind: "orb", x: 0, y: 10, rot: 0 });
    expect(parts.filter((p) => p.kind === "body").map((p) => p.x)).toEqual([8, 24, 40, 56]);
    const head = parts.at(-1)!;
    expect(head.kind).toBe("head");
    expect(head.x).toBeCloseTo(64 - 0.8);
    expect(head.y).toBe(10);
  });

  it("turns the pieces toward where it goes", () => {
    const up = kameSegments(5, 50, 5, 18);
    expect(up.every((p) => Math.abs(p.rot + Math.PI / 2) < 1e-9)).toBe(true);
    expect(up.find((p) => p.kind === "body")!.y).toBe(42);
  });

  it("never runs the beam past its head", () => {
    const parts = kameSegments(0, 0, 70, 0);
    for (const p of parts.filter((q) => q.kind === "body")) expect(p.x + 8).toBeLessThanOrEqual(70);
    expect(Math.max(...parts.filter((q) => q.kind === "body").map((p) => p.x)) + 8).toBe(70); // and leaves no gap
  });
});

describe("outsideBubbles", () => {
  it("drops the fire inside the green lantern's bubble: it stops at it and goes on past it", () => {
    const at = (x: number, y: number) => ({ px: x * TILE + TILE / 2, py: y * TILE + TILE / 2 });
    const flames = [{ x: 3, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 3 }];
    expect(outsideBubbles(flames, [{ ...at(4, 3), bubble: 30, alive: true }])).toEqual([flames[0], flames[2]]);
    expect(outsideBubbles(flames, [{ ...at(4, 3), bubble: 0, alive: true }])).toEqual(flames);
    expect(outsideBubbles(flames, [{ ...at(4, 3), bubble: 30, alive: false }])).toEqual(flames);
  });
});

describe("outsideBeams", () => {
  it("drops the kamehameha's own fire along its beam, which is drawn instead", () => {
    const beam = { ownerId: "g", x: 2, y: 3, dir: "right", length: 2, ttl: 30, kind: "kamehameha" } as const;
    const flames = [
      { x: 3, y: 3, ttl: 5, ownerId: "g" },
      { x: 4, y: 3, ttl: 5, ownerId: "g" },
      { x: 5, y: 3, ttl: 5, ownerId: "g" }, // past its end
      { x: 3, y: 3, ttl: 5, ownerId: "other" },
    ];
    expect(outsideBeams(flames, [beam])).toEqual([flames[2], flames[3]]);
    expect(outsideBeams(flames, [{ ...beam, kind: "lightning" }])).toEqual(flames);
  });
});

describe("goku sheet", () => {
  const goku = SHEETS.goku;

  it("every row fits inside the image", () => {
    const strips = [goku.idle, goku.walk, goku.cast!, goku.carryIdle!, goku.carryWalk!].flatMap((s) => Object.values(s));
    for (const s of [...strips, goku.stun!, goku.death!]) {
      expect((s.row + 1) * goku.frameH).toBeLessThanOrEqual(goku.height);
      expect(s.frames * goku.frameW).toBeLessThanOrEqual(goku.width);
    }
  });

  it("stands about as tall as the captain on screen", () => {
    expect(Math.abs(goku.bodyH * goku.scale - SHEETS.captain.bodyH * SHEETS.captain.scale)).toBeLessThan(2);
  });

  it("the kamehameha leaves from his hands, out in front of him", () => {
    const [x] = boltOrigin(goku, "right", 100, 50);
    expect(x).toBeGreaterThan(105);
  });
});

describe("thor sheet", () => {
  const thor = SHEETS.thor;

  it("every row fits inside the image", () => {
    const strips = [thor.idle, thor.walk, thor.cast!, thor.carryIdle!, thor.carryWalk!].flatMap((s) => Object.values(s));
    for (const s of [...strips, thor.stun!, thor.death!]) {
      expect((s.row + 1) * thor.frameH).toBeLessThanOrEqual(thor.height);
      expect(s.frames * thor.frameW).toBeLessThanOrEqual(thor.width);
    }
  });

  it("stands about as tall as the captain on screen", () => {
    const tall = (s: typeof thor | typeof SHEETS.captain) => s.bodyH * s.scale;
    expect(Math.abs(tall(thor) - tall(SHEETS.captain))).toBeLessThan(2);
  });

  it("the bolt leaves from the hammer's head, on whichever side he faces", () => {
    const s = thor.scale;
    const [rx, ry] = boltOrigin(thor, "right", 100, 50);
    expect(rx).toBeCloseTo(100 + thor.muzzle!.side[0] * s);
    expect(ry).toBeCloseTo(50 + 6 + thor.muzzle!.side[1] * s);
    expect(rx).toBeGreaterThan(100 + 5); // out in front of him
    const [lx, ly] = boltOrigin(thor, "left", 100, 50);
    expect(lx).toBeCloseTo(200 - rx);
    expect(ly).toBeCloseTo(ry);
    expect(boltOrigin(thor, "down", 100, 50)[1]).toBeCloseTo(56 + thor.muzzle!.down[1] * s);
    expect(boltOrigin(thor, "up", 100, 50)[1]).toBeLessThan(50);
  });

  it("characters without a muzzle send it from just in front of their tile's center", () => {
    expect(boltOrigin(SHEETS.captain, "right", 100, 50)).toEqual([106, 50]);
    expect(boltOrigin(undefined, "up", 100, 50)).toEqual([100, 44]);
  });

  it("the cast thrusts the hammer forward when the bolt shows", () => {
    expect(thor.cast!.down.frames * CAST_TICKS_PER_FRAME).toBeGreaterThan(BEAM_DELAY);
  });
});

describe("captain sheet and shield", () => {
  const captain = SHEETS.captain;
  const brace = captain.cast!;
  const frame = (facing: "up" | "down" | "left" | "right", shielding: number) =>
    playerFrame(captain, { facing, moving: false, carrying: false, shielding, tick: 0 });

  it("every row fits inside the image", () => {
    const strips = [captain.idle, captain.walk, captain.cast!, captain.carryIdle!, captain.carryWalk!].flatMap((s) => Object.values(s));
    for (const s of [...strips, captain.stun!, captain.death!, captain.lobby!]) {
      expect((s.row + 1) * captain.frameH).toBeLessThanOrEqual(captain.height);
      expect(s.frames * captain.frameW).toBeLessThanOrEqual(captain.width);
    }
  });

  it("stands taller than the compact Pikachu on screen", () => {
    const tall = (s: typeof captain | typeof SHEETS.pikachu) => s.bodyH * s.scale;
    expect(tall(captain)).toBeGreaterThan(tall(SHEETS.pikachu));
  });

  it("raises the shield with the brace row and holds its last frame while the shield is up", () => {
    expect(frame("down", 0)).toMatchObject({ x: 0, y: brace.down.row * captain.frameH });
    expect(frame("left", 0)).toMatchObject({ y: brace.side.row * captain.frameH, flip: true });
    const held = frame("down", SHIELD_TICKS - 1);
    expect(held).toMatchObject({ x: (brace.down.frames - 1) * captain.frameW, y: brace.down.row * captain.frameH });
  });

  it("the spiral of light loops at its own pace while the shield is up", () => {
    expect(spiralFrame(0)).toBe(0);
    expect(spiralFrame(SPIRAL.ticksPerFrame)).toBe(1);
    expect(spiralFrame(SPIRAL.frames * SPIRAL.ticksPerFrame)).toBe(0);
    expect(SPIRAL.ticksPerFrame * SPIRAL.fps).toBe(TICK_RATE);
  });

  it("the spiral sheet holds a row behind him and a row in front", () => {
    expect(SPIRAL.frames * SPIRAL.frameW).toBeLessThanOrEqual(SPIRAL.width);
    expect(Math.max(SPIRAL.rows.behind, SPIRAL.rows.front) + 1).toBe(SPIRAL.height / SPIRAL.frameH);
  });
});

describe("pikachu sheet", () => {
  const pikachu = SHEETS.pikachu;

  it("every row fits inside the image", () => {
    const strips = [pikachu.idle, pikachu.walk, pikachu.cast!, pikachu.carryIdle!, pikachu.carryWalk!].flatMap((s) => Object.values(s));
    for (const s of [...strips, pikachu.stun!, pikachu.death!, pikachu.lobby!]) {
      expect((s.row + 1) * pikachu.frameH).toBeLessThanOrEqual(pikachu.height);
      expect(s.frames * pikachu.frameW).toBeLessThanOrEqual(pikachu.width);
    }
  });

  it("keeps the approved Pikachu smaller than the captain on screen", () => {
    const relativeHeight = pikachu.bodyH * pikachu.scale / (SHEETS.captain.bodyH * SHEETS.captain.scale);
    expect(relativeHeight).toBeGreaterThan(0.8);
    expect(relativeHeight).toBeLessThan(0.95);
  });

  it("only his blue scarf takes the player's color", () => {
    expect(pikachu.hues).toEqual([205, 240]);
    expect(pikachu.hueBase).toEqual([34, 82, 149]);
  });
});

describe("spider sheet", () => {
  const spider = SHEETS.spider;

  it("every row fits inside the image", () => {
    const strips = [spider.idle, spider.walk, spider.cast!, spider.carryIdle!, spider.carryWalk!].flatMap((s) => Object.values(s));
    for (const s of [...strips, spider.stun!, spider.death!]) {
      expect((s.row + 1) * spider.frameH).toBeLessThanOrEqual(spider.height);
      expect(s.frames * spider.frameW).toBeLessThanOrEqual(spider.width);
    }
  });

  it("stands about as tall as the captain on screen", () => {
    expect(Math.abs(spider.bodyH * spider.scale - SHEETS.captain.bodyH * SHEETS.captain.scale)).toBeLessThan(2);
  });

  it("the web leaves from his thrust hand, out in front of him, on whichever side he faces", () => {
    const [rx] = boltOrigin(spider, "right", 100, 50);
    const [lx] = boltOrigin(spider, "left", 100, 50);
    expect(rx).toBeGreaterThan(104);
    expect(lx).toBeLessThan(96);
  });
});

describe("lobby showpieces", () => {
  const size = (url: string) => {
    const png = readFileSync(new URL(`../public/${url}`, import.meta.url));
    return [png.readUInt32BE(16), png.readUInt32BE(20)];
  };
  /**
   * A 16-frame lobby (scripts/build-<name>-lobby.py) in its own one-row image (build-lobby-image.py) that matches its
   * PNG, the arena's sheet left at its nine columns.
   */
  const showpiece = (name: "goku" | "naruto" | "spider" | "thor") => {
    const sheet: SheetLayout = SHEETS[name];
    const image = sheet.lobby!.image!;
    expect(sheet.lobby).toMatchObject({ row: 0, frames: name === "goku" ? 60 : 16 });
    expect(size(image.url)).toEqual([image.width, image.height]);
    expect([image.frameW * (name === "goku" ? 60 : 16), image.frameH]).toEqual([image.width, image.height]);
    expect(size(sheet.url)).toEqual([sheet.width, sheet.height]);
    expect([sheet.frameW * 9, sheet.frameH * 18]).toEqual([sheet.width, sheet.height]);
  };

  it("goku powers up into a Super Saiyan", () => showpiece("goku"));
  it("naruto uses the supplied eight-frame celebration", () => {
    expect(SHEETS.naruto.lobby).toEqual({ row: 17, frames: 8 });
    expect(size(SHEETS.naruto.url)).toEqual([864, 2304]);
    expect(SHEETS.naruto.frameW).toBe(96);
    expect(SHEETS.naruto.frameH).toBe(128);
  });
  it("spider-man uses eight articulated presentation poses from the gameplay atlas", () => {
    expect(SHEETS.spider.lobby).toEqual({ row: 17, frames: 8, bodyH: 122 });
    expect(size(SHEETS.spider.url)).toEqual([1170, 2898]);
    expect([SHEETS.spider.frameW * 9, SHEETS.spider.frameH * 18]).toEqual([1170, 2898]);
  });
  it("thor calls lightning down onto his hammer and slams it into the ground", () => showpiece("thor"));
});

describe("sneakAlpha", () => {
  it("shows a player who is not sneaking", () => {
    expect(sneakAlpha({ id: "p1", sneak: 0 }, "p2")).toBe(1);
  });

  it("hides a sneaking panther from his rivals", () => {
    expect(sneakAlpha({ id: "p1", sneak: SNEAK_TICKS - 30 }, "p2")).toBe(0);
  });

  it("shows him faint to himself and to a screen that only watches", () => {
    const faint = sneakAlpha({ id: "p1", sneak: SNEAK_TICKS - 30 }, "p1");
    expect(faint).toBeGreaterThan(0);
    expect(faint).toBeLessThan(0.6);
    expect(sneakAlpha({ id: "p1", sneak: SNEAK_TICKS - 30 }, null)).toBe(faint);
  });

  it("fades back in for everyone over his last half second", () => {
    const rival = [30, 20, 10, 1].map((left) => sneakAlpha({ id: "p1", sneak: left }, "p2"));
    expect(rival[0]).toBe(0);
    for (let i = 1; i < rival.length; i++) expect(rival[i]).toBeGreaterThan(rival[i - 1]!);
    expect(rival[3]).toBeLessThan(1);
  });
});

describe("optimus's truck", () => {
  it("his cast runs while he turns into the truck, and on from TRUCK_SHIFT as he turns back where it stopped", async () => {
    const { castTicks } = await import("../src/render/sprites");
    const { TRUCK_SHIFT, TRUCK_TICKS } = await import("@bombtop/shared");
    expect(castTicks({ charge: 0, rasengan: 0, truck: TRUCK_SHIFT + TRUCK_TICKS }, undefined)).toBe(0);
    expect(castTicks({ charge: 0, rasengan: 0, truck: TRUCK_TICKS + 1 }, undefined)).toBe(TRUCK_SHIFT - 1);
    expect(castTicks({ charge: 0, rasengan: 0, truck: 0 }, { kind: "truck", ttl: BLAST_TICKS })).toBe(TRUCK_SHIFT);
  });

  it("is drawn only while he drives: from the side (flipped going left), its front coming down, its back going up", async () => {
    const { truckLook } = await import("../src/render/sprites");
    const { TRUCK_TICKS } = await import("@bombtop/shared");
    expect(truckLook({ truck: 0, facing: "right" }, 0)).toBeNull();
    expect(truckLook({ truck: TRUCK_TICKS + 1, facing: "right" }, 0)).toBeNull(); // still turning into it
    expect(truckLook({ truck: TRUCK_TICKS, facing: "right" }, 0)).toMatchObject({ view: "side", flip: false });
    expect(truckLook({ truck: 5, facing: "left" }, 0)).toMatchObject({ view: "side", flip: true });
    expect(truckLook({ truck: 5, facing: "down" }, 0)).toMatchObject({ view: "down", flip: false });
    expect(truckLook({ truck: 5, facing: "up" }, 0)).toMatchObject({ view: "up", flip: false });
    const { TRUCK } = await import("../src/render/sprites");
    const frames = new Set(Array.from({ length: 24 }, (_, t) => truckLook({ truck: 5, facing: "right" }, t)!.frame));
    expect(frames).toEqual(new Set(Array.from({ length: TRUCK.frames }, (_, f) => f))); // its wheels turning, its cab rocking
  });
});

describe("pelé's ball", () => {
  it("flies from his feet to where it stopped in a few ticks, spinning and bouncing, then drops back off it and fades", async () => {
    const { ballLook } = await import("../src/render/sprites");
    const start = ballLook(0, 0, 112, 0, 7, 0)!;
    expect(start.x).toBeCloseTo(0);
    const mid = ballLook(0, 0, 112, 0, 7, 5)!;
    expect(mid.x).toBeGreaterThan(0);
    expect(mid.x).toBeLessThan(112);
    const arrived = ballLook(0, 0, 112, 0, 7, 12)!;
    expect(arrived.x).toBeLessThanOrEqual(112);
    expect(arrived.x).toBeGreaterThan(100);
    expect(ballLook(0, 0, 112, 0, 7, 3)!.spin).not.toBe(ballLook(0, 0, 112, 0, 7, 4)!.spin);
    expect(ballLook(0, 0, 112, 0, 7, 30)!.alpha).toBeLessThan(1);
    expect(ballLook(0, 0, 112, 0, 7, BLAST_TICKS)).toBeNull();
    expect(ballLook(0, 0, 112, 0, 7, 4)!.lift).toBeGreaterThan(0); // in the air on its way
  });
});
