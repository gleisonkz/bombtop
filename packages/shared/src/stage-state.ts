import type { Facing, ItemKind } from "./state";

export interface StageBall {
  px: number;
  py: number;
  dir: Facing | null;
  ownerId?: string;
  travelRemaining?: number;
  segmentRemaining?: number;
  turnOrder?: number;
}

export interface StageFlag {
  x: number;
  y: number;
  ownerId?: string;
  carriedBy?: string;
  destroyed?: boolean;
  /** Native previous-carrier exclusion lasts until that player leaves the cell. */
  droppedBy?: string;
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
  pendingHitIds?: string[];
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

export type StageSurpriseKind = "normal" | "ice" | "sticky" | "reverse";

export interface StageIceSlide {
  dir: Facing;
  targetPx: number;
  targetPy: number;
}

export type StageSurpriseSamples = Record<Facing, number>;

export interface StageSurpriseCenter {
  x: number;
  y: number;
  nextAt: number;
  remaining: number;
}

export interface StageFlight {
  dir: Facing;
  ticks: number;
  remaining: number;
  kind?: "seesaw" | "seesawRebound";
  steering?: "left" | "right";
  preSteered?: true;
}

export interface StageSlotCascade {
  startedAt: number;
  waveIndex: number;
  issued: number;
  limit: number;
}

export interface StageSlotReelClock {
  counter: number;
  interval: number;
  accumulator: number;
  phase: number;
  stopped: boolean;
}

export interface StageSlotClock {
  lastTick: number;
  cursor: number;
  afterAll: number;
  reels: StageSlotReelClock[];
}

export interface StageState {
  balls?: StageBall[];
  flags?: StageFlag[];
  flagPickupUntil?: Record<string, number>;
  roulette?: { cooldown: number; until: number; startedAt?: number; active?: boolean; result?: ItemKind; reels?: ("seven" | "bar" | "fire" | "skull")[]; stopped?: boolean[]; cascade?: StageSlotCascade; nativeClock?: StageSlotClock };
  seesaws?: StageSeesaw[];
  trolley?: StageTrolley;
  honey?: { x: number; y: number; takenBy?: string }[];
  winnerId?: string;
  floorLocks?: Record<string, number>;
  surprise?: Record<number, { kind: StageSurpriseKind; hits: number }>;
  /** Native $1EAA: selection count shared by every surprise panel. */
  surpriseCounter?: number;
  surpriseCenters?: StageSurpriseCenter[];
  iceSlides?: Record<string, StageIceSlide>;
  flights?: Record<string, StageFlight>;
}
