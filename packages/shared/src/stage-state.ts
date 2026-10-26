import type { Facing, ItemKind } from "./state";

export interface StageBall {
  px: number;
  py: number;
  dir: Facing | null;
  ownerId?: string;
  travelRemaining?: number;
}

export interface StageFlag {
  x: number;
  y: number;
  ownerId?: string;
  carriedBy?: string;
  destroyed?: boolean;
}

export interface StageSeesaw {
  x: number;
  y: number;
  dir: Facing;
  raised: boolean;
  cooldown?: number;
}

export type StageTrolleyVariant = 0 | 1 | 2;
export type StageTrolleyStation = 0 | 1 | 2;

export interface StageTrolley {
  px: number;
  py: number;
  dir: Facing;
  riderId?: string;
  cooldown?: number;
  route?: { x: number; y: number }[];
  index?: number;
  remaining?: number;
  phase?: "boarding" | "riding" | "leaving";
  phaseTicks?: number;
  variant?: StageTrolleyVariant;
  routeRng?: number;
  station?: StageTrolleyStation;
}

export interface StageState {
  balls?: StageBall[];
  flags?: StageFlag[];
  roulette?: { cooldown: number; until: number; active?: boolean; result?: ItemKind; reels?: ("seven" | "bar" | "fire" | "skull")[]; stopped?: boolean[] };
  seesaws?: StageSeesaw[];
  trolley?: StageTrolley;
  honey?: { x: number; y: number; takenBy?: string }[];
  winnerId?: string;
  floorLocks?: Record<string, number>;
  surprise?: Record<number, { kind: "normal" | "ice" | "sticky" | "reverse"; hits: number }>;
  flights?: Record<string, { dir: Facing; ticks: number; remaining: number }>;
}
