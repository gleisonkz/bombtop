import { describe, expect, it } from "vitest";
import { createMatch, placePlayerAt, Tile, Floor, tileCenter, playerTile } from "../src";
import { buildSb4Layout } from "../src/sb4-layouts";
import { initializeStageTransport, updateStageTransport, stageTransportInput } from "../src/stage-transport";

function arena(stage: "sb4-09" | "sb4-11") {
  const s = createMatch({ seed: 14, playerIds: ["a", "b"], blockDensity: 0 });
  s.stage = stage;
  if (stage === "sb4-11") s.rng = 0;
  s.grid.tiles.fill(Tile.Empty);
  s.grid.floor.fill(Floor.Normal);
  return s;
}
const input = { dir: "left" as const, bomb: true };

describe("SB4 stage transport", () => {
  it.each(["held", "thrown"] as const)("ignores a %s player at the seesaw trigger, launch end and trolley", mode => {
    const s = arena("sb4-09");
    const p = s.players[0]!;
    if (mode === "held") p.heldBy = "b";
    else p.thrown = { dir: "left", span: 3, tilesLeft: 2, progress: 1 };
    const thrown = p.thrown ? { ...p.thrown } : undefined;
    s.stageState = { seesaws: [{ x: 4, y: 3, dir: "right", raised: false }] };
    placePlayerAt(s, "a", 3, 3);
    updateStageTransport(s);
    expect(s.stageState.seesaws![0]!.raised).toBe(false);
    expect(s.stageState.flights?.a).toBeUndefined();
    placePlayerAt(s, "a", 5, 3);
    placePlayerAt(s, "b", 3, 3);
    updateStageTransport(s);
    expect(s.stageState.seesaws![0]!.raised).toBe(true);
    expect(s.stageState.flights?.a).toBeUndefined();
    expect(playerTile(p)).toEqual({ x: 5, y: 3 });
    expect(p.thrown).toEqual(thrown);
    s.stage = "sb4-11";
    initializeStageTransport(s);
    placePlayerAt(s, "a", 7, 5);
    const trolley = s.stageState.trolley!;
    const position = { px: trolley.px, py: trolley.py };
    updateStageTransport(s);
    expect(trolley.riderId).toBeUndefined();
    expect({ px: trolley.px, py: trolley.py }).toEqual(position);
    expect(p.thrown).toEqual(thrown);
  });
  it.each(["dead", "missing"] as const)("stops and detaches a %s trolley rider before movement", reason => {
    const s = arena("sb4-11");
    initializeStageTransport(s);
    placePlayerAt(s, "a", 7, 5);
    updateStageTransport(s);
    const trolley = s.stageState!.trolley!;
    const rider = s.players[0]!;
    const position = { px: trolley.px, py: trolley.py };
    if (reason === "dead") rider.alive = false;
    else s.players = s.players.filter(p => p.id !== rider.id);
    Object.assign(s.players.find(p => p.id === "b")!, position);
    updateStageTransport(s);
    expect(trolley.riderId).toBeUndefined();
    expect(trolley.remaining).toBe(0);
    expect(trolley.cooldown).toBeGreaterThan(0);
    expect({ px: trolley.px, py: trolley.py }).toEqual(position);
    expect({ px: rider.px, py: rider.py }).toEqual(position);
    updateStageTransport(s);
    expect(trolley.riderId).toBeUndefined();
    expect({ px: trolley.px, py: trolley.py }).toEqual(position);
  });

  it.each(["block", "flame", "bomb", "pit"] as const)("keeps the provisional safe-landing fallback for a new %s", hazard => {
    const s = arena("sb4-09");
    s.stageState = { seesaws: [{ x: 4, y: 3, dir: "right", raised: false }] };
    placePlayerAt(s, "a", 3, 3);
    placePlayerAt(s, "b", 5, 3);
    updateStageTransport(s);
    expect(s.stageState.flights?.b).toBeDefined();
    for (let i = 0; i < 14; i++) updateStageTransport(s);
    if (hazard === "block") s.grid.tiles[3 * s.grid.width + 5] = Tile.Block;
    if (hazard === "flame") s.flames.push({ x: 5, y: 3, ttl: 30 });
    if (hazard === "pit") s.grid.floor[3 * s.grid.width + 5] = Floor.Pit;
    if (hazard === "bomb") s.bombs.push({ x: 5, y: 3, ownerId: "a", fuse: 80, range: 2, type: "normal", slide: null, offset: 0, air: null, heldBy: null });
    updateStageTransport(s);
    expect(s.stageState.flights?.b).toBeUndefined();
    expect(playerTile(s.players[1]!)).toEqual({ x: 4, y: 3 });
    expect(s.players[1]!.px).toBe(tileCenter(4));
    expect(s.players[1]!.alive).toBe(true);
    expect(s.players[1]!.jumpTicks).toBe(0);
  });
  it("reads the four horizontal pivots from the shared stage layout", () => {
    const s = arena("sb4-09");
    const layout = buildSb4Layout(9, 15, 13);
    s.grid.floor = layout.floor;
    initializeStageTransport(s);
    expect(s.stageState?.seesaws?.map(({ x, y, dir }) => ({ x, y, dir }))).toEqual([
      { x: 4, y: 3, dir: "right" }, { x: 10, y: 3, dir: "right" },
      { x: 4, y: 9, dir: "right" }, { x: 10, y: 9, dir: "right" },
    ]);
  });

  it("resumes a trolley trip identically after serialization", () => {
    const s = arena("sb4-11");
    initializeStageTransport(s);
    placePlayerAt(s, "a", 7, 5);
    updateStageTransport(s);
    const resumed = JSON.parse(JSON.stringify(s)) as typeof s;
    for (let i = 0; i < 400; i++) {
      updateStageTransport(s);
      updateStageTransport(resumed);
    }
    expect(resumed).toEqual(s);
  });
  it("groups four three-tile seesaws and preserves unrelated state", () => {
    const s = arena("sb4-09");
    for (const y of [3, 9]) for (const x of [3, 9]) for (let d = 0; d < 3; d++) s.grid.floor[y * s.grid.width + x + d] = Floor.Seesaw;
    s.stageState = { floorLocks: { a: 3 } };
    initializeStageTransport(s);
    expect(s.stageState.seesaws).toHaveLength(4);
    expect(s.stageState.floorLocks).toEqual({ a: 3 });
  });

  it("links seesaws, launches the opposite player with a separate integer flight and lands safely", () => {
    const s = arena("sb4-09");
    s.stageState = { seesaws: [{ x: 4, y: 3, dir: "right", raised: false }, { x: 10, y: 9, dir: "right", raised: false }] };
    placePlayerAt(s, "a", 3, 3);
    placePlayerAt(s, "b", 11, 9);
    s.grid.tiles[9 * s.grid.width + 13] = Tile.Wall;
    updateStageTransport(s);
    expect(s.stageState.seesaws!.every(v => v.raised)).toBe(true);
    expect(s.stageState.flights?.b).toBeDefined();
    expect(stageTransportInput(s, s.players[1]!, input)).toBe(true);
    expect(s.players[1]!.jumpTicks).toBe(0);
    for (let i = 0; i < 100; i++) {
      updateStageTransport(s);
      expect(Number.isInteger(s.players[1]!.px)).toBe(true);
    }
    expect(playerTile(s.players[1]!)).toEqual({ x: 11, y: 9 });
    expect(s.stageState.flights?.b).toBeUndefined();
    expect(stageTransportInput(s, s.players[1]!, input)).toBe(false);
  });

  it("uses the existing airborne bomb contract", () => {
    const s = arena("sb4-09");
    s.stageState = { seesaws: [{ x: 4, y: 3, dir: "right", raised: false }] };
    placePlayerAt(s, "a", 3, 3);
    s.bombs.push({ x: 5, y: 3, ownerId: "a", fuse: 80, range: 2, type: "normal", slide: "left", offset: 12, air: null, heldBy: null });
    updateStageTransport(s);
    expect(s.bombs[0]!.air?.dir).toBe("right");
    expect(s.bombs[0]!.fuse).toBe(80);
    expect(s.bombs[0]!.slide).toBeNull();
  });

  it("boards without a button, crushes blocks, bombs and protected opponents, completes one lap", () => {
    const s = arena("sb4-11");
    initializeStageTransport(s);
    const trolley = s.stageState!.trolley!;
    trolley.routeRng = 24;
    expect([trolley.px, trolley.py]).toEqual([tileCenter(7), tileCenter(5)]);
    expect(JSON.parse(JSON.stringify(trolley))).toEqual(trolley);
    placePlayerAt(s, "a", 7, 5);
    placePlayerAt(s, "b", 7, 4);
    Object.assign(s.players[1]!, { invuln: 100, mount: "hopper", hasHeart: true });
    s.grid.tiles[4 * s.grid.width + 7] = Tile.Block;
    s.bombs.push({ x: 7, y: 4, ownerId: "b", fuse: 80, range: 2, type: "normal", slide: null, offset: 0, air: null, heldBy: null });
    updateStageTransport(s);
    expect(stageTransportInput(s, s.players[0]!, input)).toBe(true);
    for (let i = 0; i < 60; i++) updateStageTransport(s);
    expect(s.players[1]!.alive).toBe(false);
    expect(s.grid.tiles[4 * s.grid.width + 7]).toBe(Tile.Empty);
    expect(s.bombs[0]!.fuse).toBe(0);
    for (let i = 0; i < 1000 && trolley.riderId; i++) updateStageTransport(s);
    expect(trolley.riderId).toBeUndefined();
    expect(trolley.phase).toBeUndefined();
    expect(s.players[0]!.alive).toBe(true);
    expect(playerTile(s.players[0]!)).toEqual({ x: 7, y: 4 });
    updateStageTransport(s);
    expect(trolley.riderId).toBeUndefined();
  });
});




