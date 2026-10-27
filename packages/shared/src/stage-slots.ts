import { nextRandom } from "./rng";
import { sb4SlotOutcome } from "./sb4-slot-rom";
import { Floor, getFloor, ItemKind, playerTile, Tile, type MatchState } from "./state";
import type { StageState } from "./stage-state";

export const SLOT_SYMBOLS = ["seven", "bar", "fire", "skull"] as const;
export const SLOT_CONFIG = { timeoutTicks: 300, cooldownTicks: 180, jackpotItems: 30 };
type Symbol = (typeof SLOT_SYMBOLS)[number];
type Roulette = NonNullable<StageState["roulette"]>;
const PROVISIONAL_NATIVE_SYMBOL: Readonly<Record<Symbol, number>> = { skull: 0, bar: 1, seven: 2, fire: 3 };
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
  if (stage.roulette?.active || (stage.roulette?.cooldown ?? 0) > 0) return;
  stage.roulette = {
    cooldown: 0, until: s.tick + SLOT_CONFIG.timeoutTicks, active: true,
    reels: Array.from({ length: 3 }, () => SLOT_SYMBOLS[Math.floor(nextRandom(s) * SLOT_SYMBOLS.length)]!),
    stopped: [false, false, false],
  };
}

function payout(reels: Symbol[]): ItemKind[] {
  const outcome = sb4SlotOutcome(reels.map(symbol => PROVISIONAL_NATIVE_SYMBOL[symbol]));
  if (!outcome) return [];
  if (outcome.cascade) {
    const count = Number.isFinite(SLOT_CONFIG.jackpotItems) ? Math.max(0, Math.min(100, Math.floor(SLOT_CONFIG.jackpotItems))) : 0;
    return Array<ItemKind>(count).fill(ItemKind.Bomb);
  }
  return outcome.itemIds.map(id => PROVISIONAL_NATIVE_ITEM_KIND[id]!);
}

function dropItems(s: MatchState, kinds: ItemKind[]): void {
  const occupied = new Set([...s.items, ...s.bombs, ...s.flames].map(({ x, y }) => y * s.grid.width + x));
  const spots = s.grid.tiles.flatMap((tile, index) => tile === Tile.Empty && !occupied.has(index) ? [index] : []);
  for (const kind of kinds.slice(0, spots.length)) {
    const [index] = spots.splice(Math.floor(nextRandom(s) * spots.length), 1);
    s.items.push({ x: index! % s.grid.width, y: Math.floor(index! / s.grid.width), kind });
  }
}

function stopOnEntry(s: MatchState, roulette: Roulette): void {
  const stage = s.stageState!;
  const locks = stage.floorLocks ??= {};
  const buttons = s.grid.floor.flatMap((floor, index) => floor === Floor.Slot ? [index] : []).slice(0, 3);
  for (const player of s.players) {
    const key = `slots:entry:${player.id}`;
    if (!player.alive) { delete locks[key]; continue; }
    const { x, y } = playerTile(player);
    const tile = y * s.grid.width + x;
    const previous = locks[key];
    locks[key] = tile;
    const reel = buttons.indexOf(tile);
    if (roulette.active && previous !== tile && reel >= 0 && roulette.stopped) roulette.stopped[reel] = true;
  }
}

export function updateStageSlots(s: MatchState): void {
  if (String(s.stage) !== "sb4-08") return;
  const roulette = s.stageState?.roulette;
  if (!roulette) return;
  stopOnEntry(s, roulette);
  if (!roulette.active) {
    roulette.cooldown = Math.max(0, roulette.cooldown - 1);
    return;
  }
  if (s.tick < roulette.until && !roulette.stopped?.every(Boolean)) return;
  roulette.stopped = [true, true, true];
  roulette.active = false;
  roulette.cooldown = SLOT_CONFIG.cooldownTicks;
  delete roulette.result;
  if (roulette.reels?.length !== 3) return;
  const kinds = payout(roulette.reels);
  if (kinds[0]) roulette.result = kinds[0];
  dropItems(s, kinds);
}
