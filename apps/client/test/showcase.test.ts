import { describe, expect, it } from "vitest";
import { FUSE_TICKS, getTile, ItemKind, MAX_SPEED, Tile, type MatchState } from "@bombtop/shared";
import { SHOWCASE_VIEW, Showcase } from "../src/game/showcase";

/** Plays one loop of an item's scene, calling `watch` after every tick. */
function play(kind: ItemKind, watch: (s: MatchState, tick: number) => void = () => {}): Showcase {
  const show = new Showcase(kind);
  for (let t = 0; t < show.length; t++) {
    show.advance();
    watch(show.state, t);
  }
  return show;
}
const you = (s: MatchState) => s.players.find((p) => p.id === "you")!;
const rival = (s: MatchState) => s.players.find((p) => p.id === "rival")!;

describe("item showcase", () => {
  it("has a scene for every item, and the hero lives through each one", () => {
    for (const kind of Object.values(ItemKind)) {
      let alive = true;
      play(kind, (s) => (alive &&= you(s).alive));
      expect(alive, kind).toBe(true);
    }
  });

  it("keeps the action inside the window shown", () => {
    for (const kind of Object.values(ItemKind)) {
      play(kind, (s) => {
        for (const p of s.players) {
          const x = p.px / 256;
          const y = p.py / 256;
          expect(x >= SHOWCASE_VIEW.x && x <= SHOWCASE_VIEW.x + SHOWCASE_VIEW.width, kind).toBe(true);
          expect(y >= SHOWCASE_VIEW.y && y <= SHOWCASE_VIEW.y + SHOWCASE_VIEW.height, kind).toBe(true);
        }
      });
    }
  });

  it("extra bombs: several bombs down at once", () => {
    let most = 0;
    play(ItemKind.Bomb, (s) => (most = Math.max(most, s.bombs.length)));
    expect(most).toBeGreaterThanOrEqual(3);
  });

  it("fire and full fire: the blast reaches a far block", () => {
    for (const kind of [ItemKind.Fire, ItemKind.FullFire]) {
      const show = new Showcase(kind);
      const [x, y] = show.target!;
      expect(getTile(show.state, x, y), kind).toBe(Tile.Block);
      for (let t = 0; t < show.length; t++) show.advance();
      expect(getTile(show.state, x, y), kind).toBe(Tile.Empty);
    }
  });

  it("speed: the hero outruns the rival", () => {
    let ahead = false;
    play(ItemKind.Speed, (s, t) => {
      if (t === 60) ahead = you(s).px - rival(s).px > 256;
    });
    expect(ahead).toBe(true);
    expect(you(new Showcase(ItemKind.Speed).state).speed).toBe(MAX_SPEED);
  });

  it("kick: the bomb slides far from where it was dropped", () => {
    let far = 0;
    play(ItemKind.Kick, (s) => (far = Math.max(far, ...s.bombs.map((b) => b.x))));
    expect(far).toBeGreaterThanOrEqual(7);
  });

  it("remote: the bomb goes off before its fuse would", () => {
    const show = new Showcase(ItemKind.Remote);
    const [x, y] = show.target!;
    let blownAt = -1;
    for (let t = 0; t < show.length; t++) {
      show.advance();
      if (blownAt < 0 && getTile(show.state, x, y) === Tile.Empty) blownAt = t;
    }
    expect(blownAt).toBeGreaterThan(0);
    expect(blownAt).toBeLessThan(FUSE_TICKS);
  });

  it("pierce: one blast breaks a whole row of blocks", () => {
    const show = new Showcase(ItemKind.Pierce);
    const row = [4, 5, 6].map((x) => [x, 5] as const);
    expect(row.every(([x, y]) => getTile(show.state, x, y) === Tile.Block)).toBe(true);
    for (let t = 0; t < show.length; t++) show.advance();
    expect(row.every(([x, y]) => getTile(show.state, x, y) === Tile.Empty)).toBe(true);
  });

  it("punch: the bomb flies away", () => {
    let far = 0;
    play(ItemKind.Punch, (s) => (far = Math.max(far, ...s.bombs.map((b) => b.x))));
    expect(far).toBeGreaterThanOrEqual(5);
  });

  it("glove: the hero lifts a bomb and throws it", () => {
    let lifted = false;
    let far = 0;
    play(ItemKind.Glove, (s) => {
      lifted ||= s.bombs.some((b) => b.heldBy === "you");
      far = Math.max(far, ...s.bombs.filter((b) => !b.heldBy).map((b) => b.x));
    });
    expect(lifted).toBe(true);
    expect(far).toBeGreaterThanOrEqual(5);
  });

  it("skull: the curse passes to the rival", () => {
    let caught = false;
    play(ItemKind.Skull, (s) => (caught ||= !!rival(s).curse));
    expect(caught).toBe(true);
  });

  it("egg: the mount takes the hit", () => {
    const show = play(ItemKind.Egg);
    expect(you(new Showcase(ItemKind.Egg).state).mount).not.toBeNull();
    expect(you(show.state).mount).toBeNull();
    expect(you(show.state).alive).toBe(true);
  });

  it("loops: after the scene ends it starts over", () => {
    const show = new Showcase(ItemKind.Kick);
    const first = show.state;
    for (let t = 0; t <= show.length; t++) show.advance();
    expect(show.state).not.toBe(first);
  });
});
