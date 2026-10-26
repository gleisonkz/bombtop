import { describe, expect, it } from "vitest";
import { BASE_SPEED, diff, ItemKind, patch, placeBomb, placePlayerAt, playerTile, publicView, setTile, step, TILE, Tile } from "../src";
import { emptyMatch, hold, player, run } from "./helpers";

function collect(kind: ItemKind) {
  const state = emptyMatch();
  placePlayerAt(state, "p1", 3, 5);
  state.items.push({ x: 3, y: 5, kind });
  step(state);
  return state;
}

describe("Super Bomberman 4 Maniac pass abilities", () => {
  it("Bomb Pass allows entering both owned and rival grounded bombs without kicking them", () => {
    const s = collect(ItemKind.BombPass);
    const p = player(s);
    expect(p.canBombPass).toBe(true);
    p.canKick = true;
    placePlayerAt(s, "p2", 5, 5);
    expect(placeBomb(s, "p2")).toBe(true);
    placePlayerAt(s, "p2", 11, 9);
    hold(s, "right", Math.ceil(TILE / BASE_SPEED) * 2);
    expect(playerTile(p)).toEqual({ x: 5, y: 5 });
    expect(s.bombs[0]!.slide).toBeNull();
    expect(placeBomb(s, "p1")).toBe(false);
  });

  it("Bomb Pass and Kick override each other in pickup order", () => {
    const s = emptyMatch();
    placePlayerAt(s, "p1", 3, 5);
    s.items.push({ x: 3, y: 5, kind: ItemKind.Kick });
    step(s);
    expect(player(s).canKick).toBe(true);
    s.items.push({ x: 3, y: 5, kind: ItemKind.BombPass });
    step(s);
    expect(player(s).canBombPass).toBe(true);
    expect(player(s).canKick).toBe(false);
    s.items.push({ x: 3, y: 5, kind: ItemKind.Kick });
    step(s);
    expect(player(s).canBombPass).toBe(false);
    expect(player(s).canKick).toBe(true);
  });

  it("Block Pass crosses destructible blocks but not stone walls or bombs", () => {
    const s = collect(ItemKind.BlockPass);
    const p = player(s);
    expect(p.canBlockPass).toBe(true);
    setTile(s, 4, 5, Tile.Block);
    hold(s, "right", Math.ceil(TILE / BASE_SPEED) * 2);
    expect(playerTile(p)).toEqual({ x: 5, y: 5 });
    placePlayerAt(s, "p1", 3, 5);
    setTile(s, 4, 5, Tile.Wall);
    hold(s, "right", Math.ceil(TILE / BASE_SPEED) * 2);
    expect(playerTile(p)).toEqual({ x: 3, y: 5 });
    setTile(s, 4, 5, Tile.Empty);
    placePlayerAt(s, "p2", 4, 5);
    expect(placeBomb(s, "p2")).toBe(true);
    placePlayerAt(s, "p2", 11, 9);
    hold(s, "right", Math.ceil(TILE / BASE_SPEED) * 2);
    expect(playerTile(p)).toEqual({ x: 3, y: 5 });
  });

  it("Block Pass protects a character while inside a soft block struck by flames", () => {
    const s = collect(ItemKind.BlockPass);
    setTile(s, 4, 5, Tile.Block);
    hold(s, "right", Math.ceil(TILE / BASE_SPEED));
    expect(playerTile(player(s))).toEqual({ x: 4, y: 5 });
    s.flames.push({ x: 4, y: 5, ttl: 12, ownerId: "p2", block: true });
    step(s);
    expect(player(s).alive).toBe(true);
    expect(s.flames).toHaveLength(1);
  });

  it("resets pass abilities after death and synchronizes them in public deltas", () => {
    const s = collect(ItemKind.BombPass);
    const before = publicView(s);
    s.items.push({ x: 3, y: 5, kind: ItemKind.BlockPass });
    step(s);
    const both = publicView(s);
    expect(patch(before, diff(before, both))).toEqual(both);
    s.flames.push({ x: 3, y: 5, ttl: 25, ownerId: "p2" });
    step(s);
    expect(player(s).alive).toBe(false);
    expect([player(s).canBombPass, player(s).canBlockPass]).toEqual([false, false]);
    expect(s.items.map((i) => i.kind).sort()).toEqual([ItemKind.BlockPass, ItemKind.BombPass].sort());
  });
});
