import { describe, expect, it } from "vitest";
import {
  AIR_TICKS_PER_TILE,
  CART_TICKS,
  createMatch,
  FLAME_TICKS,
  FUSE_TICKS,
  perimeter,
  placePlayerAt,
  playerTile,
  step,
  type MatchState,
} from "../src";
import { emptyMatch, player, press, run } from "./helpers";

const FLIGHT = AIR_TICKS_PER_TILE * 3 + 2;

function kill(s: MatchState, id: string) {
  const { x, y } = playerTile(player(s, id));
  s.flames.push({ x, y, ttl: FLAME_TICKS, ownerId: "p2" });
  step(s);
}

/** p1 dead and riding a cart at a given border tile. */
function onCart(x: number, y: number) {
  const s = emptyMatch(["p1", "p2", "p3"]);
  player(s).alive = false;
  const ring = perimeter(s.grid.width, s.grid.height);
  player(s).cart = { pos: ring.findIndex((t) => t.x === x && t.y === y), cooldown: 0 };
  return s;
}

const cartTile = (s: MatchState, id = "p1") => perimeter(s.grid.width, s.grid.height)[player(s, id).cart!.pos]!;

describe("perimeter", () => {
  it("runs clockwise around the border", () => {
    const ring = perimeter(13, 11);
    expect(ring).toHaveLength(2 * 13 + 2 * 11 - 4);
    expect(ring[0]).toEqual({ x: 0, y: 0 });
    expect(ring[12]).toEqual({ x: 12, y: 0 });
    expect(ring[13]).toEqual({ x: 12, y: 1 });
  });
});

describe("revenge carts", () => {
  it("a player who dies gets a cart on the border (when turned on)", () => {
    const s = emptyMatch(["p1", "p2", "p3"]);
    s.revenge = true;
    kill(s, "p1");
    expect(player(s).alive).toBe(false);
    const t = cartTile(s);
    expect(t.x === 0 || t.y === 0 || t.x === 12 || t.y === 10).toBe(true);
  });

  it("can be turned off", () => {
    const s = createMatch({ seed: 1, playerIds: ["p1", "p2", "p3"], blockDensity: 0, revenge: false });
    kill(s, "p1");
    expect(player(s).cart).toBeNull();
  });

  it("moves along the edge, one tile per CART_TICKS", () => {
    const s = onCart(5, 0);
    run(s, CART_TICKS * 2, { p1: { dir: "right", bomb: false } });
    expect(cartTile(s)).toEqual({ x: 7, y: 0 });
    run(s, CART_TICKS, { p1: { dir: "down", bomb: false } }); // not along the top edge
    expect(cartTile(s)).toEqual({ x: 7, y: 0 });
  });

  it("throws a bomb into the arena", () => {
    const s = onCart(5, 0);
    press(s, "bomb");
    const b = s.bombs[0]!;
    expect(b.ownerId).toBe("p1");
    run(s, FLIGHT);
    expect([b.x, b.y]).toEqual([5, 3]);
  });

  it("has one bomb at a time and cannot throw from corners", () => {
    const s = onCart(5, 0);
    press(s, "bomb");
    press(s, "bomb");
    expect(s.bombs).toHaveLength(1);
    const c = onCart(0, 0);
    press(c, "bomb");
    expect(c.bombs).toHaveLength(0);
  });

  it("a cart bomb that kills someone brings the cart rider back in their place", () => {
    const s = onCart(5, 0);
    press(s, "bomb");
    run(s, FLIGHT); // lands on (5,3)
    placePlayerAt(s, "p2", 5, 4); // next to it, within range 1
    run(s, FUSE_TICKS);
    expect(player(s, "p2").alive).toBe(false);
    expect(player(s).alive).toBe(true);
    expect(player(s).cart).toBeNull();
    expect(playerTile(player(s))).toEqual({ x: 5, y: 4 });
  });

  it("living players have no cart", () => {
    expect(player(emptyMatch()).cart).toBeNull();
  });
});
