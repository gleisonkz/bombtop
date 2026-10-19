import { describe, expect, it } from "vitest";
import { createMatch, FUSE_TICKS, publicView, type Bomb, type PublicView } from "@bombtop/shared";
import { aheadOf, MAX_AHEAD } from "../src/net/world-ahead";

function view(): PublicView {
  return publicView(createMatch({ seed: 1, playerIds: ["a", "b"], blockDensity: 0 }));
}

const bomb = (fuse: number): Bomb => ({
  ownerId: "a", x: 3, y: 1, fuse, range: 2, type: "normal", slide: null, offset: 0, air: null, heldBy: null,
});

describe("aheadOf", () => {
  it("is the snapshot itself with no lead", () => {
    const v = view();
    v.bombs.push(bomb(5));
    expect(aheadOf(v, 0)).toEqual(v);
  });

  it("runs bombs forward: one about to blow is already flames", () => {
    const v = view();
    v.bombs.push(bomb(5));
    const later = aheadOf(v, 8);
    expect(later.bombs).toEqual([]);
    expect(later.flames.length).toBeGreaterThan(0);
    expect(later.tick).toBe(v.tick + 8);
  });

  it("leaves the snapshot untouched", () => {
    const v = view();
    v.bombs.push(bomb(5));
    const before = structuredClone(v);
    aheadOf(v, 8);
    expect(v).toEqual(before);
  });

  it("does not run further than MAX_AHEAD ticks", () => {
    const v = view();
    v.bombs.push(bomb(FUSE_TICKS));
    expect(aheadOf(v, 10_000).tick).toBe(v.tick + MAX_AHEAD);
  });
});
