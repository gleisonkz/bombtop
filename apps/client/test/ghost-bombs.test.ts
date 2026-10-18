import { describe, expect, it } from "vitest";
import { createMatch, FUSE_TICKS, publicView, type Bomb, type PublicView } from "@bombtop/shared";
import { GhostBombs } from "../src/net/ghost-bombs";

function view(): PublicView {
  return publicView(createMatch({ seed: 1, playerIds: ["me", "them"], blockDensity: 0 }));
}
const real = (x: number, y: number): Bomb => ({
  ownerId: "me", x, y, fuse: FUSE_TICKS - 10, range: 1, type: "normal", slide: null, offset: 0, air: null, heldBy: null,
});

describe("GhostBombs", () => {
  it("shows our bomb right away, before the server has it", () => {
    const g = new GhostBombs("me");
    g.add(3, 1, 0);
    const drawn = g.apply(view(), 50);
    expect(drawn.bombs.map((b) => [b.ownerId, b.x, b.y])).toEqual([["me", 3, 1]]);
  });

  it("gives way to the real bomb once it arrives", () => {
    const g = new GhostBombs("me");
    g.add(3, 1, 0);
    const v = view();
    v.bombs.push(real(3, 1));
    expect(g.apply(v, 100).bombs).toEqual([real(3, 1)]);
    expect(g.apply(view(), 150).bombs).toEqual([]); // and does not come back
  });

  it("disappears if the server never placed it", () => {
    const g = new GhostBombs("me");
    g.add(3, 1, 0);
    expect(g.apply(view(), 2000).bombs).toEqual([]);
  });

  it("leaves the view it was given untouched", () => {
    const g = new GhostBombs("me");
    g.add(3, 1, 0);
    const v = view();
    g.apply(v, 10);
    expect(v.bombs).toEqual([]);
  });

  it("forgets everything on a new match", () => {
    const g = new GhostBombs("me");
    g.add(3, 1, 0);
    g.clear();
    expect(g.apply(view(), 10).bombs).toEqual([]);
  });
});
