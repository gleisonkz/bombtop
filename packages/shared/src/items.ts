import { MAX_BOMB_CAPACITY, MAX_FIRE_RANGE, MAX_SPEED, SPEED_STEP } from "./constants";
import { getTile, ItemKind, playerTile, Tile, type MatchState, type Player } from "./state";

const EFFECTS: Record<ItemKind, (p: Player) => void> = {
  [ItemKind.Fire]: (p) => (p.fireRange = Math.min(p.fireRange + 1, MAX_FIRE_RANGE)),
  [ItemKind.Bomb]: (p) => (p.bombCapacity = Math.min(p.bombCapacity + 1, MAX_BOMB_CAPACITY)),
  [ItemKind.Speed]: (p) => (p.speed = Math.min(p.speed + SPEED_STEP, MAX_SPEED)),
  [ItemKind.Kick]: (p) => (p.canKick = true),
  [ItemKind.Remote]: (p) => (p.bombType = "remote"),
  [ItemKind.Pierce]: (p) => (p.bombType = "pierce"),
  [ItemKind.Punch]: (p) => (p.canPunch = true),
  [ItemKind.Glove]: (p) => (p.canGlove = true),
};

/** Living players collect any exposed item on their tile. */
export function collectItems(s: MatchState): void {
  for (const p of s.players) {
    if (!p.alive) continue;
    const { x, y } = playerTile(p);
    if (getTile(s, x, y) !== Tile.Empty) continue;
    const item = s.items.find((i) => i.x === x && i.y === y);
    if (!item) continue;
    EFFECTS[item.kind](p);
    s.items = s.items.filter((i) => i !== item);
  }
}
