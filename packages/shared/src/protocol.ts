import { BOT_LEVELS, type BotLevel, type BotPersona } from "./bot";
import type { MatchResult } from "./pressure";
import { CHARACTERS, type CharacterId, type Direction, type PlayerInput } from "./state";
import type { StageId } from "./stage";
import type { StageRotationEntry } from "./stage-rotation";
import type { ManiacConfig } from "./maniac";
import type { PublicView } from "./view";

/** Room name registered on the server. */
export const ROOM_NAME = "battle";

export type RoomPhase = "lobby" | "playing" | "results";
export type BattleTimeMinutes = 1 | 2 | 3 | 5 | null;
export type BattleMode = "single" | "tag" | "maniac";
export type BattleTeam = "red" | "blue";

/**
 * Client -> server message types. `sync` asks for the current lobby (and
 * snapshot, mid-match): send it once message handlers are attached, since
 * anything broadcast before that is dropped by the SDK.
 */
export const C2S = {
  input: "input",
  start: "start",
  rules: "rules",
  sync: "sync",
  addBot: "addBot",
  removeBot: "removeBot",
  character: "character",
  team: "team",
  /** A guest in the lobby is ready to play, or not yet: `{ ready }`. */
  ready: "ready",
  /** The host has a bot play another character: `{ id, character }`. */
  botCharacter: "botCharacter",
  /** Connection measurements from a ?debug client, logged on the server. */
  stats: "stats",
  /** Nothing to do: sent during a match when the client has been quiet, so a phone's Wi-Fi radio doesn't doze. */
  beat: "beat",
} as const;

/** Server -> client message types. */
export const S2C = { lobby: "lobby", snapshot: "snapshot", delta: "delta", result: "result" } as const;

export interface LobbyMember {
  id: string;
  name: string;
  wins: number;
  connected: boolean;
  character: CharacterId;
  team?: BattleTeam;
  /** A guest who said they are ready; the host can start once every connected guest is. */
  ready?: true;
  /** Wears the character's original colors (first to pick it, see `firstPickers`); otherwise the seat color. */
  ownColors?: true;
  /** Set for computer players: their difficulty. */
  bot?: BotLevel;
  /** Computer players: their personality (what they go for, how careful they are). */
  persona?: BotPersona;
}

export interface LobbyInfo {
  phase: RoomPhase;
  hostId: string | null;
  members: LobbyMember[];
  stage: StageId;
  stageRotation?: StageRotationEntry[];
  winsToWin: number;
  timeMinutes: BattleTimeMinutes;
  suddenDeath: boolean;
  battleMode?: BattleMode;
  maniac?: ManiacConfig;
  /** Room id; doubles as the private-room code. */
  code: string;
  /** Screens watching without a seat (TV mode). */
  watchers?: number;
}

/** A round's end; `setOver` when its winner has won the match (the room goes back to the lobby). */
export type ResultMessage = MatchResult & { over: true; setOver: boolean; winnerTeam?: BattleTeam | null };

const DIRS = new Set<Direction>(["up", "down", "left", "right"]);

/** Validates untrusted input from the network. */
export function sanitizeInput(raw: unknown): PlayerInput {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const dir = DIRS.has(r.dir as Direction) ? (r.dir as Direction) : null;
  const input: PlayerInput = { dir, bomb: r.bomb === true, action: r.action === true };
  if (r.special === true) input.special = true;
  if (r.hold === true) input.hold = true;
  if (r.brace === true) input.brace = true;
  if (r.stopKick === true) input.stopKick = true;
  if (dir && DIRS.has(r.alt as Direction) && r.alt !== dir) input.alt = r.alt as Direction;
  return input;
}

/** Sequence number the client stamps on each input message (for prediction). */
export function inputSeq(raw: unknown): number {
  const seq = (raw as { seq?: unknown } | null)?.seq;
  return Number.isSafeInteger(seq) && (seq as number) >= 0 ? (seq as number) : 0;
}

/** Client tick the input was made on (lets the server keep the client's timing), if valid. */
export function inputTick(raw: unknown): number | undefined {
  const t = (raw as { t?: unknown } | null)?.t;
  return Number.isSafeInteger(t) && (t as number) >= 0 ? (t as number) : undefined;
}

/**
 * Per player: the last input message the server has applied, and for how many
 * ticks. The owner's client replays its newer inputs on top of the snapshot.
 */
export interface InputAck {
  seq: number;
  ticks: number;
}

export type Snapshot = PublicView & { acks: Record<string, InputAck> };

const MAX_NAME = 16;

/** Display names: trimmed, printable, at most 16 characters. */
export function sanitizeName(raw: unknown): string {
  const name = typeof raw === "string" ? raw.replace(/[\p{C}]/gu, "").trim().slice(0, MAX_NAME) : "";
  return name || "Jogador";
}

/** Difficulty from an untrusted addBot message, or null. */
export function botLevel(raw: unknown): BotLevel | null {
  const level = (raw && typeof raw === "object" ? (raw as Record<string, unknown>).level : raw) as BotLevel;
  return BOT_LEVELS.includes(level) ? level : null;
}

/** Character from an untrusted message (bare or `{ character }`), or null. */
export function characterId(raw: unknown): CharacterId | null {
  const id = (raw && typeof raw === "object" ? (raw as Record<string, unknown>).character : raw) as CharacterId;
  return CHARACTERS.includes(id) ? id : null;
}
