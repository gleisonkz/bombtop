import { describe, expect, it } from "vitest";
import { createMatch, FUSE_TICKS, placePlayerAt, publicView, setTile, Tile, TICK_RATE, type Bomb, type Player, type PublicView } from "@bombtop/shared";
import { KickPrediction } from "../src/net/kick-prediction";

const MS_PER_TICK = 1000 / TICK_RATE;
const bomb = (x: number, y: number, more: Partial<Bomb> = {}): Bomb => ({
  ownerId: "them", x, y, fuse: FUSE_TICKS, range: 1, type: "normal", slide: null, offset: 0, air: null, heldBy: null, ...more,
});

/** Me at (3,5) able to kick, a bomb at (4,5), a block at (9,5). */
function scene(canKick = true): { view: PublicView; me: Player } {
  const s = createMatch({ seed: 1, playerIds: ["me", "them"], blockDensity: 0 });
  placePlayerAt(s, "me", 3, 5);
  setTile(s, 9, 5, Tile.Block);
  s.bombs.push(bomb(4, 5));
  const me = s.players.find((p) => p.id === "me")!;
  me.canKick = canKick;
  me.facing = "right";
  return { view: publicView(s), me };
}
const drawn = (v: PublicView) => {
  const b = v.bombs[0]!;
  return b.x * 256 + (b.slide === "right" ? b.offset : 0);
};

describe("KickPrediction", () => {
  it("slides the bomb at once when we walk into it", () => {
    const k = new KickPrediction();
    const { view, me } = scene();
    k.check(view, me, "right", 0);
    const later = k.apply(view, 10 * MS_PER_TICK);
    expect(drawn(later)).toBeGreaterThan(4 * 256);
    expect(later.bombs[0]!.slide).toBe("right");
  });

  it("does nothing without the kick", () => {
    const k = new KickPrediction();
    const { view, me } = scene(false);
    k.check(view, me, "right", 0);
    expect(k.apply(view, 200)).toBe(view);
  });

  it("stops before the block, like the game does", () => {
    const k = new KickPrediction();
    const { view, me } = scene();
    k.check(view, me, "right", 0);
    const behind = { ...view, bombs: [bomb(5, 5, { slide: "right", offset: 40 })] }; // the server kicked it too, but lags
    const b = k.apply(behind, 2000).bombs[0]!;
    expect([b.x, b.offset]).toEqual([8, 0]);
  });

  it("gives way once the server's bomb catches up", () => {
    const k = new KickPrediction();
    const { view, me } = scene();
    k.check(view, me, "right", 0);
    const server = { ...view, bombs: [bomb(8, 5)] };
    expect(k.apply(server, 300).bombs[0]).toMatchObject({ x: 8 });
    expect(k.apply(view, 310)).toBe(view); // forgotten: the server's word from here on
  });

  it("puts the bomb back if the server never kicked it", () => {
    const k = new KickPrediction();
    const { view, me } = scene();
    k.check(view, me, "right", 0);
    expect(k.apply(view, 2000)).toBe(view);
  });

  it("leaves the view it was given untouched", () => {
    const k = new KickPrediction();
    const { view, me } = scene();
    k.check(view, me, "right", 0);
    k.apply(view, 100);
    expect(view.bombs[0]).toMatchObject({ x: 4, slide: null });
  });
});
