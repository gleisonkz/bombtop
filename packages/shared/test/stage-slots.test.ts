import { afterEach, describe, expect, it } from "vitest";
import { createMatch } from "../src/arena";
import { nextRandom } from "../src/rng";
import { Floor, ItemKind, Tile, tileCenter, type MatchState } from "../src/state";
import { igniteStageSlots, updateStageSlots, SLOT_CONFIG, SLOT_SYMBOLS } from "../src/stage-slots";

const defaults = { ...SLOT_CONFIG };
afterEach(() => Object.assign(SLOT_CONFIG, defaults));

function arena(): MatchState {
  return {
    tick: 20, stage: "sb4-08", rng: 14, pressure: 0, pressureAt: 999,
    revenge: false, grid: { width: 10, height: 10, tiles: Array<Tile>(100).fill(Tile.Empty),
      floor: Array.from({ length: 100 }, (_, i) => [11, 13, 31].includes(i) ? Floor.Slot : Floor.Normal), warps: [] },
    players: [], bombs: [], flames: [], items: [], blasts: [],
  };
}

function finish(s: MatchState, reels: NonNullable<NonNullable<NonNullable<MatchState["stageState"]>["roulette"]>["reels"]>) {
  s.stageState = { roulette: { cooldown: 0, until: s.tick, active: true, reels, stopped: [false, false, false] } };
  updateStageSlots(s);
}

