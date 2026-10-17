import { describe, expect, it } from "vitest";
import { AIR_TICKS_PER_TILE, bombAt, FLAME_TICKS, FUSE_TICKS, ItemKind, placePlayerAt, step } from "../src";
import { emptyMatch, hold, player, press, run } from "./helpers";

const FLIGHT = AIR_TICKS_PER_TILE * 3 + 2;

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
    press(s, "bomb");
    press(s, "bomb");
    const b = s.bombs[0]!;
    expect(b.heldBy).toBe("p1");
    expect(bombAt(s, 3, 5)).toBeUndefined();
  });

  it("without the glove the second press does nothing", () => {
    const s = gloveMatch();
    player(s).canGlove = false;
    press(s, "bomb");
    press(s, "bomb");
    expect(s.bombs[0]!.heldBy).toBeNull();
  });

  it("a held bomb follows its holder and its fuse pauses", () => {
    const s = gloveMatch();
    press(s, "bomb");
    press(s, "bomb");
    const b = s.bombs[0]!;
    const fuse = b.fuse;
    hold(s, "down", 32); // 2 tiles at base speed
    expect([b.x, b.y]).toEqual([3, 7]);
    expect(b.fuse).toBe(fuse);
  });

  it("pressing bomb again throws it three tiles in the facing direction", () => {
    const s = gloveMatch();
    press(s, "bomb");
    press(s, "bomb");
    press(s, "bomb", "p1", "right");
    const b = s.bombs[0]!;
    expect(b.heldBy).toBeNull();
    run(s, FLIGHT);
    expect(b.air).toBeNull();
    expect([b.x, b.y]).toEqual([6, 5]);
  });

  it("holding a bomb does not place new ones", () => {
    const s = gloveMatch();
    player(s).bombCapacity = 3;
    press(s, "bomb");
    press(s, "bomb");
    hold(s, "right", 20);
    press(s, "bomb");
    expect(s.bombs).toHaveLength(1);
  });

  it("drops the bomb if the holder dies, resuming the fuse", () => {
    const s = gloveMatch();
    press(s, "bomb");
    press(s, "bomb");
    s.flames.push({ x: 3, y: 5, ttl: FLAME_TICKS });
    step(s);
    const b = s.bombs[0]!;
    expect(player(s).alive).toBe(false);
    expect(b.heldBy).toBeNull();
    expect(bombAt(s, 3, 5)).toBe(b);
    run(s, FUSE_TICKS);
    expect(s.bombs).toHaveLength(0);
  });
});
