import {
  BASE_SPEED,
  MAX_BOMB_CAPACITY,
  MAX_FIRE_RANGE,
  MAX_SPEED,
  SPECIAL_STUN_TICKS,
  FIRE_SUIT_TICKS,
  SPEED_STEP,
  START_BOMB_CAPACITY,
  START_FIRE_RANGE,
} from "./constants";
import { applyRandomCurse } from "./curse";
import { giveRandomMount } from "./mount";
import { nextRandom } from "./rng";
import { bombAt, getTile, hasFlame, ItemKind, playerTile, Tile, type MatchState, type Player } from "./state";

const EFFECTS: Record<ItemKind, (p: Player, s: MatchState) => void> = {
  [ItemKind.Fire]: (p) => (p.fireRange = Math.min(p.fireRange + 1, MAX_FIRE_RANGE)),
  [ItemKind.Bomb]: (p) => (p.bombCapacity = Math.min(p.bombCapacity + 1, MAX_BOMB_CAPACITY)),
  [ItemKind.Speed]: (p) => (p.speed = Math.min(p.speed + SPEED_STEP, MAX_SPEED)),
  [ItemKind.Kick]: (p) => {
    p.canKick = true;
    p.canBombPass = false;
  },
  [ItemKind.BombPass]: (p) => {
    p.canBombPass = true;
    p.canKick = false;
  },
  [ItemKind.BlockPass]: (p) => (p.canBlockPass = true),
  [ItemKind.FireSuit]: (p) => (p.fireSuitTicks = FIRE_SUIT_TICKS),
  [ItemKind.Heart]: (p) => (p.hasHeart = true),
  [ItemKind.Remote]: (p) => (p.bombType = "remote"),
  [ItemKind.Pierce]: (p) => (p.bombType = "pierce"),
  [ItemKind.Punch]: (p) => (p.canPunch = true),
  [ItemKind.Push]: (p) => (p.canPush = true),
  [ItemKind.Glove]: (p) => (p.canGlove = true),
  [ItemKind.Skull]: (p, s) => applyRandomCurse(s, p),
  [ItemKind.FullFire]: (p) => (p.fireRange = MAX_FIRE_RANGE),
  [ItemKind.Egg]: (p, s) => giveRandomMount(s, p),
  [ItemKind.Picanha]: (p) => (p.stun = SPECIAL_STUN_TICKS),
};

/** Living players collect any exposed item on their tile. */
export function collectItems(s: MatchState): void {
  for (const p of s.players) {
    if (!p.alive) continue;
    const { x, y } = playerTile(p);
    if (getTile(s, x, y) !== Tile.Empty) continue;
    const item = s.items.find((i) => i.x === x && i.y === y);
    if (!item || item.owner === p.id) continue;
    if (item.kind !== ItemKind.Skull && item.kind !== ItemKind.Picanha) p.curse = null; // any other item cures a curse
    EFFECTS[item.kind](p, s);
    s.items = s.items.filter((i) => i !== item);
  }
}

/** The power-ups a player is carrying, read off their stats (full fire counts as plain fire). */
function carried(p: Player): ItemKind[] {
  const n = (count: number, kind: ItemKind) => Array<ItemKind>(Math.max(0, count)).fill(kind);
  return [
    ...n(p.fireRange - START_FIRE_RANGE, ItemKind.Fire),
    ...n(p.bombCapacity - START_BOMB_CAPACITY, ItemKind.Bomb),
    ...n(Math.floor((p.speed - BASE_SPEED) / SPEED_STEP), ItemKind.Speed),
    ...(p.canKick ? [ItemKind.Kick] : []),
    ...(p.canBombPass ? [ItemKind.BombPass] : []),
    ...(p.canBlockPass ? [ItemKind.BlockPass] : []),
    ...(p.hasHeart ? [ItemKind.Heart] : []),
    ...(p.canPunch ? [ItemKind.Punch] : []),
    ...(p.canPush ? [ItemKind.Push] : []),
    ...(p.canGlove ? [ItemKind.Glove] : []),
    ...(p.bombType === "remote" ? [ItemKind.Remote] : p.bombType === "pierce" ? [ItemKind.Pierce] : []),
  ];
}

/**
 * A player who just died scatters the power-ups they carried onto random open floor
 * (no block, bomb, flame, item or living player), and is left with the starting stats.
 */
export function dropItems(s: MatchState, p: Player): void {
  const drops = carried(p);
  p.fireRange = START_FIRE_RANGE;
  p.bombCapacity = START_BOMB_CAPACITY;
  p.speed = BASE_SPEED;
  p.canKick = p.canPunch = p.canGlove = false;
  p.canBombPass = p.canBlockPass = false;
  p.hasHeart = false;
  p.fireSuitTicks = 0;
  if (p.canPush) p.canPush = false;
  p.bombType = "normal";
  const taken = (x: number, y: number) =>
    s.items.some((i) => i.x === x && i.y === y) ||
    s.players.some((o) => o.alive && playerTile(o).x === x && playerTile(o).y === y);
  const open: { x: number; y: number }[] = [];
  for (let y = 0; y < s.grid.height; y++)
    for (let x = 0; x < s.grid.width; x++)
      if (getTile(s, x, y) === Tile.Empty && !hasFlame(s, x, y) && !bombAt(s, x, y) && !taken(x, y)) open.push({ x, y });
  for (const kind of drops) {
    if (open.length === 0) return;
    const [spot] = open.splice(Math.floor(nextRandom(s) * open.length), 1);
    s.items.push({ ...spot!, kind });
  }
}
