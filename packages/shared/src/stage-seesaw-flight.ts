import { TILE } from "./constants";
import { cursedDirection } from "./curse";
import { playerElevated } from "./player-carry";
import type { StageFlight } from "./stage-state";
import { playerTile, tileCenter, type Facing, type MatchState, type Player, type PlayerInput } from "./state";

// stage09-launch.json: ground Y79 minus native actor Y, updates1..16.
const LIFT = [0, 0, 0, 0, 6, 10, 13, 15, 16, 16, 16, 15, 13, 10, 6, 0] as const;
export function seesawHopLift(flight: Pick<StageFlight, "ticks" | "kind"> | undefined): number {
  if (flight?.kind !== "seesaw" || !Number.isFinite(flight.ticks)) return 0;
  return LIFT[Math.max(0, Math.min(15, 16 - Math.floor(flight.ticks)))]!;
}

export function startSeesawFlight(s: MatchState, p: Player, dir: Facing): void {
  if (playerElevated(p)) return;
  const from = playerTile(p);
  p.py = tileCenter(from.y);
  const stage = s.stageState ??= {};
  (stage.flights ??= {})[p.id] = { kind: "seesaw", dir, ticks: 16, remaining: 0 };
}

export function updateSeesawFlights(s: MatchState, inputs: Record<string, PlayerInput>): { player: Player; dir: Facing }[] {
  const landed: { player: Player; dir: Facing }[] = [];
  for (const [id, flight] of Object.entries(s.stageState?.flights ?? {})) {
    if (flight.kind !== "seesaw") continue;
    const p = s.players.find(player => player.id === id);
    if (!p?.alive || playerElevated(p)) { delete s.stageState!.flights![id]; continue; }
    const age = 16 - --flight.ticks;
    const dir = cursedDirection(p, inputs[id]?.dir ?? null);
    if (!flight.steering && age >= 4 && (dir === "left" || dir === "right")) flight.steering = dir;
    else if (flight.steering && age >= 5) {
      p.px += (flight.steering === "left" ? -1 : 1) * TILE / 2;
      p.facing = flight.steering;
    }
    if (age < 15) continue;
    const tile = playerTile(p);
    const width = s.grid.width - 2;
    const x = ((tile.x - 1) % width + width) % width + 1;
    p.px = tileCenter(x);
    delete s.stageState!.flights![id];
    (s.stageState!.floorLocks ??= {})[`seesaw:land:${id}`] = s.tick;
    landed.push({ player: p, dir: flight.steering ?? flight.dir });
  }
  return landed;
}
