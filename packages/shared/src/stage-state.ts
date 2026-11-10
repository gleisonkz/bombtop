import type { Facing, ItemKind, PlayerInput } from "./state";

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
  sb2?: { counterOffset: number; pendingInputs: Record<string, PlayerInput>;
    battleClock?: import("./sb2-battle-clock").Sb2BattleClock | null;
    closure?: import("./sb2-battle-clock").Sb2ClosureClock;
    stoppedNativeCounter?: number;
    itemReturn?: import("./sb2-item-return").Sb2ItemReturn;
    warps?: Record<string, import("./sb2-warp").Sb2WarpState>;
    ice?: Record<string, { vx: number; vy: number; verticalRestart?: true }>;
    iceFacing?: Record<string, Facing>;
    stage2Transport?: Record<string, import("./sb2-stage2-controller").Sb2Stage2Transport>;
    stage9Reservations?: Record<string, { x: number; y: number }>;
    stage9Velocity?: Record<string, { vx: number; vy: number }>;
    stage9KickContacts?: Record<string, true>;
    stage10?: Record<string, { actionHeld: boolean; targetY?: number; verticalFraction?: number;
      escape?: { x: number; y: number; direction: import("./state").Facing };
      jump?: import("./sb2-stage10-jump").Sb2Stage10Jump;
      boundary?: import("./sb2-stage10-boundary").Sb2Stage10Boundary }>;
    stage11?: Record<string, { counter: number; previousFacing?: import("./state").Facing;
      preparation?: { frame: number; direction: import("./state").Facing };
      flight?: import("./sb2-stage11-flight").Sb2Stage11Flight }>;
    stage12?: Record<string, import("./sb2-stage12-controller").Sb2Stage12Player>;
    stage12Floors?: import("./sb2-stage12-floor").Sb2Stage12Floor[];
    stage12AirItems?: import("./sb2-stage12-floor").Sb2Stage12AirItem[];
    skullReturnCursor?: number;
    stage12Pads?: { x: number; y: number; clock: import("./sb2-spring-pad").Sb2SpringPadClock }[];
    stage12PadFlames?: { x: number; y: number; ownerId: string; expiresAt: number; visible: boolean }[];
    stage3?: { tunnels: Record<string, { column: 3 | 11; edge: "top" | "bottom" }>;
      releaseDirections?: Record<string, "up" | "down">;
      contacts?: Record<string, { direction: "up"; speed: number }> };
    channel?: { clock: import("./sb2-channel").Sb2ChannelClock; ownerId: string };
    channelCommonFlames?: { x: number; y: number; ownerId: string; bornFrame: number }[];
    freezeBombFuses?: true;
    pendingChainArms?: { bomb: import("./state").Bomb; frames: number }[];
    itemBag?: import("./sb2-item-bag").Sb2ItemBag; randomSeed?: number; randomWord?: number;
    randomHistory?: number[];
    stage7?: import("./sb2-stage7-controller").Sb2Stage7Controller;
    conveyor?: import("./sb2-stage8-controller").Sb2Stage8Controller };
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
