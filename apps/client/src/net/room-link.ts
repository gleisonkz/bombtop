import type { Route } from "./rtc-route";

/**
 * What a match needs from its room connection. A Colyseus room fits it as is
 * (online); the offline (Wi-Fi) host and its friends implement it too (local-host.ts).
 */
export interface RoomLink {
  readonly sessionId: string;
  /** The room's code. */
  readonly roomId: string;
  /** Takes this seat back after a reload (online only; empty offline). */
  readonly reconnectionToken: string;
  send(type: string, message?: unknown): void;
  onMessage(type: string, callback: (message: any) => void): unknown;
  onLeave(callback: (code: number) => void): unknown;
  ping(callback: (ms: number) => void): void;
  leave(): Promise<unknown>;
  /** Offline: which way the connection between the phones runs (rtc-route.ts). */
  route?(): Promise<Route | null>;
}
