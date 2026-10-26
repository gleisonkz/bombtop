import { describe, expect, it } from "vitest";
import { createMatch } from "../src/arena";
import { buildStage, sb4Map, SB4_STAGES, STAGES, SELECTABLE_STAGES } from "../src/stage";
import { SB4_STAGE_DEFINITIONS } from "../src/sb4-stage-definitions";
import { MAX_SPEED } from "../src/constants";
import { Floor, playerTile, Tile } from "../src/state";

const seats = ["a", "b", "c", "d", "e"];

describe("SB4 Group 1 layouts", () => {
  it("exposes all twelve ids, numeric lookups and catalog names without changing defaults", () => {
    expect(SB4_STAGES).toHaveLength(12);
    expect(STAGES).toEqual(["classic", "conveyor", "warp"]);
    expect(SELECTABLE_STAGES).toEqual([...STAGES, ...SB4_STAGES]);
    for (const definition of SB4_STAGE_DEFINITIONS) {
      const id = `sb4-${String(definition.number).padStart(2, "0")}`;
      expect(sb4Map(definition.number)).toEqual(sb4Map(id));
      expect(sb4Map(definition.name)).toEqual(sb4Map(id));
      expect(sb4Map(id)?.number).toBe(definition.number);
    }
    for (const invalid of [0, 13, 1.5, "sb4-13", "classic", "missing"]) expect(sb4Map(invalid)).toBeNull();
  });

  it.each(Array.from({ length: 12 }, (_, index) => index + 1))("initializes a safe deterministic 15x13 layout for stage %i", number => {
    const stage = `sb4-${String(number).padStart(2, "0")}` as (typeof SB4_STAGES)[number];
    const layout = buildStage(stage, 15, 13);
    expect(layout.tiles).toHaveLength(195);
    expect(layout.floor).toHaveLength(195);
    const match = createMatch({ stage, seed: 17, playerIds: seats });
    expect(match.grid).toEqual(createMatch({ stage, seed: 90, playerIds: seats }).grid);
    expect(match.players.map(playerTile)).toEqual([
      { x: 1, y: 1 }, { x: 13, y: 1 }, { x: 13, y: 11 }, { x: 1, y: 11 }, { x: 7, y: 6 },
    ]);
    const empty = createMatch({ stage, seed: 17, playerIds: seats, blockDensity: 0 });
    expect(empty.grid.tiles).not.toContain(Tile.Block);
    const visited = new Set([16]);
    const queue = [16];
    for (const index of queue) {
      for (const next of [index - 15, index + 15, index - 1, index + 1]) {
        if (next < 0 || next >= 195 || visited.has(next) || empty.grid.tiles[next] !== Tile.Empty || empty.grid.floor[next] === Floor.Pit) continue;
        visited.add(next);
        queue.push(next);
      }
    }
    for (const p of match.players) {
      const { x, y } = playerTile(p);
      expect(match.grid.tiles[y * 15 + x]).toBe(Tile.Empty);
      expect(visited.has(y * 15 + x)).toBe(true);
      expect(match.grid.floor[y * 15 + x]).not.toBe(Floor.Pit);
    }
    expect(match.grid.tiles.filter(tile => tile === Tile.Block)).toHaveLength(sb4Map(stage)!.softBlocks);
  });

  it("marks the observable gimmicks in the floor contract", () => {
    const features = [[4, Floor.Pit], [6, Floor.Surprise], [7, Floor.Foliage], [8, Floor.Slot], [9, Floor.Seesaw], [11, Floor.Rail], [12, Floor.Flag]] as const;
    for (const [number, floor] of features) {
      const stage = `sb4-${String(number).padStart(2, "0")}` as (typeof SB4_STAGES)[number];
      expect(buildStage(stage, 15, 13).floor).toContain(floor);
    }
    expect(buildStage("sb4-09", 15, 13).floor.filter(floor => floor === Floor.Seesaw)).toHaveLength(4);
  });

  it.each(["sb4-05", "sb4-08"] as const)("starts %s without destructible blocks or hidden items even under density overrides", stage => {
    for (const blockDensity of [undefined, 0, 1]) {
      const match = createMatch({ stage, seed: 9, playerIds: seats, ...(blockDensity === undefined ? {} : { blockDensity }) });
      expect(match.grid.tiles).not.toContain(Tile.Block);
      expect(match.items).toEqual([]);
    }
  });

  it("gives stage 05 the Battle Royale loadout", () => {
    const match = createMatch({ stage: "sb4-05", seed: 7, playerIds: seats });
    for (const player of match.players) expect(player).toMatchObject({ bombCapacity: 5, fireRange: 6, speed: MAX_SPEED, canGlove: true, canPunch: true, canKick: true, canPush: true });
  });

  it("keeps both rolling-ball anchors clear even with a full density override", () => {
    const layout = buildStage("sb4-03", 15, 13);
    expect(layout.rollingBalls).toEqual([{ x: 5, y: 5 }, { x: 9, y: 7 }]);
    for (const blockDensity of [undefined, 1]) {
      const match = createMatch({ stage: "sb4-03", seed: 1, playerIds: seats, ...(blockDensity === undefined ? {} : { blockDensity }) });
      for (const { x, y } of layout.rollingBalls!) {
        expect(layout.keepClear.has(y * 15 + x)).toBe(true);
        expect(match.grid.tiles[y * 15 + x]).toBe(Tile.Empty);
      }
    }
  });

  it("marks nine exposed panels, three slot switches and the five flag posts", () => {
    expect(buildStage("sb4-06", 15, 13).floor.filter(f => f === Floor.Surprise)).toHaveLength(9);
    expect(buildStage("sb4-08", 15, 13).floor.filter(f => f === Floor.Slot)).toHaveLength(3);
    const flags = buildStage("sb4-12", 15, 13);
    for (const [x, y] of [[1, 1], [13, 1], [13, 11], [1, 11], [7, 6]]) expect(flags.floor[y! * 15 + x!]).toBe(Floor.Flag);
  });

  it("keeps both ends of all four seesaws available at any block density", () => {
    const layout = buildStage("sb4-09", 15, 13);
    const pivots = layout.floor.flatMap((floor, index) => floor === Floor.Seesaw ? [index] : []);
    for (const blockDensity of [undefined, 1]) {
      const match = createMatch({ stage: "sb4-09", seed: 3, playerIds: seats, ...(blockDensity === undefined ? {} : { blockDensity }) });
      for (const pivot of pivots) {
        for (const end of [pivot - 1, pivot + 1]) {
          expect(layout.keepClear.has(end)).toBe(true);
          expect(match.grid.tiles[end]).toBe(Tile.Empty);
        }
      }
    }
  });

  it.each(SB4_STAGE_DEFINITIONS)("uses the catalog item counts for $name, excluding honey", definition => {
    if (definition.kind !== "documented") return;
    const stage = `sb4-${String(definition.number).padStart(2, "0")}` as (typeof SB4_STAGES)[number];
    const match = createMatch({ stage, seed: 19, playerIds: seats });
    for (const [kind, count] of Object.entries(definition.itemCounts)) {
      if (kind === "honey") continue;
      expect(match.items.filter(item => item.kind === kind)).toHaveLength(count);
    }
    expect(match.items.every(item => match.grid.tiles[item.y * 15 + item.x] === Tile.Block)).toBe(true);
    expect(new Set(match.items.map(item => item.y * 15 + item.x)).size).toBe(match.items.length);
  });
});
