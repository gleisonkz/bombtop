import { BOT_LEVELS, type BotLevel } from "./bot";
import type { MatchResult } from "./pressure";
import type { Direction, PlayerInput } from "./state";
import type { StageId } from "./stage";
import type { PublicView } from "./view";

/** Room name registered on the server. */
export const ROOM_NAME = "battle";

export type RoomPhase = "lobby" | "playing" | "results";

/**
 * Client -> server message types. `sync` asks for the current lobby (and
 * snapshot, mid-match): send it once message handlers are attached, since
 * anything broadcast before that is dropped by the SDK.
 */
export const C2S = {
  input: "input",
  start: "start",
  sync: "sync",
  addBot: "addBot",
  removeBot: "removeBot",
  character: "character",
} as const;

/** Server -> client message types. */
export const S2C = { lobby: "lobby", snapshot: "snapshot", result: "result" } as const;

/** Playable characters (looks only: all play the same). */
export const CHARACTERS = ["bomb", "ninja"] as const;
export type CharacterId = (typeof CHARACTERS)[number];
export const DEFAULT_CHARACTER: CharacterId = "bomb";

export interface LobbyMember {
  id: string;
  name: string;
  wins: number;
  connected: boolean;
  character: CharacterId;
  /** Set for computer players: their difficulty. */
  bot?: BotLevel;
}

export interface LobbyInfo {
  phase: RoomPhase;
  hostId: string | null;
  members: LobbyMember[];
  stage: StageId;
  /** Room id; doubles as the private-room code. */
  code: string;
}

export type ResultMessage = MatchResult & { over: true };

const DIRS = new Set<Direction>(["up", "down", "left", "right"]);

/** Validates untrusted input from the network. */
export function sanitizeInput(raw: unknown): PlayerInput {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const dir = DIRS.has(r.dir as Direction) ? (r.dir as Direction) : null;
  const input: PlayerInput = { dir, bomb: r.bomb === true, action: r.action === true };
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
