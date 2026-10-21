import { describe, expect, it } from "vitest";
import { createMatch, FUSE_TICKS, publicView, TILE, type Bomb, type Player, type PublicView } from "@bombtop/shared";
import { actionCues, EchoFilter } from "../src/audio/local-cues";

function view(): PublicView {
  return publicView(createMatch({ seed: 1, playerIds: ["me", "them"], blockDensity: 0 }));
}
const me = (v: PublicView): Player => structuredClone(v.players[0]!);
const bomb = (x: number, y: number, extra: Partial<Bomb> = {}): Bomb => ({
  ownerId: "me", x, y, fuse: FUSE_TICKS, range: 1, type: "normal", slide: null, offset: 0, air: null, heldBy: null, ...extra,
});

describe("actionCues", () => {
  it("hears our own bomb the moment the button is pressed", () => {
    const v = view();
    expect(actionCues(v, me(v), { dir: null, bomb: true })).toEqual([{ name: "place", x: 1.5 }]);
  });

  it("stays quiet when the bomb could not be placed", () => {
    const v = view();
    v.bombs.push(bomb(1, 1));
    expect(actionCues(v, me(v), { dir: null, bomb: true })).toEqual([]);
  });

  it("uses the predicted position, not the server's", () => {
    const v = view();
    const p = me(v);
    p.px = 3 * TILE + TILE / 2;
    expect(actionCues(v, p, { dir: null, bomb: true })).toEqual([{ name: "place", x: 3.5 }]);
  });

  it("hears mount abilities and punches", () => {
    const v = view();
    const p = me(v);
    p.mount = "hopper";
    expect(actionCues(v, p, { dir: null, bomb: false, action: true }).map((c) => c.name)).toEqual(["jump"]);

    const w = view();
    const q = me(w);
    q.canPunch = true;
    q.facing = "right";
    w.bombs.push(bomb(2, 1));
    expect(actionCues(w, q, { dir: null, bomb: false, action: true }).map((c) => c.name)).toEqual(["throw"]);
  });

  it("hears our own special shout the moment the button is pressed", () => {
    const v = view();
    const p = me(v);
    p.character = "captain";
    expect(actionCues(v, p, { dir: null, bomb: false, special: true }).map((c) => c.name)).toEqual(["captain-special"]);
  });

  it("does not touch the snapshot it was given", () => {
    const v = view();
    actionCues(v, me(v), { dir: null, bomb: true });
    expect(v.bombs).toEqual([]);
  });
});

describe("EchoFilter", () => {
  it("drops the server's copy of a sound we already played", () => {
    const f = new EchoFilter();
    f.played([{ name: "place", x: 1.5 }], 0);
    expect(f.filter([{ name: "place", x: 1.5 }, { name: "explode", x: 4, size: 2 }], 300)).toEqual([{ name: "explode", x: 4, size: 2 }]);
  });

  it("only swallows one echo per local sound, near where it happened", () => {
    const f = new EchoFilter();
    f.played([{ name: "place", x: 1.5 }], 0);
    expect(f.filter([{ name: "place", x: 9.5 }], 100)).toHaveLength(1); // someone else's bomb
    expect(f.filter([{ name: "place", x: 1.5 }], 200)).toHaveLength(0);
    expect(f.filter([{ name: "place", x: 1.5 }], 300)).toHaveLength(1);
  });

  it("forgets local sounds the server never confirmed", () => {
    const f = new EchoFilter();
    f.played([{ name: "place", x: 1.5 }], 0);
    expect(f.filter([{ name: "place", x: 1.5 }], 5000)).toHaveLength(1);
  });
});
