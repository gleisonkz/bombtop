import { TILE } from "./constants";
import { cursedDirection } from "./curse";
import { playerElevated } from "./player-carry";
import type { StageFlight } from "./stage-state";
import { playerTile, tileCenter, type Facing, type MatchState, type Player, type PlayerInput } from "./state";

// stage09-launch.json: ground Y79 minus native actor Y, updates1..16.
const LIFT = [0, 0, 0, 0, 6, 10, 13, 15, 16, 16, 16, 15, 13, 10, 6, 0] as const;
const REBOUND_LIFT = [0, 4, 6, 6, 6, 4, 0, 0] as const;
const REBOUND_STEP = [0, 3, 3, 3, 3, 2, 2, 0] as const;
export function seesawHopLift(flight: Pick<StageFlight, "ticks" | "kind"> | undefined): number {
  if (!flight || !Number.isFinite(flight.ticks)) return 0;
  if (flight.kind === "seesawRebound") return REBOUND_LIFT[(32 - Math.floor(flight.ticks)) & 7]!;
  if (flight.kind !== "seesaw") return 0;
  return LIFT[Math.max(0, Math.min(15, 16 - Math.floor(flight.ticks)))]!;
}

export function startSeesawFlight(s: MatchState, p: Player, dir: Facing, input?: PlayerInput): void {
  if (playerElevated(p)) return;
  const from = playerTile(p);
  p.py = tileCenter(from.y);
  const stage = s.stageState ??= {};
  const intent = cursedDirection(p, input?.dir ?? null);
  const steering = intent === "left" || intent === "right" ? intent : undefined;
  (stage.flights ??= {})[p.id] = { kind: "seesaw", dir, ticks: 16, remaining: 0,
    ...(steering ? { steering, preSteered: true as const } : {}) };
}

export function updateSeesawFlights(s: MatchState, inputs: Record<string, PlayerInput>): { player: Player; dir: Facing }[] {
  const landed: { player: Player; dir: Facing }[] = [];
  for (const [id, flight] of Object.entries(s.stageState?.flights ?? {})) {
    if (flight.kind !== "seesaw" && flight.kind !== "seesawRebound") continue;
    const p = s.players.find(player => player.id === id);
    if (!p?.alive || playerElevated(p)) { delete s.stageState!.flights![id]; continue; }
    if (flight.kind === "seesawRebound") {
      const phase = (32 - --flight.ticks) & 7;
      p.px += (flight.steering === "right" ? 1 : -1) * REBOUND_STEP[phase]! * TILE / 16;
      if (flight.ticks > 0) continue;
      const x = playerTile(p).x - Number(flight.remaining === 8 && flight.steering === "left");
      p.px = tileCenter(x);
      delete s.stageState!.flights![id];
      (s.stageState!.floorLocks ??= {})[`seesaw:land:${id}`] = s.tick;
      landed.push({ player: p, dir: flight.steering ?? flight.dir });
      continue;
    }
    const age = 16 - --flight.ticks;
    const dir = cursedDirection(p, inputs[id]?.dir ?? null);
    if (!flight.steering && age >= 4 && (dir === "left" || dir === "right")) flight.steering = dir;
    else if (flight.steering && age >= (flight.preSteered ? 4 : 5)) {
      p.px += (flight.steering === "left" ? -1 : 1) * TILE / 2;
      p.facing = flight.steering;
    }
    const advancedNativeX = Math.round(p.px / TILE * 16 + 7);
    if (flight.steering === "right" && advancedNativeX >= 272) p.px = (advancedNativeX - 272 - 7) * TILE / 16;
    if (age < 15) continue;
    const nativeX = Math.round(p.px / TILE * 16 + 7);
    if (flight.steering === "right" && nativeX < 32) {
      flight.kind = "seesawRebound";
      flight.ticks = 24;
      continue;
    }
    if (flight.steering === "left" && nativeX < 0) {
      const wrappedX = ((nativeX + 16) % 256 + 256) % 256;
      p.px = (wrappedX - 7) * TILE / 16;
      flight.kind = "seesawRebound";
      flight.ticks = 32;
      continue;
    }
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

export function startSeesawRebounds(s: MatchState, inputs: Record<string, PlayerInput>): void {
  const stage = s.stageState;
  if (!stage?.seesaws?.length) return;
  const flights = stage.flights ??= {};
  for (const saw of stage.seesaws) {
    if (saw.dir !== "right") continue;
    for (const p of s.players) {
      if (!p.alive || playerElevated(p) || p.jumpTicks || flights[p.id] || p.py !== tileCenter(saw.y)) continue;
      const direction = cursedDirection(p, inputs[p.id]?.dir ?? null);
      const fromLeft = direction === "right" && p.px === tileCenter(saw.x - 1) + 9 * TILE / 16;
      const fromRight = direction === "left" && p.px === tileCenter(saw.x + 1) - 8 * TILE / 16;
      if (!fromLeft && !fromRight) continue;
      const steering = fromLeft ? "right" : "left";
      flights[p.id] = { kind: "seesawRebound", dir: steering, steering, ticks: 8, remaining: 8 };
    }
  }
}
