const SLOT_CALLBACKS = [
  0x15bf, 0x1526, 0x1526, 0x14f7, 0x1526, 0x14f9, 0x14f9, 0x14f7,
  0x1526, 0x14f9, 0x14f9, 0x14f7, 0x14f7, 0x14f7, 0x14f7, 0x14f7,
  0x1526, 0x14f9, 0x14f9, 0x14f7, 0x14f9, 0x16a2, 0x1662, 0x1662,
  0x14f9, 0x14d6, 0x14d6, 0x1611, 0x14f7, 0x1611, 0x1611, 0x163a,
  0x1526, 0x14f9, 0x14f9, 0x14f7, 0x14f9, 0x1662, 0x14d6, 0x1611,
  0x14f9, 0x14d6, 0x17ad, 0x1611, 0x14f7, 0x1611, 0x1611, 0x163a,
  0x14f7, 0x14f7, 0x14f7, 0x14f7, 0x14f7, 0x1662, 0x1611, 0x1611,
  0x14f7, 0x1611, 0x1611, 0x1611, 0x14f7, 0x163a, 0x163a, 0x1682,
] as const;

const SLOT_REWARDS: Readonly<Record<number, readonly number[]>> = {
  0x14d6: [13],
  0x14f7: [],
  0x14f9: [43, 36, 37],
  0x1526: [43, 36, 37],
  0x15bf: [43, 36, 37],
  0x1611: [14, 5, 5],
  0x163a: [17, 17, 17],
  0x1662: [5, 1, 3],
  0x1682: [3, 4, 3],
  0x16a2: [7, 17, 17],
  0x17ad: [1],
};

export const SB4_SLOT_JACKPOT_WAVES = [
  { at: 50, itemId: 1, count: 4 },
  { at: 115, itemId: 3, count: 4 },
  { at: 179, itemId: 17, count: 5 },
  { at: 244, itemId: 5, count: 3 },
  { at: 308, itemId: 4, count: 5 },
  { at: 375, itemId: 14, count: 3 },
  { at: 439, itemId: 7, count: 4 },
  { at: 503, itemId: 13, count: 4 },
] as const;

export const SB4_SLOT_JACKPOT_CYCLE_TICKS = 517;

export interface Sb4SlotOutcome {
  callback: number;
  itemIds: readonly number[];
  cascade: boolean;
}

export function sb4SlotOutcome(reels: readonly number[]): Sb4SlotOutcome | null {
  if (reels.length !== 3 || reels.some(value => !Number.isInteger(value) || value < 0 || value > 3)) return null;
  const index = reels[0]! * 16 + reels[1]! * 4 + reels[2]!;
  const callback = SLOT_CALLBACKS[index]!;
  return { callback, itemIds: SLOT_REWARDS[callback]!, cascade: callback === 0x17ad };
}
