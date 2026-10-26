import { describe, expect, it } from "vitest";
import { AIR_TICKS_PER_TILE, diff, FLAME_TICKS, Floor, ItemKind, patch, placeBomb, placePlayerAt, playerTile, publicView, setTile, step, Tile } from "../src";
import { emptyMatch, player, run } from "./helpers";

function setup(ids = ["p1", "p2"]) {
  const s = emptyMatch(ids);
  for (const id of ids) placePlayerAt(s, id, 3, 5);
  player(s).canGlove = true;
  player(s).facing = "right";
  return s;
}

function grab(s: ReturnType<typeof setup>) {
  step(s, { p1: { dir: null, bomb: true, hold: true } });
}

describe("SB4 glove player transport", () => {
  it("lifts an overlapping player using bomb and hold without placing a bomb", () => {
    const s = setup();
    grab(s);
    expect(player(s, "p2")).toMatchObject({ heldBy: "p1", alive: true });
    expect(s.bombs).toHaveLength(0);
  });

  it("keeps the captured player with the carrier and ignores their own inputs", () => {
    const s = setup();
    grab(s);
    run(s, 16, { p1: { dir: "down", bomb: false, hold: true }, p2: { dir: "left", bomb: true, special: true, action: true } });
    expect(playerTile(player(s, "p2"))).toEqual(playerTile(player(s)));
    expect(player(s, "p2").heldBy).toBe("p1");
    expect(s.bombs).toHaveLength(0);
    expect(s.blasts).toHaveLength(0);
  });

  it("releases on button-up, crosses intermediate blocks and lands", () => {
    const s = setup();
    grab(s);
    setTile(s, 4, 5, Tile.Block);
    step(s, { p1: { dir: null, bomb: false } });
    expect(player(s, "p2").heldBy).toBeUndefined();
    expect(player(s, "p2").thrown).toBeDefined();
    run(s, AIR_TICKS_PER_TILE * 3);
    expect(playerTile(player(s, "p2"))).toEqual({ x: 6, y: 5 });
    expect(player(s, "p2").thrown).toBeUndefined();
  });

  it("honors the target brace and does not grab an adjacent player", () => {
    const s = setup();
    step(s, { p1: { dir: null, bomb: true, hold: true }, p2: { dir: null, bomb: false, brace: true } });
    expect(player(s, "p2").heldBy).toBeUndefined();
    s.bombs = [];
    placePlayerAt(s, "p2", 4, 5);
    grab(s);
    expect(player(s, "p2").heldBy).toBeUndefined();
  });

  it("supports a three-player stack and prevents cyclic grabbing", () => {
    const s = setup(["p1", "p2", "p3"]);
    player(s, "p2").canGlove = true;
    placePlayerAt(s, "p1", 1, 1);
    step(s, { p2: { dir: null, bomb: true, hold: true } });
    placePlayerAt(s, "p1", 3, 5);
    grab(s);
    expect(player(s, "p2").heldBy).toBe("p1");
    expect(player(s, "p3").heldBy).toBe("p2");
    run(s, 4, { p1: { dir: null, bomb: false, hold: true }, p2: { dir: null, bomb: true, hold: true } });
    expect(player(s).heldBy).toBeUndefined();
  });

  it("releases a victim when the carrier dies or disconnects", () => {
    const s = setup();
    grab(s);
    player(s).alive = false;
    step(s);
    expect(player(s, "p2").heldBy).toBeUndefined();
    const other = setup();
    grab(other);
    other.players = other.players.filter(p => p.id !== "p1");
    step(other);
    expect(player(other, "p2").heldBy).toBeUndefined();
  });

  it("does not collect or infect through the floor while carried", () => {
    const s = setup();
    player(s).stun = 0;
    grab(s);
    player(s, "p2").curse = { kind: "slow" };
    s.items.push({ x: 3, y: 5, kind: ItemKind.Speed, owner: "p1" });
    step(s, { p1: { dir: null, bomb: false, hold: true } });
    expect(s.items).toHaveLength(1);
    expect(player(s).curse).toBeNull();
  });

  it("flight ignores intermediate floor fire but landing in fire is dangerous", () => {
    const s = setup();
    grab(s);
    step(s, { p1: { dir: null, bomb: false } });
    s.flames.push({ x: 4, y: 5, ttl: FLAME_TICKS }, { x: 6, y: 5, ttl: FLAME_TICKS });
    run(s, AIR_TICKS_PER_TILE + 1);
    expect(player(s, "p2").alive).toBe(true);
    run(s, AIR_TICKS_PER_TILE * 2);
    expect(player(s, "p2").alive).toBe(false);
  });

  it("passes the carry and release states through snapshots and deltas", () => {
    const s = setup();
    const before = publicView(s);
    grab(s);
    const during = publicView(s);
    expect(patch(before, diff(before, during))).toEqual(during);
    step(s, { p1: { dir: null, bomb: false } });
    const after = publicView(s);
    expect(patch(during, diff(during, after))).toEqual(after);
  });

  it("flies over a pit and dies when landing in one", () => {
    const s = setup();
    s.stage = "sb4-04";
    s.grid.floor[5 * s.grid.width + 4] = Floor.Pit;
    s.grid.floor[5 * s.grid.width + 6] = Floor.Pit;
    grab(s);
    step(s, { p1: { dir: null, bomb: false } });
    run(s, AIR_TICKS_PER_TILE + 1);
    expect(player(s, "p2").alive).toBe(true);
    run(s, AIR_TICKS_PER_TILE * 2);
    expect(player(s, "p2").alive).toBe(false);
  });

  it("wraps the arena and bounces beyond an obstructed landing", () => {
    const s = setup();
    grab(s);
    setTile(s, 6, 5, Tile.Block);
    step(s, { p1: { dir: null, bomb: false } });
    run(s, AIR_TICKS_PER_TILE * 4);
    expect(playerTile(player(s, "p2"))).toEqual({ x: 7, y: 5 });
    expect(player(s, "p2").thrown).toBeUndefined();
    const other = setup();
    const edge = other.grid.width - 2;
    for (const id of ["p1", "p2"]) placePlayerAt(other, id, edge, 5);
    grab(other);
    step(other, { p1: { dir: null, bomb: false } });
    run(other, AIR_TICKS_PER_TILE * 2);
    expect(playerTile(player(other, "p2"))).toEqual({ x: 1, y: 5 });
  });

  it("a mounted player cannot use Punch or character specials", () => {
    const s = setup();
    placePlayerAt(s, "p2", 4, 5);
    placeBomb(s, "p2");
    placePlayerAt(s, "p2", 11, 9);
    Object.assign(player(s), { mount: "pusher", canPunch: true, character: "thor" });
    step(s, { p1: { dir: null, bomb: false, action: true, special: true } });
    expect(s.bombs[0]!.air).toBeNull();
    expect(s.blasts).toHaveLength(0);
  });

  it("preserves lifting bombs when a bomb shares the tile", () => {
    const s = setup();
    placeBomb(s, "p2");
    grab(s);
    expect(s.bombs[0]!.heldBy).toBe("p1");
    expect(player(s, "p2").heldBy).toBeUndefined();
  });
});
