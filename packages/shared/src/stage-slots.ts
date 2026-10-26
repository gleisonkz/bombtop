import { nextRandom } from "./rng";
import { Floor, getFloor, ItemKind, playerTile, Tile, type MatchState } from "./state";
import type { StageState } from "./stage-state";

export const SLOT_SYMBOLS = ["seven", "bar", "fire", "skull"] as const;
export const SLOT_CONFIG = { timeoutTicks: 300, cooldownTicks: 180, jackpotItems: 30 };
type Symbol = (typeof SLOT_SYMBOLS)[number];
type Roulette = NonNullable<StageState["roulette"]>;
const GOOD_ITEMS = [ItemKind.Bomb, ItemKind.Fire, ItemKind.Speed, ItemKind.Kick, ItemKind.Heart, ItemKind.Glove, ItemKind.Punch, ItemKind.Remote];

/** Approximate gameplay table, NOT a claim of original SB4 payout fidelity.
 * Exactly two: seven -> 3 Bomb, bar -> 3 Speed, fire -> 3 Fire, skull -> 1 Skull.
 * Three distinct symbols pay nothing. Only triple skull starts sudden death.
 */
const DOUBLE_PAYOUT: Record<Symbol, { kind: ItemKind; count: number }> = {
  seven: { kind: ItemKind.Bomb, count: 3 }, bar: { kind: ItemKind.Speed, count: 3 },
  fire: { kind: ItemKind.Fire, count: 3 }, skull: { kind: ItemKind.Skull, count: 1 },
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

function payout(s: MatchState, reels: Symbol[]): ItemKind[] {
  const counts = new Map<Symbol, number>();
  for (const symbol of reels) counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
  const triple = reels[0];
  if (triple && counts.get(triple) === 3) {
    switch (triple) {
      case "skull":
        s.pressureAt = s.tick;
        delete s.pressureLimit;
        return Array<ItemKind>(3).fill(ItemKind.Skull);
      case "fire": return Array.from({ length: 9 }, (_, i) => i === 8 ? ItemKind.FullFire : ItemKind.Fire);
      case "bar": return [ItemKind.Egg, ...Array.from({ length: 18 }, () => GOOD_ITEMS[Math.floor(nextRandom(s) * GOOD_ITEMS.length)]!)];
      case "seven": {
        // Keep mutable configuration finite and bounded even if configured incorrectly.
        const count = Number.isFinite(SLOT_CONFIG.jackpotItems) ? Math.max(0, Math.min(100, Math.floor(SLOT_CONFIG.jackpotItems))) : 0;
        return Array.from({ length: count }, () => ItemKind.Bomb);
      }
    }
  }
  for (const [symbol, count] of counts) {
    if (count === 2) return Array<ItemKind>(DOUBLE_PAYOUT[symbol].count).fill(DOUBLE_PAYOUT[symbol].kind);
  }
  return [];
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
  const kinds = payout(s, roulette.reels);
  if (kinds[0]) roulette.result = kinds[0];
  dropItems(s, kinds);
}
