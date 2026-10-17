import { describe, expect, it } from "vitest";
import { AIR_TICKS_PER_TILE, bombAt, ItemKind, placeBomb, placePlayerAt, setTile, STUN_TICKS, step, Tile } from "../src";
import { center, emptyMatch, hold, player, press, run } from "./helpers";

const FLIGHT = AIR_TICKS_PER_TILE * 3 + 2;

/** p1 at (x,y) facing `dir`, with a p2 bomb on the tile in front. */
function setup(x: number, y: number, dir: "left" | "right" | "up" | "down", bx: number, by: number) {
  const s = emptyMatch();
  player(s).canPunch = true;
  placePlayerAt(s, "p2", bx, by);
  placeBomb(s, "p2");
  placePlayerAt(s, "p2", 11, 9);
  placePlayerAt(s, "p1", x, y);
  player(s).facing = dir;
  return { s, bomb: s.bombs.at(-1)! };
}

describe("punch", () => {
  it("the punch item grants the ability", () => {
    const s = emptyMatch();
    s.items.push({ x: 1, y: 1, kind: ItemKind.Punch });
    step(s);
    expect(player(s).canPunch).toBe(true);
  });

  it("sends the bomb in front flying three tiles", () => {
    const { s, bomb } = setup(3, 5, "right", 4, 5);
    press(s, "action");
    expect(bomb.air).not.toBeNull();
    run(s, FLIGHT);
    expect(bomb.air).toBeNull();
    expect([bomb.x, bomb.y]).toEqual([7, 5]);
  });

  it("does nothing without the ability or without a bomb in front", () => {
    const { s, bomb } = setup(3, 5, "right", 4, 5);
    player(s).canPunch = false;
    press(s, "action");
    expect(bomb.air).toBeNull();
    player(s).canPunch = true;
    player(s).facing = "left";
    press(s, "action");
    expect(bomb.air).toBeNull();
  });

  it("airborne bombs neither block nor burn their fuse", () => {
    const { s, bomb } = setup(3, 5, "right", 4, 5);
    const fuse = bomb.fuse;
    press(s, "action");
    expect(bombAt(s, 4, 5)).toBeUndefined();
    run(s, AIR_TICKS_PER_TILE);
    expect(bomb.fuse).toBe(fuse);
  });

  it("flies over blocks and bounces when landing on one", () => {
    const { s, bomb } = setup(3, 5, "right", 4, 5);
    setTile(s, 5, 5, Tile.Block);
    setTile(s, 7, 5, Tile.Block);
    press(s, "action");
    run(s, FLIGHT + AIR_TICKS_PER_TILE);
    expect([bomb.x, bomb.y]).toEqual([8, 5]);
    expect(getTileSafe(s, 5, 5)).toBe(Tile.Block);
  });

  it("wraps around the arena edges", () => {
    const { s, bomb } = setup(9, 5, "right", 10, 5);
    press(s, "action");
    run(s, FLIGHT);
    expect([bomb.x, bomb.y]).toEqual([2, 5]);
  });

  it("stuns a player it lands on and bounces off", () => {
    const { s, bomb } = setup(3, 5, "right", 4, 5);
    placePlayerAt(s, "p2", 7, 5);
    press(s, "action");
    run(s, FLIGHT);
    expect(player(s, "p2").stun).toBeGreaterThan(0);
    run(s, AIR_TICKS_PER_TILE);
    expect([bomb.x, bomb.y]).toEqual([8, 5]);
  });

  it("stunned players cannot move", () => {
    const s = emptyMatch();
    placePlayerAt(s, "p1", 5, 5);
    player(s).stun = STUN_TICKS;
    hold(s, "right", 5);
    expect(player(s).px).toBe(center(5));
  });

  it("the action button detonates remote bombs before punching", () => {
    const { s, bomb } = setup(3, 5, "right", 4, 5);
    player(s).bombType = "remote";
    placePlayerAt(s, "p1", 1, 9);
    placeBomb(s, "p1");
    placePlayerAt(s, "p1", 3, 5);
    press(s, "action");
    expect(bomb.air).toBeNull();
    expect(s.bombs.some((b) => b.ownerId === "p1")).toBe(false);
  });
});

function getTileSafe(s: ReturnType<typeof emptyMatch>, x: number, y: number) {
  return s.grid.tiles[y * s.grid.width + x];
}
