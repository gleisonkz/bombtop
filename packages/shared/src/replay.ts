import { createMatch, type MatchOptions } from "./arena";
import type { BotLevel } from "./bot";
import type { BattleTeam } from "./protocol";
import { TILE } from "./constants";
import type { CharacterId, MatchState, PlayerInput } from "./state";
import { step } from "./step";

/**
 * A round, recorded so it can be played back exactly: the simulation is deterministic, so its options (seed
 * included) and every input fed to `step` are enough. Bots' moves are kept as inputs, so a replay holds even after
 * the bots change. Inputs are kept only when they change (a player keeps the last one).
 */
export interface Replay {
  v: 1;
  /** What `createMatch` was given (`ownColors` as a list). */
  options: Omit<MatchOptions, "ownColors"> & { ownColors?: string[] };
  players: { id: string; name: string; character: CharacterId; bot?: BotLevel }[];
  /** Round of the set (1 for the first). */
  round: number;
  /** `[tick, playerId, input]`: from this tick (the match's tick before its step) on, the player's input; null = none. */
  inputs: [number, string, PlayerInput | null][];
  /** `[tick, pressureAt]`: sudden death moved up (once only bots were left), before that tick's step. */
  pressure: [number, number][];
  /** `[tick, playerId]`: left the room, before that tick's step. */
  leaves: [number, string][];
  /** Steps played. */
  ticks: number;
  /** How the round ended, when it did. */
  result?: { over: true; winnerId: string | null; winnerTeam?: BattleTeam | null };
}

/** Records a round as it is played (BattleSession keeps one per round). */
export class ReplayRecorder {
  private readonly last = new Map<string, string>();
  readonly replay: Replay;

  constructor(options: MatchOptions, players: Replay["players"], round: number) {
    const { ownColors, ...rest } = options;
    this.replay = {
      v: 1,
      options: { ...rest, ...(ownColors && { ownColors: [...ownColors] }) },
      players,
      round,
      inputs: [],
      pressure: [],
      leaves: [],
      ticks: 0,
    };
  }

  /** The inputs about to be stepped with, at the match's tick before the step. */
  step(tick: number, inputs: Record<string, PlayerInput>): void {
    for (const { id } of this.replay.players) {
      const input = inputs[id] ?? null;
      const key = JSON.stringify(input);
      if (this.last.get(id) === key) continue;
      this.last.set(id, key);
      this.replay.inputs.push([tick, id, input && structuredClone(input)]);
    }
    this.replay.ticks = tick + 1;
  }

  pressure(tick: number, at: number): void {
    this.replay.pressure.push([tick, at]);
  }

  leave(tick: number, id: string): void {
    this.replay.leaves.push([tick, id]);
  }
}

/** Plays a replay back up to `until` steps (all of it by default): the match as it was then. */
export function replayMatch(r: Replay, until = r.ticks, each?: (s: MatchState) => void): MatchState {
  const s = createMatch(r.options);
  const current: Record<string, PlayerInput | null> = {};
  let i = 0;
  for (let t = 0; t < Math.min(until, r.ticks); t++) {
    for (const [tick, id] of r.leaves) {
      if (tick !== s.tick) continue;
      const p = s.players.find((p) => p.id === id);
      if (p) {
        p.alive = false;
        p.cart = null;
      }
    }
    for (const [tick, at] of r.pressure) if (tick === s.tick) s.pressureAt = at;
    while (i < r.inputs.length && r.inputs[i]![0] <= s.tick) {
      const [, id, input] = r.inputs[i++]!;
      current[id] = input;
    }
    const inputs: Record<string, PlayerInput> = {};
    for (const [id, input] of Object.entries(current)) if (input) inputs[id] = structuredClone(input);
    step(s, inputs);
    each?.(s);
  }
  return s;
}

/** Something that happened in a replayed round, for reading it without the raw state. */
export interface ReplayEvent {
  /** The match's tick after the step it happened in (60 a second). */
  tick: number;
  who: string;
  what: "bomba" | "morreu" | "especial" | "atordoado" | "item" | "erguido";
  x: number;
  y: number;
  detail?: string;
}

/** Plays a replay back and lists what happened: bombs placed, items taken, specials, stuns, lifts, deaths. */
export function replayEvents(r: Replay): ReplayEvent[] {
  const events: ReplayEvent[] = [];
  let before: { players: Map<string, { alive: boolean; cooldown: number; stun: number; held: boolean }>; bombs: Set<string>; items: Map<string, string> } | null = null;
  const tileOf = (p: { px: number; py: number }) => ({ x: Math.floor(p.px / TILE), y: Math.floor(p.py / TILE) });
  const look = (s: MatchState) => ({
    players: new Map(s.players.map((p) => [p.id, { alive: p.alive, cooldown: p.specialCooldown, stun: p.stun, held: !!p.heldBy }])),
    bombs: new Set(s.bombs.map((b) => `${b.ownerId}@${b.x},${b.y}`)),
    items: new Map(s.items.map((i) => [`${i.x},${i.y}`, String(i.kind)])),
  });
  replayMatch(r, r.ticks, (s) => {
    const now = look(s);
    const was = before ?? { players: new Map(), bombs: new Set<string>(), items: new Map<string, string>() };
    for (const key of now.bombs) {
      if (was.bombs.has(key)) continue;
      const [who, at] = key.split("@") as [string, string];
      const [x, y] = at.split(",").map(Number) as [number, number];
      events.push({ tick: s.tick, who, what: "bomba", x, y });
    }
    for (const p of s.players) {
      const a = was.players.get(p.id);
      const { x, y } = tileOf(p);
      const at = { tick: s.tick, who: p.id, x, y };
      if (a?.alive && !p.alive) events.push({ ...at, what: "morreu" });
      if (a && p.specialCooldown > a.cooldown) events.push({ ...at, what: "especial" });
      if (a && p.stun > 0 && a.stun === 0) events.push({ ...at, what: "atordoado" });
      if (a && !a.held && p.heldBy) events.push({ ...at, what: "erguido", detail: p.heldBy });
      const item = was.items.get(`${x},${y}`);
      if (p.alive && item && !now.items.has(`${x},${y}`)) events.push({ ...at, what: "item", detail: item });
    }
    before = now;
  });
  return events;
}
