import { afterEach, describe, expect, it } from "vitest";
import { createMatch } from "../src/arena";
import { nextRandom } from "../src/rng";
import { createSb4SlotClock } from "../src/sb4-slot-clock";
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

function advance(s: MatchState, ticks: number) {
  for (let i = 0; i < ticks; i++) {
    s.tick++;
    updateStageSlots(s);
  }
}

describe("stage slots", () => {
  it("spins and stops using native reel counters rather than fixed stop timestamps", () => {
    const s = arena();
    igniteStageSlots(s, 1, 1);
    const roulette = s.stageState!.roulette!;
    expect(roulette.nativeClock).toBeDefined();
    roulette.nativeClock = createSb4SlotClock([16, 24, 16], s.tick);
    roulette.reels = ["seven", "fire", "seven"];
    updateStageSlots(s);
    expect(roulette.nativeClock.reels[0]?.counter).toBe(0);
    advance(s, 1028);
    expect(roulette.stopped).toEqual([false, true, false]);
    expect(roulette.active).toBe(true);
    advance(s, 73);
    expect(roulette.stopped).toEqual([false, true, true]);
    advance(s, 130);
    expect(roulette.stopped).toEqual([true, true, true]);
    expect(roulette.active).toBe(true);
    advance(s, 2);
    expect(roulette.active).toBe(false);
    expect(roulette.nativeClock).toBeUndefined();
    expect(roulette.reels).toEqual(["skull", "skull", "bar"]);
    expect(s.items.map(item => item.sb4Status)).toEqual([43, 36, 37]);
    updateStageSlots(s);
    expect(s.items).toHaveLength(3);
  });

  it("preserves the active native spin and its eventual payout through match serialization", () => {
    const original = arena();
    igniteStageSlots(original, 1, 1);
    advance(original, 900);
    const recovered = structuredClone(original);
    expect(recovered.stageState?.roulette?.nativeClock?.lastTick).toBe(original.tick);
    advance(original, 350);
    advance(recovered, 350);
    expect(recovered).toEqual(original);
    expect(original.stageState?.roulette?.nativeClock).toBeUndefined();
    expect(original.stageState?.roulette?.active).toBe(false);
  });

  it("streams native 7-7-7 rewards at measured wave intervals", () => {
    const s = arena();
    SLOT_CONFIG.jackpotItems = 64;
    finish(s, ["seven", "seven", "seven"]);
    expect(s.items).toHaveLength(0);
    advance(s, 49);
    expect(s.items).toHaveLength(0);
    advance(s, 1);
    expect(s.items.map(item => item.kind)).toEqual(Array(4).fill(ItemKind.Bomb));
    advance(s, 64);
    expect(s.items).toHaveLength(4);
    advance(s, 1);
    expect(s.items.slice(4).map(item => item.kind)).toEqual(Array(4).fill(ItemKind.Speed));
    advance(s, 64);
    expect(s.items.slice(8).map(item => item.kind)).toEqual(Array(5).fill(ItemKind.Bomb));
    advance(s, 65);
    expect(s.items.slice(13).map(item => item.kind)).toEqual(Array(3).fill(ItemKind.Fire));
    advance(s, 64);
    expect(s.items.slice(16).map(item => item.kind)).toEqual(Array(5).fill(ItemKind.Egg));
    advance(s, 67);
    expect(s.items.slice(21).map(item => item.kind)).toEqual(Array(3).fill(ItemKind.Punch));
    advance(s, 64);
    expect(s.items.slice(24).map(item => item.kind)).toEqual(Array(4).fill(ItemKind.Glove));
    advance(s, 64);
    expect(s.items.slice(28).map(item => item.kind)).toEqual(Array(4).fill(ItemKind.Kick));
    advance(s, 64);
    expect(s.items.slice(32).map(item => item.kind)).toEqual(Array(4).fill(ItemKind.Bomb));
  });

  it("preserves the jackpot across snapshots and blocks a second spin until the last wave", () => {
    const s = arena();
    SLOT_CONFIG.jackpotItems = 34;
    finish(s, ["seven", "seven", "seven"]);
    const resumed = structuredClone(s);
    advance(s, 375);
    advance(resumed, 375);
    expect(s).toEqual(resumed);
    igniteStageSlots(s, 1, 1);
    expect(s.stageState?.roulette?.active).toBe(false);
    expect(s.stageState?.roulette?.cascade?.issued).toBe(24);
    advance(s, 192);
    expect(s.items).toHaveLength(34);
    expect(s.stageState?.roulette?.cascade).toBeUndefined();
    igniteStageSlots(s, 1, 1);
    expect(s.stageState?.roulette?.active).toBe(true);
  });

  it("keeps 0-0-3 without a prize even with two skull symbols", () => {
    const s = arena();
    finish(s, ["skull", "skull", "fire"]);
    expect(s.items).toEqual([]);
  });

  it("pays the native 1-2-3 combination even though all symbols differ", () => {
    const s = arena();
    finish(s, ["bar", "seven", "fire"]);
    expect(s.items).toHaveLength(3);
  });

  it("does not start sudden death for native triple skull", () => {
    const s = arena();
    finish(s, ["skull", "skull", "skull"]);
    expect(s.items).toHaveLength(3);
    expect(s.items.map(item => item.sb4Status)).toEqual([43, 36, 37]);
    expect(s.pressureAt).toBe(999);
  });

  it("uses only the match PRNG to select reels", () => {
    const s = arena();
    const expected = { rng: s.rng };
    const reels = Array.from({ length: 3 }, () => SLOT_SYMBOLS[Math.floor(nextRandom(expected) * 4)]);
    igniteStageSlots(s, 1, 1);
    expect(s.stageState?.roulette?.reels).toEqual(reels);
    expect(s.rng).toBe(expected.rng);
  });

  it("stops the reels automatically in the measured native order without floor entry", () => {
    const s = arena();
    s.players = createMatch({ seed: 1, playerIds: ["a", "b"], blockDensity: 0 }).players;
    const a = s.players[0]!;
    const b = s.players[1]!;
    Object.assign(a, { px: tileCenter(3), py: tileCenter(1) });
    Object.assign(b, { px: tileCenter(1), py: tileCenter(1), alive: false });
    s.stageState = { floorLocks: { "flag:a": 500 } };
    igniteStageSlots(s, 1, 1);
    updateStageSlots(s);
    expect(s.stageState.roulette?.stopped).toEqual([false, false, false]);
    expect(s.stageState.floorLocks).toEqual({ "flag:a": 500 });
    expect(SLOT_CONFIG.timeoutTicks).toBe(1242);
    advance(s, 1027);
    expect(s.stageState.roulette?.stopped).toEqual([false, false, false]);
    advance(s, 1);
    expect(s.stageState.roulette?.stopped).toEqual([false, true, false]);
    advance(s, 73);
    expect(s.stageState.roulette?.stopped).toEqual([false, true, true]);
    advance(s, 130);
    expect(s.stageState.roulette?.stopped).toEqual([true, true, true]);
    expect(s.stageState.roulette?.active).toBe(true);
    advance(s, 2);
    expect(s.stageState.roulette?.active).toBe(false);
  });

  it("caps a configured jackpot and uses only available spaces", () => {
    const s = arena();
    SLOT_CONFIG.jackpotItems = 4;
    finish(s, ["seven", "seven", "seven"]);
    advance(s, 50);
    expect(s.items).toHaveLength(4);
    expect(new Set(s.items.map(item => `${item.x},${item.y}`)).size).toBe(4);
    const other = arena();
    SLOT_CONFIG.jackpotItems = 10000;
    finish(other, ["seven", "seven", "seven"]);
    advance(other, 2700);
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
    ["skull", 3, ItemKind.Skull], ["fire", 3, ItemKind.Speed], ["bar", 3, ItemKind.Glove], ["seven", 30, ItemKind.Bomb],
  ] as const)("pays triple %s once", (symbol, count, result) => {
    const s = arena();
    s.pressureLimit = 8;
    finish(s, [symbol, symbol, symbol]);
    expect(s.stageState?.roulette).toMatchObject({ active: false, cooldown: SLOT_CONFIG.cooldownTicks, result, stopped: [true, true, true] });
    if (symbol === "seven") advance(s, 503);
    expect(s.items).toHaveLength(count);
    expect(s.pressureAt).toBe(999);
    expect(s.pressureLimit).toBe(8);
    if (symbol === "fire") expect(s.items.map(item => item.kind)).toEqual([ItemKind.Speed, ItemKind.Egg, ItemKind.Speed]);
    if (symbol === "bar") expect(s.items.map(item => item.kind)).toEqual([ItemKind.Glove, ItemKind.Bomb, ItemKind.Bomb]);
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
    advance(s, 50);
    advance(copy, 50);
    expect(s).toEqual(copy);
    expect(s.items).toHaveLength(2);
    expect(s.items[1]).toMatchObject({ x: 4, y: 1 });
  });

  it.each([
    [["seven", "seven", "bar"], [ItemKind.Kick]],
    [["bar", "bar", "seven"], [ItemKind.Fire, ItemKind.Bomb, ItemKind.Speed]],
    [["fire", "fire", "bar"], [ItemKind.Bomb, ItemKind.Bomb, ItemKind.Bomb]],
    [["skull", "skull", "bar"], [ItemKind.Skull, ItemKind.Skull, ItemKind.Skull]],
  ] as const)("pays native double combination %j", (reels, kinds) => {
    const s = arena();
    finish(s, [...reels]);
    expect(s.items.map(item => item.kind)).toEqual(kinds);
    expect(s.pressureAt).toBe(999);
  });

  it("has no payout for native 0-1-3 and honors configurable timing", () => {
    const s = arena();
    SLOT_CONFIG.timeoutTicks = 2;
    SLOT_CONFIG.cooldownTicks = 3;
    igniteStageSlots(s, 1, 1);
    expect(s.stageState?.roulette?.until).toBe(22);
    finish(s, ["skull", "bar", "fire"]);
    expect(s.items).toEqual([]);
    igniteStageSlots(s, 1, 1);
    expect(s.stageState?.roulette?.active).toBe(false);
    for (let i = 0; i < 3; i++) { s.tick++; updateStageSlots(s); }
    igniteStageSlots(s, 1, 1);
    expect(s.stageState?.roulette?.active).toBe(true);
  });
});