describe("stage slots", () => {
  it("uses only the match PRNG to select reels", () => {
    const s = arena();
    const expected = { rng: s.rng };
    const reels = Array.from({ length: 3 }, () => SLOT_SYMBOLS[Math.floor(nextRandom(expected) * 4)]);
    igniteStageSlots(s, 1, 1);
    expect(s.stageState?.roulette?.reels).toEqual(reels);
    expect(s.rng).toBe(expected.rng);
  });

  it("maps entries to row-major reels, ignores dead players, and preserves other locks", () => {
    const s = arena();
    s.players = createMatch({ seed: 1, playerIds: ["a", "b"], blockDensity: 0 }).players;
    const a = s.players[0]!;
    const b = s.players[1]!;
    Object.assign(a, { px: tileCenter(3), py: tileCenter(1) });
    Object.assign(b, { px: tileCenter(1), py: tileCenter(1), alive: false });
    s.stageState = { floorLocks: { "flag:a": 500 } };
    igniteStageSlots(s, 1, 1);
    updateStageSlots(s);
    expect(s.stageState.roulette?.stopped).toEqual([false, true, false]);
    expect(s.stageState.floorLocks?.["flag:a"]).toBe(500);
    expect(s.stageState.floorLocks?.["slots:entry:a"]).toBe(13);
    expect(s.stageState.floorLocks?.["slots:entry:b"]).toBeUndefined();
    s.stageState.roulette!.stopped![1] = false;
    updateStageSlots(s);
    expect(s.stageState.roulette?.stopped).toEqual([false, false, false]);
    a.px = tileCenter(4);
    updateStageSlots(s);
    a.px = tileCenter(3);
    updateStageSlots(s);
    expect(s.stageState.roulette?.stopped).toEqual([false, true, false]);
    Object.assign(a, { px: tileCenter(1), py: tileCenter(3) });
    updateStageSlots(s);
    expect(s.stageState.roulette?.stopped).toEqual([false, true, true]);
    a.py = tileCenter(1);
    updateStageSlots(s);
    expect(s.stageState.roulette?.active).toBe(false);
  });

  it("caps a configured jackpot and uses only available spaces", () => {
    const s = arena();
    SLOT_CONFIG.jackpotItems = 4;
    finish(s, ["seven", "seven", "seven"]);
    expect(s.items).toHaveLength(4);
    expect(new Set(s.items.map(item => `${item.x},${item.y}`)).size).toBe(4);
    const other = arena();
    SLOT_CONFIG.jackpotItems = 10000;
    finish(other, ["seven", "seven", "seven"]);
    expect(other.items).toHaveLength(100);
  });

  it("only ignites slot floors in sb4-08 and starts three reels once", () => {
    const s = arena();
    igniteStageSlots(s, 0, 0);
    expect(s.stageState).toBeUndefined();
    s.stage = "sb4-01";
    igniteStageSlots(s, 1, 1);
    expect(s.stageState).toBeUndefined();
    s.stage = "sb4-08";
    igniteStageSlots(s, 1, 1);
    expect(s.stageState?.roulette).toMatchObject({ active: true, until: 20 + SLOT_CONFIG.timeoutTicks, stopped: [false, false, false] });
    expect(s.stageState?.roulette?.reels).toHaveLength(3);
    expect(s.stageState?.roulette?.reels?.every(symbol => SLOT_SYMBOLS.includes(symbol))).toBe(true);
    const snapshot = structuredClone(s);
    igniteStageSlots(s, 3, 1);
    expect(s).toEqual(snapshot);
  });

  it.each([
    ["skull", 3, ItemKind.Skull], ["fire", 9, ItemKind.Fire], ["bar", 19, ItemKind.Egg], ["seven", 30, ItemKind.Bomb],
  ] as const)("pays triple %s once", (symbol, count, result) => {
    const s = arena();
    s.pressureLimit = 8;
    finish(s, [symbol, symbol, symbol]);
    expect(s.items).toHaveLength(count);
    expect(s.stageState?.roulette).toMatchObject({ active: false, cooldown: SLOT_CONFIG.cooldownTicks, result, stopped: [true, true, true] });
    if (symbol === "skull") { expect(s.pressureAt).toBe(s.tick); expect(s.pressureLimit).toBeUndefined(); }
    if (symbol === "fire") expect(s.items.every(item => item.kind === ItemKind.Fire || item.kind === ItemKind.FullFire)).toBe(true);
    if (symbol === "bar") { expect(s.items.filter(item => item.kind === ItemKind.Egg)).toHaveLength(1); expect(s.items.every(item => item.kind !== ItemKind.Skull)).toBe(true); }
    updateStageSlots(s);
    expect(s.items).toHaveLength(count);
  });

  it("replays deterministically and respects occupancy and available capacity", () => {
    const s = arena();
    s.grid.tiles.fill(Tile.Wall);
    for (const index of [11, 12, 13, 14]) s.grid.tiles[index] = Tile.Empty;
    s.items.push({ x: 1, y: 1, kind: ItemKind.Speed });
    s.flames.push({ x: 2, y: 1, ttl: 2 });
    s.bombs.push({ x: 3, y: 1, ownerId: "a", fuse: 20, range: 2, type: "normal", slide: null, offset: 0, air: null, heldBy: null });
    const copy = structuredClone(s);
    finish(s, ["seven", "seven", "seven"]);
    finish(copy, ["seven", "seven", "seven"]);
    expect(s).toEqual(copy);
    expect(s.items).toHaveLength(2);
    expect(s.items[1]).toMatchObject({ x: 4, y: 1 });
  });

  it.each([
    ["seven", ItemKind.Bomb, 3], ["bar", ItemKind.Speed, 3], ["fire", ItemKind.Fire, 3], ["skull", ItemKind.Skull, 1],
  ] as const)("uses the approximate double %s table", (symbol, kind, count) => {
    const s = arena();
    finish(s, [symbol, symbol, symbol === "bar" ? "seven" : "bar"]);
    expect(s.items).toHaveLength(count);
    expect(s.items.every(item => item.kind === kind)).toBe(true);
    expect(s.pressureAt).toBe(999);
  });

  it("has no payout for distinct symbols and honors configurable timing", () => {
    const s = arena();
    SLOT_CONFIG.timeoutTicks = 2;
    SLOT_CONFIG.cooldownTicks = 3;
    igniteStageSlots(s, 1, 1);
    expect(s.stageState?.roulette?.until).toBe(22);
    finish(s, ["seven", "bar", "fire"]);
    expect(s.items).toEqual([]);
    igniteStageSlots(s, 1, 1);
    expect(s.stageState?.roulette?.active).toBe(false);
    for (let i = 0; i < 3; i++) { s.tick++; updateStageSlots(s); }
    igniteStageSlots(s, 1, 1);
    expect(s.stageState?.roulette?.active).toBe(true);
  });
});
