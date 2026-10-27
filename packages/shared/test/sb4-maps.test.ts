import { describe, expect, it } from "vitest";
import {
  BASE_SPEED, createMatch, ItemKind, placeBomb, placePlayerAt,
  playerTile, SB4_STAGE_DEFINITIONS, SB4_STAGES, SELECTABLE_STAGES, STAGES, step, TICK_RATE, Tile,
  validateStageRotation, type StageId,
} from "../src";

const players = ["p1", "p2", "p3", "p4", "p5"];
const originals = ["sb4-01", "sb4-02"] as const satisfies readonly StageId[];

describe("Super Bomberman 4 battle maps", () => {
  it.each(originals)("uses the five original seat positions on %s", stage => {
    const original = createMatch({ stage, seed: 14, playerIds: players });
    expect(original.players.map(playerTile)).toEqual([
      { x: 1, y: 1 }, { x: 13, y: 11 }, { x: 13, y: 1 },
      { x: 1, y: 11 }, { x: 7, y: 6 },
    ]);
    for (const p of original.players) {
      const { x, y } = playerTile(p);
      expect(original.grid.tiles[y * original.grid.width + x]).toBe(Tile.Empty);
    }
    const creative = createMatch({ stage: "classic", seed: 14, playerIds: players });
    expect(creative.players.map(playerTile)[1]).toEqual({ x: 13, y: 11 });
  });
  it("keeps creative maps as defaults and makes SB4 maps selectable", () => {
    expect(STAGES).toEqual(["classic", "conveyor", "warp"]);
    expect(SELECTABLE_STAGES).toEqual([...STAGES, ...SB4_STAGES]);
    expect(validateStageRotation(SB4_STAGES.map(stage => ({ stage })))).toEqual(SB4_STAGES.map(stage => ({ stage })));
  });

  it.each(originals)("copies the 80 soft-block layout density of %s, without traps", stage => {
    for (const seed of [0, 1, 20, 64, 72, 255]) {
      const a = createMatch({ stage, seed, playerIds: players });
      const b = createMatch({ stage, seed, playerIds: players });
      expect(a.grid).toEqual(b.grid);
      expect(a.items).toEqual(b.items);
      expect(a.grid.tiles.filter(tile => tile === Tile.Block)).toHaveLength(80);
      expect(a.grid.warps).toEqual([]);
      expect(a.players.every(p => a.grid.tiles[Math.floor(p.py / 256) * a.grid.width + Math.floor(p.px / 256)] === Tile.Empty)).toBe(true);
      expect(new Set(a.items.map(item => `${item.x},${item.y}`)).size).toBe(a.items.length);
      expect(a.items.every(item => a.grid.tiles[item.y * a.grid.width + item.x] === Tile.Block)).toBe(true);
    }
  });

  it.each(originals)("uses the documented Battle Stage item bag in %s", stage => {
    const number = stage === "sb4-01" ? 1 : 2;
    const source = SB4_STAGE_DEFINITIONS[number - 1];
    if (!source || source.kind !== "documented") throw new Error("missing source item counts");
    const match = createMatch({ stage, seed: 16, playerIds: players });
    expect(match.items).toHaveLength(source.knownTotal);
    for (const [kind, count] of Object.entries(source.itemCounts)) {
      const type = kind === "push" ? ItemKind.Push : kind;
      expect(match.items.filter(item => item.kind === type)).toHaveLength(count);
    }
    expect(match.items.every(item => item.kind !== ItemKind.Remote && item.kind !== ItemKind.Pierce)).toBe(true);
  });

  it("keeps explicit density overrides usable for previews and test fixtures", () => {
    for (const stage of originals) {
      const empty = createMatch({ stage, seed: 14, playerIds: players, blockDensity: 0 });
      expect(empty.grid.tiles.filter(tile => tile === Tile.Block)).toHaveLength(0);
      expect(empty.items).toHaveLength(0);
    }
  });

  it("changes movement and existing bomb fuses together in the second stage", () => {
    const match = createMatch({ stage: "sb4-02", seed: 11, playerIds: ["p1", "p2"], blockDensity: 0 });
    placePlayerAt(match, "p1", 5, 5);
    const p = match.players[0]!;
    expect(match.stage).toBe("sb4-02");
    expect(match.tempo).toBe(1);
    const first = p.px;
    step(match, { p1: { dir: "right", bomb: false } });
    expect(p.px - first).toBe(BASE_SPEED);
    placeBomb(match, "p1");
    const fuse = match.bombs[0]!.fuse;
    match.tick = 14 * TICK_RATE - 1;
    step(match, { p1: { dir: "right", bomb: false } });
    expect(match.tempo).not.toBe(1);
    step(match, { p1: { dir: "right", bomb: false } });
    expect(p.px - first).toBe(BASE_SPEED * (1 + match.tempo! * 2));
    expect(fuse - match.bombs[0]!.fuse).toBe(match.tempo === 0.5 ? 1 : 4);
  });
});
