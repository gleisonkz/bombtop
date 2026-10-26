import { describe, expect, it } from "vitest";
import { Bot, createMatch, Floor, hurt, ItemKind, matchResult, placeBomb, placePlayerAt, playerTile, publicView, SB4_STAGES, step, TILE, tileCenter, Tile } from "../src";
import { initializeStageMechanics, updateStageMechanics } from "../src/stage-mechanics";

function arena(stage: "sb4-03" | "sb4-04" | "sb4-05" | "sb4-06" | "sb4-08" | "sb4-09" | "sb4-10" | "sb4-11" | "sb4-12") {
  const s = createMatch({ seed: 14, playerIds: ["a", "b"], blockDensity: 0 });
  s.stage = stage;
  s.grid.tiles.fill(Tile.Empty);
  for (let x = 0; x < s.grid.width; x++) s.grid.tiles[x] = s.grid.tiles[(s.grid.height - 1) * s.grid.width + x] = Tile.Wall;
  for (let y = 0; y < s.grid.height; y++) s.grid.tiles[y * s.grid.width] = s.grid.tiles[y * s.grid.width + s.grid.width - 1] = Tile.Wall;
  return s;
}

describe("SB4 dynamic stage mechanics", () => {
  it("rolls toward the bomb after a blast and blocks fire beyond the ball", () => {
    const s = arena("sb4-03");
    s.stageState = { balls: [{ px: tileCenter(5), py: tileCenter(5), dir: null }] };
    placePlayerAt(s, "a", 3, 5);
    s.players[0]!.fireRange = 5;
    placeBomb(s, "a");
    s.bombs[0]!.fuse = 1;
    placePlayerAt(s, "a", 1, 1);
    step(s);
    expect(s.stageState.balls![0]!.dir).toBe("left");
    expect(s.flames.some(f => f.x === 6 && f.y === 5)).toBe(false);
    placePlayerAt(s, "b", 4, 5);
    for (let tick = 0; tick < 16; tick++) step(s);
    expect(s.players[1]!.alive).toBe(false);
  });

  it("blocks walking and bomb placement on a rolling ball", () => {
    const s = arena("sb4-03");
    s.stageState = { balls: [{ px: tileCenter(4), py: tileCenter(3), dir: null }] };
    placePlayerAt(s, "a", 3, 3);
    for (let tick = 0; tick < 20; tick++) step(s, { a: { dir: "right", bomb: false } });
    expect(s.players[0]!.px).toBe(tileCenter(3));
    placePlayerAt(s, "a", 4, 3);
    expect(placeBomb(s, "a")).toBe(false);
  });

  it("eliminates the owner of a burning flag on the explosion tick even when far away", () => {
    const s = arena("sb4-12");
    s.stageState = { flags: [{ x: 3, y: 3, ownerId: "b" }] };
    placePlayerAt(s, "a", 3, 3);
    placeBomb(s, "a");
    s.bombs[0]!.fuse = 1;
    placePlayerAt(s, "a", 1, 1);
    step(s);
    expect(s.players[1]!.alive).toBe(false);
    expect(s.stageState.flags![0]!.destroyed).toBe(true);
    expect(matchResult(s)).toEqual({ over: true, winnerId: "a" });
  });

  it("draws when both flags are destroyed during the same tick", () => {
    const s = arena("sb4-12");
    s.stageState = { flags: [{ x: 3, y: 3, ownerId: "a" }, { x: 9, y: 9, ownerId: "b" }] };
    for (const [id, x, y] of [["a", 3, 3], ["b", 9, 9]] as const) {
      placePlayerAt(s, id, x, y);
      placeBomb(s, id);
    }
    s.bombs.forEach(b => { b.fuse = 1; });
    placePlayerAt(s, "a", 1, 1);
    placePlayerAt(s, "b", 13, 11);
    step(s);
    expect(matchResult(s)).toEqual({ over: true, winnerId: null });
  });

  it("picks up and drops a flag without immediately picking it up again", () => {
    const s = arena("sb4-12");
    placePlayerAt(s, "a", 3, 3);
    s.stageState = { flags: [{ x: 3, y: 3, ownerId: "a" }] };
    step(s);
    expect(s.stageState.flags![0]!.carriedBy).toBe("a");
    step(s, { a: { dir: null, bomb: false, action: true } });
    expect(s.stageState.flags![0]!.carriedBy).toBeUndefined();
  });

  it("does not place bombs on slot switches", () => {
    const s = arena("sb4-08");
    placePlayerAt(s, "a", 3, 3);
    s.grid.floor[3 * s.grid.width + 3] = Floor.Slot;
    expect(placeBomb(s, "a")).toBe(false);
  });

  it("applies sticky movement once per tick and ice momentum without new input", () => {
    const s = arena("sb4-06");
    placePlayerAt(s, "a", 3, 3);
    const key = 3 * s.grid.width + 3;
    s.grid.floor[key] = Floor.Surprise;
    s.stageState = { surprise: { [key]: { kind: "sticky", hits: 1 } } };
    const p = s.players[0]!;
    const x = p.px;
    step(s, { a: { dir: "right", bomb: false } });
    expect(p.px - x).toBe(p.speed / 2);
    s.stageState.surprise![key] = { kind: "ice", hits: 2 };
    const before = p.px;
    step(s);
    expect(p.px - before).toBe(p.speed);
  });

  it("creates eight buried cosplays and no overlap with normal item bags", () => {
    const s = createMatch({ stage: "sb4-10", seed: 1, playerIds: ["a", "b"] });
    expect(s.stageState?.honey).toHaveLength(8);
    expect(s.stageState!.honey!.every(h => s.grid.tiles[h.y * s.grid.width + h.x] === Tile.Block && !s.items.some(item => item.x === h.x && item.y === h.y))).toBe(true);
    expect(publicView(s).stageState?.honey).toEqual([]);
  });

  it("runs deterministic bot matches on all twelve maps after serialization", () => {
    for (const stage of SB4_STAGES) {
      const a = createMatch({ stage, seed: 14, playerIds: ["a", "b"] });
      const b = JSON.parse(JSON.stringify(a)) as typeof a;
      const botsA = [new Bot("a", "medium"), new Bot("b", "medium")];
      const botsB = [new Bot("a", "medium"), new Bot("b", "medium")];
      for (let tick = 0; tick < 120; tick++) {
        step(a, { a: botsA[0]!.input(a), b: botsA[1]!.input(a) });
        step(b, { a: botsB[0]!.input(b), b: botsB[1]!.input(b) });
      }
      expect(b).toEqual(a);
      expect(a.players.every(p => Number.isFinite(p.px) && p.px >= 0 && p.px < a.grid.width * TILE)).toBe(true);
    }
  });

  it("does not send a bot through a pit to reach an item", () => {
    const s = arena("sb4-04");
    placePlayerAt(s, "a", 3, 3);
    s.grid.floor[3 * s.grid.width + 4] = Floor.Pit;
    s.items = [{ x: 5, y: 3, kind: ItemKind.Fire }];
    s.grid.tiles[2 * s.grid.width + 3] = Tile.Wall;
    s.grid.tiles[4 * s.grid.width + 3] = Tile.Wall;
    s.grid.tiles[3 * s.grid.width + 2] = Tile.Wall;
    const bot = new Bot("a", "hard", "collector");
    for (let tick = 0; tick < 90; tick++) step(s, { a: bot.input(s) });
    expect(s.players[0]!.alive).toBe(true);
  });
  it("falls into a pit regardless of mount, heart, fire suit and hit points", () => {
    const s = arena("sb4-04");
    const p = s.players[0]!;
    placePlayerAt(s, "a", 3, 3);
    Object.assign(p, { mount: "hopper", hasHeart: true, fireSuitTicks: 120, invuln: 100, hitPoints: 5 });
    s.grid.floor[3 * s.grid.width + 3] = Floor.Pit;
    step(s);
    expect(p.alive).toBe(false);
  });

  it("does not fall during an airborne jump", () => {
    const s = arena("sb4-04");
    const p = s.players[0]!;
    placePlayerAt(s, "a", 3, 3);
    p.jumpTicks = 5;
    s.grid.floor[3 * s.grid.width + 3] = Floor.Pit;
    updateStageMechanics(s);
    expect(p.alive).toBe(true);
  });

  it("removes grounded bombs from pits without creating an explosion", () => {
    const s = arena("sb4-04");
    placePlayerAt(s, "a", 3, 3);
    placeBomb(s, "a");
    placePlayerAt(s, "a", 1, 1);
    s.grid.floor[3 * s.grid.width + 3] = Floor.Pit;
    step(s);
    expect(s.bombs).toEqual([]);
    expect(s.flames).toEqual([]);
  });

  it("keeps buried cosplay locations out of public snapshots", () => {
    const s = arena("sb4-10");
    s.stageState = { honey: [{ x: 3, y: 3 }, { x: 5, y: 3 }, { x: 7, y: 3, takenBy: "a" }] };
    s.grid.tiles[3 * s.grid.width + 3] = Tile.Block;
    expect(publicView(s).stageState?.honey).toEqual([{ x: 5, y: 3 }]);
    expect(s.stageState.honey).toHaveLength(3);
  });

  it("collects a cosplay as one extra hit without changing character or abilities", () => {
    const s = arena("sb4-10");
    placePlayerAt(s, "a", 3, 3);
    const p = s.players[0]!;
    s.stageState = { honey: [{ x: 3, y: 3 }] };
    updateStageMechanics(s);
    expect(["honey", "kotetsu"]).toContain(p.costume);
    expect(p.character).toBe("bomb");
    expect(hurt(p)).toBe(false);
    expect(p.costume).toBeUndefined();
    expect(p.alive).toBe(true);
    p.invuln = 0;
    expect(hurt(p)).toBe(true);
  });

  it("initializes deterministic stage objects and can round-trip their state", () => {
    for (const stage of ["sb4-03", "sb4-08", "sb4-09", "sb4-11", "sb4-12"] as const) {
      const a = arena(stage);
      const b = arena(stage);
      initializeStageMechanics(a);
      initializeStageMechanics(b);
      expect(a.stageState).toEqual(b.stageState);
      expect(a.stageState).toBeDefined();
      expect(JSON.parse(JSON.stringify(a.stageState))).toEqual(a.stageState);
      expect(a.players.map(playerTile)).toEqual(b.players.map(playerTile));
    }
  });
});
