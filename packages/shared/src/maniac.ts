import { ItemKind } from "./state";

export const MANIAC_ITEM_KINDS = [
  ItemKind.Bomb, ItemKind.Fire, ItemKind.FullFire, ItemKind.Speed, ItemKind.Egg,
  ItemKind.Glove, ItemKind.Punch, ItemKind.Push, ItemKind.Kick, ItemKind.BombPass,
  ItemKind.BlockPass, ItemKind.Pierce, ItemKind.FireSuit, ItemKind.Heart, ItemKind.Skull,
] as const;

export type ManiacItemKind = (typeof MANIAC_ITEM_KINDS)[number];
export const MAX_MANIAC_ITEMS = 60;
export const MAX_MANIAC_PER_KIND = 9;
export const MIN_MANIAC_HP = 1;
export const MAX_MANIAC_HP = 5;

export interface ManiacConfig {
  items: Partial<Record<ManiacItemKind, number>>;
  hitPoints: Record<string, number>;
}

export function normalizeManiac(raw: unknown, playerIds: readonly string[]): ManiacConfig | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (Object.keys(value).some((key) => key !== "items" && key !== "hitPoints")) return null;
  const items = value.items ?? {};
  const hitPoints = value.hitPoints ?? {};
  if (!items || typeof items !== "object" || Array.isArray(items)) return null;
  if (!hitPoints || typeof hitPoints !== "object" || Array.isArray(hitPoints)) return null;
  const itemKinds = new Set<string>(MANIAC_ITEM_KINDS);
  const counts: ManiacConfig["items"] = {};
  let total = 0;
  for (const [kind, amount] of Object.entries(items)) {
    if (!itemKinds.has(kind) || typeof amount !== "number" || !Number.isSafeInteger(amount) || amount < 0 || amount > MAX_MANIAC_PER_KIND) return null;
    total += amount;
    if (total > MAX_MANIAC_ITEMS) return null;
    if (amount > 0) counts[kind as ManiacItemKind] = amount;
  }
  const playerSet = new Set(playerIds);
  const hp: Record<string, number> = Object.create(null);
  for (const [id, amount] of Object.entries(hitPoints)) {
    if (!playerSet.has(id) || typeof amount !== "number" || !Number.isSafeInteger(amount) || amount < MIN_MANIAC_HP || amount > MAX_MANIAC_HP) return null;
  }
  for (const id of playerIds) hp[id] = (hitPoints as Record<string, number>)[id] ?? MIN_MANIAC_HP;
  return { items: counts, hitPoints: hp };
}
