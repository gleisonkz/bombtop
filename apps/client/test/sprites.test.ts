import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BLAST_TICKS, FLAME_TICKS, FREEZE_TICKS, FUSE_TICKS, WEB_TICKS, ItemKind, KAME_CHARGE, RASENGAN_TICKS, SHIELD_TICKS, TICK_RATE, TILE, Tile } from "@bombtop/shared";
import { BEAM_DELAY, rasenganLook, RASENGAN, kameSegments, castTicks, outsideBeams, boltOrigin, boltPoints, magnetWaves, speedLines, tunnelMounds, SPIRAL, spiralFrame, BOMBS, ITEMS, TILES, burnCell, castsShadow, tileCell, itemCell, itemFrame, CAST_TICKS_PER_FRAME, FLAMES, MASCOT, flameFrame, flamePiece, beamAlpha, frozenLook, iceBlock, webbedLook, cocoon, MotionTracker, between, SHEETS, bombFrame, bombLook, MEGA_SCALE, deathFrame, mascotDeath, mascotPose, paintHues, paintSheet, playerFrame, recolor, shadeHues } from "../src/render/sprites";

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
    const carry = (moving: boolean) => playerFrame(ninja, { facing: "down", moving, carrying: true, tick: 0 }).y;
    expect(carry(false)).toBe(ninja.carryIdle!.down.row * ninja.frameH);
    expect(carry(true)).toBe(ninja.carryWalk!.down.row * ninja.frameH);
  });

  it("every row fits inside the image", () => {
    const strips = [ninja.idle, ninja.walk, ninja.cast!, ninja.carryIdle!, ninja.carryWalk!].flatMap((s) => Object.values(s));
    for (const s of [...strips, ninja.stun!, ninja.death!, ninja.lobby!]) {
      expect((s.row + 1) * ninja.frameH).toBeLessThanOrEqual(ninja.height);
      expect(s.frames * ninja.frameW).toBeLessThanOrEqual(ninja.width);
    }
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

  it("draws the bomb mascot's mega bomb bigger", () => {
    const mega = bombLook({ fuse: FUSE_TICKS, tick: 5, type: "pierce", mega: true });
    const plain = look(FUSE_TICKS, 5, "pierce");
    expect(mega.sx / plain.sx).toBeCloseTo(MEGA_SCALE);
    expect(mega.sy / plain.sy).toBeCloseTo(MEGA_SCALE);
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

describe("ice blast visuals", () => {
  const ninja = SHEETS.ninja;
  const cast = ninja.cast!;
  const frame = (facing: "up" | "down" | "left" | "right", casting: number) =>
    playerFrame(ninja, { facing, moving: true, carrying: false, casting, tick: 0 });

  it("plays the cast row for the facing direction, mirroring east for west", () => {
    expect(frame("down", 0).y).toBe(cast.down.row * ninja.frameH);
    expect(frame("up", 0).y).toBe(cast.up.row * ninja.frameH);
    expect(frame("left", 0)).toMatchObject({ y: cast.side.row * ninja.frameH, flip: true });
    const last = frame("down", cast.down.frames * CAST_TICKS_PER_FRAME - 1);
    expect(last.x).toBe((cast.down.frames - 1) * ninja.frameW);
    expect(last.x + ninja.frameW).toBeLessThanOrEqual(ninja.width);
  });

  it("goes back to walking once the cast is over", () => {
    const after = frame("down", cast.down.frames * CAST_TICKS_PER_FRAME);
    expect(after.y).toBe(ninja.walk.down.row * ninja.frameH);
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

  it("frozen players turn icy, and the ice flickers in its last second", () => {
    expect(frozenLook(0, 0)).toBeNull();
    const solid = Array.from({ length: 30 }, (_, t) => frozenLook(FREEZE_TICKS, t)!);
    expect(new Set(solid.map((l) => l.block))).toEqual(new Set([true]));
    expect(solid[0]!.tint).not.toBe(0xffffff);
    const melting = Array.from({ length: 30 }, (_, t) => frozenLook(30, t)!.block);
    expect(new Set(melting)).toEqual(new Set([true, false]));
  });

  it("the ice block hugs the body: from just over the head to just under the feet", () => {
    const body = 21;
    const b = iceBlock(100, 50, body);
    const feet = 50 + 6;
    expect(b.y).toBeGreaterThanOrEqual(feet - body - 3);
    expect(b.y).toBeLessThan(feet - body);
    expect(b.y + b.h).toBeGreaterThan(feet);
    expect(b.y + b.h).toBeLessThanOrEqual(feet + 3);
    expect(b.x + b.w / 2).toBe(100);
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

  it("repaints his violet armor in the player's color, by hue", () => {
    expect(sheet.hues).toEqual([250, 290]);
    expect(sheet.keepFor).toEqual([[245, 245, 245]]); // white would bleach his armor into his steel
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
    expect(FLAMES.size * FLAMES.scale).toBe(16);
    expect(BOMBS.size * BOMBS.scale).toBeCloseTo(128 * 0.1);
    expect(ITEMS.size * ITEMS.scale).toBeCloseTo(48 * 0.29);
    expect(SHEETS.bomber.bodyH * SHEETS.bomber.scale).toBeCloseTo(SHEETS.goku.bodyH * SHEETS.goku.scale, 0); // as tall as Goku
    expect(SHEETS.ninja.bodyH * SHEETS.ninja.scale).toBeCloseTo(SHEETS.goku.bodyH * SHEETS.goku.scale, 0); // as tall as Goku
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
    expect(rasenganLook(0, { ttl: BLAST_TICKS, kind: "ice" })).toBeNull();
    expect(rasenganLook(0, undefined)).toBeNull();
  });
});

describe("castTicks", () => {
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
    expect(castTicks(still, { ttl: BLAST_TICKS - 3, kind: "ice" })).toBe(3);
    expect(castTicks(still, undefined)).toBeUndefined();
  });
});

describe("kameSegments", () => {
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
    expect(outsideBeams(flames, [{ ...beam, kind: "ice" }])).toEqual(flames);
  });
});

describe("goku sheet", () => {
  const goku = SHEETS.goku;

  it("every row fits inside the image", () => {
    const strips = [goku.idle, goku.walk, goku.cast!, goku.carryIdle!, goku.carryWalk!].flatMap((s) => Object.values(s));
    for (const s of [...strips, goku.stun!, goku.death!, goku.lobby!]) {
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
    for (const s of [...strips, thor.stun!, thor.death!, thor.lobby!]) {
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

  it("stands about as tall as the ninja on screen", () => {
    const tall = (s: typeof captain | typeof SHEETS.ninja) => s.bodyH * s.scale;
    expect(Math.abs(tall(captain) - tall(SHEETS.ninja))).toBeLessThan(2);
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

  it("stands about as tall as the captain on screen", () => {
    expect(Math.abs(pikachu.bodyH * pikachu.scale - SHEETS.captain.bodyH * SHEETS.captain.scale)).toBeLessThan(2);
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
    for (const s of [...strips, spider.stun!, spider.death!, spider.lobby!]) {
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
