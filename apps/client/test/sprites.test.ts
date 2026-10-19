import { describe, expect, it } from "vitest";
import { BLAST_TICKS, FLAME_TICKS, FREEZE_TICKS, FUSE_TICKS, ItemKind, TICK_RATE, Tile } from "@bombtop/shared";
import { BEAM_DELAY, BOMBS, ITEMS, TILES, castsShadow, tileCell, itemCell, itemFrame, CAST_TICKS_PER_FRAME, FLAMES, MASCOT, flameFrame, flamePiece, beamAlpha, frozenLook, MotionTracker, SHEETS, bombFrame, bombLook, deathFrame, mascotDeath, mascotPose, paintHues, playerFrame, recolor, shadeHues } from "../src/render/sprites";

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

  it("walks with 4 frames in each direction (like the bomb), mirroring east for west", () => {
    const xs = new Set<number>();
    for (let tick = 0; tick < 120; tick++) xs.add(at("up", { moving: true, tick }).x);
    expect(xs.size).toBe(4);
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

  it("breathes faster and flashes red in its last second", () => {
    expect(flips(30)).toBeGreaterThan(flips(FUSE_TICKS));
    const calm = Array.from({ length: 60 }, (_, t) => look(FUSE_TICKS, t).tint);
    expect(new Set(calm)).toEqual(new Set([0xffffff]));
    const late = Array.from({ length: 60 }, (_, t) => look(30, t).tint);
    expect(new Set(late).size).toBe(2);
  });

  it("keeps breathing while a remote bomb waits with its fuse on hold", () => {
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

  it("frozen players turn icy, and the ice flickers in its last second", () => {
    expect(frozenLook(0, 0)).toBeNull();
    const solid = Array.from({ length: 30 }, (_, t) => frozenLook(FREEZE_TICKS, t)!);
    expect(new Set(solid.map((l) => l.block))).toEqual(new Set([true]));
    expect(solid[0]!.tint).not.toBe(0xffffff);
    const melting = Array.from({ length: 30 }, (_, t) => frozenLook(30, t)!.block);
    expect(new Set(melting)).toEqual(new Set([true, false]));
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

  it("fits every strip inside the image", () => {
    const strips = [...Object.values(sheet.idle), ...Object.values(sheet.walk), sheet.stun, sheet.death];
    for (const s of strips) {
      expect((s.row + 1) * sheet.frameH).toBeLessThanOrEqual(sheet.height);
      expect(s.frames * sheet.frameW).toBeLessThanOrEqual(sheet.width);
    }
  });

  it("walks through 4 steps per view, mirroring right for left", () => {
    const cols = new Set(Array.from({ length: 64 }, (_, tick) => playerFrame(sheet, { facing: "down", moving: true, carrying: false, tick }).x));
    expect(cols.size).toBe(4);
    expect(playerFrame(sheet, { facing: "left", moving: true, carrying: false, tick: 0 }).flip).toBe(true);
    expect(playerFrame(sheet, { facing: "up", moving: true, carrying: false, tick: 0 }).y).toBe(sheet.walk.up.row * sheet.frameH);
  });

  it("repaints the violet body in the player's color, by hue", () => {
    expect(sheet.hues).toEqual([225, 285]);
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
    expect(BOMBS.size * BOMBS.scale).toBeCloseTo(32 * 0.55);
    expect(ITEMS.size * ITEMS.scale).toBeCloseTo(48 * 0.29);
    expect(SHEETS.bomber.frameW * SHEETS.bomber.scale).toBeCloseTo(32 * 0.7);
    expect(SHEETS.ninja.frameW * SHEETS.ninja.scale).toBe(SHEETS.bomber.frameW * SHEETS.bomber.scale); // same build, same size
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
