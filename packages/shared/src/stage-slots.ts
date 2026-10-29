import { nextRandom } from "./rng";
import { createSb4SlotClock, stepSb4SlotClock, symbolsFromSb4SlotClock } from "./sb4-slot-clock";
import { sb4SlotOutcome, SB4_SLOT_JACKPOT_CYCLE_TICKS, SB4_SLOT_JACKPOT_WAVES } from "./sb4-slot-rom";
import { Floor, getFloor, ItemKind, Tile, type MatchState, type Sb4SlotStatus } from "./state";
import type { StageState } from "./stage-state";

export const SLOT_SYMBOLS = ["seven", "bar", "fire", "skull"] as const;
const NATIVE_SPIN_TICKS = 1242;
const NATIVE_STOP_OFFSETS = [1240, 1037, 1110] as const;
export const SLOT_CONFIG = { timeoutTicks: NATIVE_SPIN_TICKS, cooldownTicks: 180, jackpotItems: 30 };
type Symbol = (typeof SLOT_SYMBOLS)[number];
type Roulette = NonNullable<StageState["roulette"]>;
type SlotReward = { kind: ItemKind; sb4Status?: Sb4SlotStatus };
const NATIVE_SYMBOL: Readonly<Record<Symbol, number>> = { skull: 0, bar: 1, seven: 2, fire: 3 };
const PROVISIONAL_NATIVE_ITEM_KIND: Readonly<Record<number, ItemKind>> = {
  1: ItemKind.Bomb,
  3: ItemKind.Speed,
  4: ItemKind.Egg,
  5: ItemKind.Fire,
  7: ItemKind.Glove,
  13: ItemKind.Kick,
  14: ItemKind.Punch,
  17: ItemKind.Bomb,
  36: ItemKind.Skull,
  37: ItemKind.Skull,
  43: ItemKind.Skull,
};

export function igniteStageSlots(s: MatchState, x: number, y: number): void {
  if (String(s.stage) !== "sb4-08" || getFloor(s, x, y) !== Floor.Slot) return;
  const stage = s.stageState ??= {};
  if (stage.roulette?.active || stage.roulette?.cascade || (stage.roulette?.cooldown ?? 0) > 0) return;
  const reels = Array.from({ length: 3 }, () => SLOT_SYMBOLS[Math.floor(nextRandom(s) * SLOT_SYMBOLS.length)]!);
  stage.roulette = {
    cooldown: 0, until: s.tick + SLOT_CONFIG.timeoutTicks, startedAt: s.tick, active: true,
    reels,
    stopped: [false, false, false],
    ...(SLOT_CONFIG.timeoutTicks === NATIVE_SPIN_TICKS
      ? { nativeClock: createSb4SlotClock(reels.map(symbol => NATIVE_SYMBOL[symbol] * 8), s.tick) }
      : {}),
  };
}

function nativeStatus(id: number): id is Sb4SlotStatus {
  return id === 36 || id === 37 || id === 43;
}

function rewardFor(id: number): SlotReward {
  return nativeStatus(id)
    ? { kind: ItemKind.Skull, sb4Status: id }
    : { kind: PROVISIONAL_NATIVE_ITEM_KIND[id]! };
}

function updateJackpot(s: MatchState, roulette: Roulette): void {
  const cascade = roulette.cascade;
  if (!cascade) return;
  while (cascade.issued < cascade.limit) {
    const wave = SB4_SLOT_JACKPOT_WAVES[cascade.waveIndex % SB4_SLOT_JACKPOT_WAVES.length]!;
    const cycle = Math.floor(cascade.waveIndex / SB4_SLOT_JACKPOT_WAVES.length);
    if (s.tick < cascade.startedAt + cycle * SB4_SLOT_JACKPOT_CYCLE_TICKS + wave.at) break;
    const count = Math.min(wave.count, cascade.limit - cascade.issued);
    dropItems(s, Array.from({ length: count }, () => rewardFor(wave.itemId)));
    cascade.issued += count;
    cascade.waveIndex++;
  }
  if (cascade.issued >= cascade.limit) delete roulette.cascade;
}

function dropItems(s: MatchState, rewards: SlotReward[]): void {
  const occupied = new Set([...s.items, ...s.bombs, ...s.flames].map(({ x, y }) => y * s.grid.width + x));
  const spots = s.grid.tiles.flatMap((tile, index) => tile === Tile.Empty && !occupied.has(index) ? [index] : []);
  for (const reward of rewards.slice(0, spots.length)) {
    const [index] = spots.splice(Math.floor(nextRandom(s) * spots.length), 1);
    s.items.push({ x: index! % s.grid.width, y: Math.floor(index! / s.grid.width), ...reward });
  }
}

function updateAutoStop(s: MatchState, roulette: Roulette): void {
  const startedAt = roulette.startedAt ?? roulette.until - SLOT_CONFIG.timeoutTicks;
  const duration = Math.max(1, roulette.until - startedAt);
  const elapsed = s.tick - startedAt;
  roulette.stopped = NATIVE_STOP_OFFSETS.map(offset => elapsed >= Math.ceil(offset * duration / NATIVE_SPIN_TICKS));
}

export function updateStageSlots(s: MatchState): void {
  if (String(s.stage) !== "sb4-08") return;
  const roulette = s.stageState?.roulette;
  if (!roulette) return;
  if (!roulette.active) {
    roulette.cooldown = Math.max(0, roulette.cooldown - 1);
    updateJackpot(s, roulette);
    return;
  }
  if (roulette.nativeClock) {
    const clock = roulette.nativeClock;
    let done = false;
    while (clock.lastTick < s.tick && !done) {
      done = stepSb4SlotClock(clock);
      clock.lastTick++;
    }
    roulette.reels = symbolsFromSb4SlotClock(clock);
    roulette.stopped = clock.reels.map(reel => reel.stopped);
    if (!done) return;
    roulette.until = s.tick;
    delete roulette.nativeClock;
  } else {
    updateAutoStop(s, roulette);
    if (s.tick < roulette.until) return;
  }
  roulette.stopped = [true, true, true];
  roulette.active = false;
  roulette.cooldown = SLOT_CONFIG.cooldownTicks;
  delete roulette.result;
  if (roulette.reels?.length !== 3) return;
  const outcome = sb4SlotOutcome(roulette.reels.map(symbol => NATIVE_SYMBOL[symbol]));
  if (!outcome) return;
  if (outcome.cascade) {
    const limit = Number.isFinite(SLOT_CONFIG.jackpotItems) ? Math.max(0, Math.min(100, Math.floor(SLOT_CONFIG.jackpotItems))) : 0;
    if (limit > 0) roulette.cascade = { startedAt: s.tick, waveIndex: 0, issued: 0, limit };
    roulette.result = ItemKind.Bomb;
    return;
  }
  const rewards = outcome.itemIds.map(rewardFor);
  if (rewards[0]) roulette.result = rewards[0].kind;
  dropItems(s, rewards);
}
