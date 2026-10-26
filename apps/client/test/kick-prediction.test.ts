import { describe, expect, it } from "vitest";
import { createMatch, Floor, FUSE_TICKS, KICK_SPEED, placePlayerAt, publicView, setTile, Tile, TICK_RATE, type Bomb, type Player, type PublicView } from "@bombtop/shared";
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
  it.each([4, 5])("hands a kick on or approaching belt column %s to the server", (x) => {
    const k = new KickPrediction();
    const { view, me } = scene();
    view.grid.floor[5 * view.grid.width + x] = Floor.ConveyorDown;
    k.check(view, me, "right", 0);
    expect(k.apply(view, 100)).toBe(view);
  });

  it("abandons an existing prediction when authoritative conveyor movement arrives", () => {
    const k = new KickPrediction();
    const { view, me } = scene();
    k.check(view, me, "right", 0);
    const server = { ...view, bombs: [bomb(5, 5, { slide: "down", offset: 8, conveyor: true })] };
    expect(k.apply(server, 200)).toBe(server);
    expect(k.apply(view, 210)).toBe(view);
  });
  it("freezes a locally predicted kick when its owner holds stop", () => {
    const k = new KickPrediction();
    const { view, me } = scene();
    view.bombs[0]!.ownerId = "me";
    expect(k.check(view, me, "right", 1000)).toEqual({ x: 4, y: 5 });
    expect(k.apply(view, 1180).bombs[0]!.slide).toBe("right");
    k.stop("them", 1200);
    expect(k.apply(view, 1200).bombs[0]!.slide).toBe("right");
    k.stop("me", 1200);
    const frozen = k.apply(view, 1210).bombs[0]!;
    expect(frozen.slide).toBeNull();
    expect(frozen.offset).toBe(0);
    expect(k.apply(view, 1400).bombs[0]).toEqual(frozen);
  });

  it("reports one local kick event without repeating it on every held-input tick", () => {
    const k = new KickPrediction();
    const { view, me } = scene();
    expect(k.check(view, me, "right", 1000)).toEqual({ x: 4, y: 5 });
    expect(k.check(view, me, "right", 1010)).toBeNull();
  });

  it.each(["stun", "webbed", "shield", "charge", "rasengan", "truck", "jumpTicks", "dashTicks"] as const)("does not predict a kick during %s", (state) => {
    const k = new KickPrediction();
    const { view, me } = scene();
    me[state] = 2;
    expect(k.check(view, me, "right", 1000)).toBeNull();
    expect(k.apply(view, 1000 + 3 * MS_PER_TICK)).toBe(view);
  });

  it("keeps a new kick alive when the render timestamp precedes the input timestamp", () => {
    const k = new KickPrediction();
    const { view, me } = scene();
    k.check(view, me, "right", 1000);
    expect(k.apply(view, 995)).toBe(view);
    expect(drawn(k.apply(view, 1000 + 3 * MS_PER_TICK))).toBe(4 * 256 + 3 * KICK_SPEED);
  });

  it("moves a predicted kick smoothly between simulation ticks", () => {
    const k = new KickPrediction();
    const { view, me } = scene();
    k.check(view, me, "right", 1000);
    const mid = k.apply(view, 1000 + 0.5 * MS_PER_TICK);
    expect(drawn(mid)).toBe(4 * 256 + KICK_SPEED / 2);
    expect(drawn(k.apply(view, 1000 + 1.5 * MS_PER_TICK))).toBe(4 * 256 + KICK_SPEED * 1.5);
  });

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

  it("stops a predicted kick before another living player", () => {
    const k = new KickPrediction();
    const { view, me } = scene();
    const rival = view.players.find((p) => p.id === "them")!;
    rival.px = 7 * 256 + 128;
    rival.py = 5 * 256 + 128;
    k.check(view, me, "right", 0);
    const confirmed = { ...view, bombs: [{ ...view.bombs[0]!, slide: "right" as const, offset: KICK_SPEED }] };
    k.apply(confirmed, 100);
    expect(k.apply(confirmed, 2000).bombs[0]).toMatchObject({ x: 6, y: 5, offset: 0 });
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
