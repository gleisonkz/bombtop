import { describe, expect, it } from "vitest";
import { createMatch, FUSE_TICKS, ItemKind, publicView, Tile, TILE, type Bomb, type PublicView } from "@bombtop/shared";
import { Listener, soundCues } from "../src/audio/cues";

function view(): PublicView {
  return publicView(createMatch({ seed: 1, playerIds: ["a", "b"], blockDensity: 0 }));
}

/** The same view two ticks later, edited by `change`. */
function later(prev: PublicView, change: (v: PublicView) => void): PublicView {
  const next = structuredClone(prev);
  next.tick += 2;
  change(next);
  return next;
}

const bomb = (x: number, y: number, extra: Partial<Bomb> = {}): Bomb => ({
  ownerId: "a", x, y, fuse: FUSE_TICKS, range: 1, type: "normal", slide: null, offset: 0, air: null, heldBy: null, ...extra,
});

const names = (prev: PublicView, next: PublicView) => soundCues(prev, next).map((c) => c.name);

describe("soundCues", () => {
  it("is silent when nothing happened", () => {
    const v = view();
    expect(soundCues(v, later(v, () => {}))).toEqual([]);
  });

  it("hears a bomb being placed, at its column", () => {
    const v = view();
    const next = later(v, (n) => n.bombs.push(bomb(3, 1, { fuse: FUSE_TICKS - 2 })));
    expect(soundCues(v, next)).toEqual([{ name: "place", x: 3.5 }]);
  });

  it("does not re-hear a waiting remote bomb", () => {
    const v = view();
    v.bombs.push(bomb(3, 1, { type: "remote" }));
    expect(names(v, later(v, () => {}))).toEqual([]);
  });

  it("hears one explosion per frame, louder with more flames", () => {
    const v = view();
    v.bombs.push(bomb(3, 1, { fuse: 1 }));
    const next = later(v, (n) => {
      n.bombs = [];
      n.flames = [{ x: 3, y: 1, ttl: 30 }, { x: 4, y: 1, ttl: 30 }, { x: 5, y: 1, ttl: 30 }];
    });
    expect(soundCues(v, next)).toEqual([{ name: "explode", x: 4.5, size: 3 }]);
  });

  it("hears blocks breaking and sudden-death walls landing", () => {
    const v = view();
    const i = (x: number, y: number) => y * v.grid.width + x;
    v.grid.tiles[i(3, 1)] = Tile.Block;
    const next = later(v, (n) => {
      n.grid.tiles[i(3, 1)] = Tile.Empty;
      n.grid.tiles[i(5, 1)] = Tile.Wall;
    });
    expect(names(v, next)).toEqual(["break", "wall"]);
  });

  it("hears kicks and punches by bombs starting to move", () => {
    const v = view();
    v.bombs.push(bomb(3, 1), bomb(5, 1));
    const next = later(v, (n) => {
      n.bombs[0]!.slide = "right";
      n.bombs[1]!.air = { dir: "down", tilesLeft: 3, progress: 0 };
    });
    expect(names(v, next)).toEqual(["kick", "throw"]);
  });

  it("hears items picked up, but not items burned", () => {
    const v = view();
    v.items.push({ x: 3, y: 1, kind: ItemKind.Fire }, { x: 5, y: 1, kind: ItemKind.Bomb });
    const next = later(v, (n) => {
      n.items = [];
      n.flames = [{ x: 5, y: 1, ttl: 30 }];
    });
    expect(names(v, next)).toEqual(["explode", "pickup"]);
  });

  it("leaves skulls to the curse cue", () => {
    const v = view();
    v.items.push({ x: 1, y: 2, kind: ItemKind.Skull });
    const next = later(v, (n) => {
      n.items = [];
      n.players[0]!.curse = { kind: "slow", ticks: 600 };
    });
    expect(names(v, next)).toEqual(["curse"]);
  });

  it("hears what happens to players", () => {
    const v = view();
    v.players[1]!.mount = "hopper";
    const next = later(v, (n) => {
      const [a, b] = n.players;
      a!.alive = false;
      b!.mount = null;
      b!.stun = 60;
    });
    expect(soundCues(v, next)).toEqual([
      { name: "death", x: v.players[0]!.px / TILE },
      { name: "stun", x: v.players[1]!.px / TILE },
      { name: "dismount", x: v.players[1]!.px / TILE },
    ]);
  });

  it("hears mounting, jumps, dashes and warps", () => {
    const v = view();
    v.players[1]!.mount = "dasher";
    const next = later(v, (n) => {
      const [a, b] = n.players;
      a!.mount = "hopper";
      a!.jumpTicks = 16;
      a!.warpLock = true;
      b!.dashTicks = 16;
    });
    expect(names(v, next)).toEqual(["mount", "jump", "warp", "dash"]);
  });

  it("hears sudden death starting", () => {
    const v = view();
    expect(names(v, later(v, (n) => (n.pressure = 1)))).toEqual(["hurry"]);
  });
});

describe("Listener", () => {
  it("hears each change once, as the drawn view moves forward", () => {
    const l = new Listener();
    const v = view();
    const next = later(v, (n) => n.bombs.push(bomb(3, 1)));
    expect(l.hear(v)).toEqual([]);
    expect(l.hear(next).map((c) => c.name)).toEqual(["place"]);
    expect(l.hear(next)).toEqual([]);
  });

  it("starts over, silently, when a new match begins", () => {
    const l = new Listener();
    const v = view();
    v.tick = 500;
    l.hear(v);
    const fresh = view();
    fresh.bombs.push(bomb(3, 1));
    expect(l.hear(fresh)).toEqual([]);
  });
});
