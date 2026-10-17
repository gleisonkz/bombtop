import type { MatchResult } from "./pressure";
import type { Direction, PlayerInput } from "./state";
import type { StageId } from "./stage";

/** Room name registered on the server. */
export const ROOM_NAME = "battle";

export type RoomPhase = "lobby" | "playing" | "results";

/** Client -> server message types. */
export const C2S = { input: "input", start: "start" } as const;

/** Server -> client message types. */
export const S2C = { welcome: "welcome", lobby: "lobby", snapshot: "snapshot", result: "result" } as const;

export interface LobbyMember {
  id: string;
  name: string;
  wins: number;
  connected: boolean;
}

export interface LobbyInfo {
  phase: RoomPhase;
  hostId: string | null;
  members: LobbyMember[];
  stage: StageId;
  /** Room id; doubles as the private-room code. */
  code: string;
}

export interface Welcome {
  you: string;
  code: string;
}

export type ResultMessage = MatchResult & { over: true };

const DIRS = new Set<Direction>(["up", "down", "left", "right"]);

/** Validates untrusted input from the network. */
export function sanitizeInput(raw: unknown): PlayerInput {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const dir = DIRS.has(r.dir as Direction) ? (r.dir as Direction) : null;
  return { dir, bomb: r.bomb === true, action: r.action === true };
}

const MAX_NAME = 16;

/** Display names: trimmed, printable, at most 16 characters. */
export function sanitizeName(raw: unknown): string {
  const name = typeof raw === "string" ? raw.replace(/[\p{C}]/gu, "").trim().slice(0, MAX_NAME) : "";
  return name || "Jogador";
}
