import { SB4_FLAG_SPAWNS } from "./sb4-stage-definitions";
import { playerElevated } from "./player-carry";
import type { StageFlag } from "./stage-state";
import { getTile, playerTile, Tile, type MatchState, type Player, type PlayerInput } from "./state";

export function initializeStageFlags(s: MatchState): void {
  if (s.stage !== "sb4-12") return;
  (s.stageState ??= {}).flags = s.players.map((p, seat) => ({ ...SB4_FLAG_SPAWNS[seat]!, ownerId: p.id }));
}

export function carriesStageFlag(s: MatchState, id: string): boolean {
  return !!s.stageState?.flags?.some(flag => flag.carriedBy === id && !flag.destroyed);
}

export function flagPickupBlocksInput(s: Pick<MatchState, "stage" | "stageState" | "tick">, p: Player): boolean {
  if (s.stage !== "sb4-12") return false;
  const until = s.stageState?.flagPickupUntil?.[p.id];
  if (until === undefined) return false;
  if (s.tick >= until) {
    delete s.stageState!.flagPickupUntil![p.id];
    return false;
  }
  // Native pickup at t9: last ordinary move t10, animation holds t11..18.
  return s.tick >= until - 8;
}

export function stageFlagInput(s: MatchState, p: Player, input?: PlayerInput): boolean {
  if (flagPickupBlocksInput(s, p)) return true;
  if (s.stage !== "sb4-12" || !input?.brace) return false;
  const carried = s.stageState?.flags?.find(flag => flag.carriedBy === p.id && !flag.destroyed);
  if (!carried) return false;
  Object.assign(carried, playerTile(p));
  carried.droppedBy = p.id;
  if (s.stageState?.flagPickupUntil) delete s.stageState.flagPickupUntil[p.id];
  delete carried.carriedBy;
  return true;
}

export function updateStageFlags(s: MatchState): void {
  for (const flag of s.stageState?.flags ?? []) {
    if (flag.destroyed) continue;
    followCarrier(s, flag);
    if (burnFlag(s, flag)) continue;
    if (flag.carriedBy) continue;
    const dropper = s.players.find(p => p.id === flag.droppedBy);
    if (!dropper?.alive || !atFlag(dropper, flag)) delete flag.droppedBy;
    const p = s.players.find(player => {
      return player.alive && !playerElevated(player) && player.id !== flag.droppedBy && atFlag(player, flag) && !carriesStageFlag(s, player.id);
    });
    if (p) {
      flag.carriedBy = p.id;
      (s.stageState!.flagPickupUntil ??= {})[p.id] = s.tick + 10;
    }
  }
}

function atFlag(p: Player, flag: StageFlag): boolean {
  const tile = playerTile(p);
  return tile.x === flag.x && tile.y === flag.y;
}

function followCarrier(s: MatchState, flag: StageFlag): void {
  const carrier = s.players.find(p => p.id === flag.carriedBy);
  if (!carrier) return;
  Object.assign(flag, playerTile(carrier));
  if (!carrier.alive) delete flag.carriedBy;
}

function burnFlag(s: MatchState, flag: StageFlag): boolean {
  if (getTile(s, flag.x, flag.y) !== Tile.Wall && !s.flames.some(f => f.x === flag.x && f.y === flag.y)) return false;
  flag.destroyed = true;
  delete flag.carriedBy;
  delete flag.droppedBy;
  const owner = s.players.find(p => p.id === flag.ownerId);
  if (owner) owner.alive = false;
  return true;
}
