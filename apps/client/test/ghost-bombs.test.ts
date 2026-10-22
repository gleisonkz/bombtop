import { describe, expect, it } from "vitest";
import { createMatch, FUSE_TICKS, publicView, type Bomb, type PublicView, type Snapshot } from "@bombtop/shared";
import { actionCues } from "../src/audio/local-cues";
import { GhostBombs } from "../src/net/ghost-bombs";

function view(): PublicView {
  return publicView(createMatch({ seed: 1, playerIds: ["me", "them"], blockDensity: 0 }));
}
const real = (x: number, y: number): Bomb => ({
  ownerId: "me", x, y, fuse: FUSE_TICKS - 10, range: 1, type: "normal", slide: null, offset: 0, air: null, heldBy: null,
});

describe("GhostBombs", () => {
  it("does not predict one action sequence twice after the player moves", () => {
    const g = new GhostBombs("me");
    g.add(3, 1, 0, "normal", 8);
    g.add(4, 1, 10, "normal", 8);
    expect(g.apply(view(), 20).bombs).toMatchObject([{ x: 3, y: 1 }]);
  });

  it.each([
    { air: { dir: "right" as const, tilesLeft: 2, progress: 0 } },
    { heldBy: "them" },
  ])("allows placement below an airborne or carried authoritative bomb: %j", (extra) => {
    const g = new GhostBombs("me");
    g.add(3, 1, 0, "pierce", 8);
    const snap: Snapshot = { ...view(), bombs: [{ ...real(3, 1), ...extra }], acks: {} };
    g.reconcile(snap);
    expect(g.apply(snap, 20).bombs).toHaveLength(2);
  });

  it("reconciles authoritative occupancy even without an ack", () => {
    const g = new GhostBombs("me");
    g.add(3, 1, 0);
    g.reconcile({ ...view(), bombs: [real(3, 1)], acks: {} });
    expect(g.apply(view(), 20).bombs).toEqual([]);
  });

  it("does not duplicate a pending tile or restart its fuse", () => {
    const g = new GhostBombs("me");
    g.add(3, 1, 0, "pierce");
    g.add(3, 1, 400);
    expect(g.apply(view(), 500).bombs).toMatchObject([{ type: "pierce", fuse: FUSE_TICKS - 30 }]);
    expect(g.apply(view(), 1800).bombs).toEqual([]);
  });

  it("retires acknowledged placements immediately, retaining newer actions", () => {
    const g = new GhostBombs("me");
    g.add(3, 1, 0, "normal", 4);
    g.add(4, 1, 0, "pierce", 5);
    const snap: Snapshot = { ...view(), acks: { me: { seq: 4, ticks: 1 } } };
    g.reconcile(snap);
    expect(g.apply(snap, 20).bombs).toMatchObject([{ x: 4, type: "pierce" }]);
    snap.acks.me = { seq: 6, ticks: 1 };
    g.reconcile(snap);
    expect(g.apply(snap, 30).bombs).toEqual([]);
  });

  it("keeps unacknowledged and legacy predictions until confirmation or timeout", () => {
    const g = new GhostBombs("me");
    g.add(3, 1, 0, "normal", 5);
    g.add(4, 1, 0);
    g.reconcile({ ...view(), acks: { them: { seq: 10, ticks: 1 } } });
    expect(g.apply(view(), 10).bombs).toHaveLength(2);
    g.reconcile({ ...view(), acks: { me: { seq: 4, ticks: 1 } } });
    expect(g.apply(view(), 20).bombs).toHaveLength(2);
  });

  it("does not leave a ghost at the predicted tile after authoritative placement elsewhere", () => {
    const g = new GhostBombs("me");
    g.add(3, 1, 0, "normal", 7);
    const snap: Snapshot = { ...view(), bombs: [real(2, 1)], acks: { me: { seq: 7, ticks: 1 } } };
    g.reconcile(snap);
    expect(g.apply(snap, 20).bombs).toEqual(snap.bombs);
    expect(g.apply(view(), 30).bombs).toEqual([]);
  });

  it("gives way to another player's grounded bomb on the predicted tile", () => {
    const g = new GhostBombs("me");
    g.add(3, 1, 0);
    const v = view();
    v.bombs.push({ ...real(3, 1), ownerId: "them" });
    expect(g.apply(v, 10).bombs).toEqual(v.bombs);
    expect(g.apply(view(), 20).bombs).toEqual([]);
  });

  it("includes pending bombs in placement capacity checks without mutating the snapshot", () => {
    const g = new GhostBombs("me");
    const v = view();
    g.add(3, 1, 0);
    expect(actionCues(g.apply(v, 10), v.players[0]!, { dir: null, bomb: true })).toEqual([]);
    expect(v.bombs).toEqual([]);
  });

  it("keeps the selected pierce identity and advances the fuse before confirmation", () => {
    const g = new GhostBombs("me");
    g.add(3, 1, 0, "pierce");
    const [bomb] = g.apply(view(), 500).bombs;
    expect(bomb?.type).toBe("pierce");
    expect(bomb?.fuse).toBe(FUSE_TICKS - 30);
  });
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
