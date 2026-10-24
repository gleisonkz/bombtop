import { describe, expect, it } from "vitest";
import { AIR_TICKS_PER_TILE, bombAt, FLAME_TICKS, FUSE_TICKS, ItemKind, placePlayerAt, playerTile, step, type Direction } from "../src";
import { emptyMatch, player, press, run } from "./helpers";

const FLIGHT = AIR_TICKS_PER_TILE * 3 + 2;

/** Keeps the bomb button down for `ticks` ticks, walking `dir`. */
function carry(s: ReturnType<typeof emptyMatch>, ticks: number, dir: Direction = null) {
  run(s, ticks, { p1: { dir, bomb: false, hold: true } });
}

/** Places a bomb, then presses again on it and keeps the button down. */
function lift(s: ReturnType<typeof emptyMatch>) {
  press(s, "bomb");
  step(s, { p1: { dir: null, bomb: true, hold: true } });
}

function gloveMatch() {
  const s = emptyMatch();
  player(s).canGlove = true;
  placePlayerAt(s, "p1", 3, 5);
  return s;
}

describe("glove", () => {
  it("the glove item grants the ability", () => {
    const s = emptyMatch();
    s.items.push({ x: 1, y: 1, kind: ItemKind.Glove });
    step(s);
    expect(player(s).canGlove).toBe(true);
  });

  it("pressing bomb on your own bomb lifts it", () => {
    const s = gloveMatch();
    lift(s);
    const b = s.bombs[0]!;
    expect(b.heldBy).toBe("p1");
    expect(bombAt(s, 3, 5)).toBeUndefined();
  });

  it("keeps carrying it while the button stays down", () => {
    const s = gloveMatch();
    lift(s);
    carry(s, 60);
    expect(s.bombs[0]!.heldBy).toBe("p1");
  });

  it("a carried bomb's fuse waits while it is held, as in Super Bomberman: it never goes off in the hands", () => {
    const s = gloveMatch();
    lift(s);
    const fuse = s.bombs[0]!.fuse;
    carry(s, FUSE_TICKS + 30);
    expect(s.bombs[0]!.heldBy).toBe("p1");
    expect(s.bombs[0]!.fuse).toBe(fuse);
    expect(player(s).alive).toBe(true);
  });

  it("letting go of the button throws it three tiles in the facing direction", () => {
    const s = gloveMatch();
    lift(s);
    carry(s, 10, "right");
    const from = playerTile(player(s));
    step(s, { p1: { dir: null, bomb: false } });
    const b = s.bombs[0]!;
    expect(b.heldBy).toBeNull();
    run(s, FLIGHT);
    expect(b.air).toBeNull();
    expect([b.x, b.y]).toEqual([from.x + 3, 5]);
  });

  it("a quick double tap lifts the bomb and throws it right away", () => {
    const s = gloveMatch();
    press(s, "bomb");
    press(s, "bomb"); // pressed and released before the tick
    step(s, { p1: { dir: null, bomb: false } });
    expect(s.bombs[0]!.heldBy).toBeNull();
    expect(s.bombs[0]!.air).not.toBeNull();
  });

  it("without the glove the second press does nothing", () => {
    const s = gloveMatch();
    player(s).canGlove = false;
    press(s, "bomb");
    press(s, "bomb");
    expect(s.bombs[0]!.heldBy).toBeNull();
  });

  it("a held bomb follows its holder, its fuse waiting", () => {
    const s = gloveMatch();
    lift(s);
    const b = s.bombs[0]!;
    const fuse = b.fuse;
    carry(s, 32, "down"); // 2 tiles at base speed
    expect([b.x, b.y]).toEqual([3, 7]);
    expect(b.fuse).toBe(fuse);
  });

  it("holding a bomb does not place new ones", () => {
    const s = gloveMatch();
    player(s).bombCapacity = 3;
    lift(s);
    carry(s, 20, "right");
    step(s, { p1: { dir: null, bomb: true, hold: true } });
    expect(s.bombs).toHaveLength(1);
  });

  it("drops the bomb if the holder dies, resuming the fuse", () => {
    const s = gloveMatch();
    lift(s);
    s.flames.push({ x: 3, y: 5, ttl: FLAME_TICKS });
    step(s, { p1: { dir: null, bomb: false, hold: true } });
    const b = s.bombs[0]!;
    expect(player(s).alive).toBe(false);
    expect(b.heldBy).toBeNull();
    expect(bombAt(s, 3, 5)).toBe(b);
    run(s, FUSE_TICKS);
    expect(s.bombs).toHaveLength(0);
  });
});
