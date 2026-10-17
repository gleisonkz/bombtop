/** Simulation ticks per second. Every timer in the sim is expressed in ticks. */
export const TICK_RATE = 60;

/** Ticks between placing a bomb and its explosion. */
export const FUSE_TICKS = 3 * TICK_RATE;

/** Ticks a flame tile stays lethal. */
export const FLAME_TICKS = Math.round(0.5 * TICK_RATE);

export const MAX_PLAYERS = 5;

/** Fixed-point units per tile (16px sprites x 16 subpixels). Positions are integers. */
export const TILE = 256;

/** Movement per tick at base speed (units). 16 => 3.75 tiles/s at 60 ticks/s. */
export const BASE_SPEED = 16;

export const DEFAULT_WIDTH = 13;
export const DEFAULT_HEIGHT = 11;

/** Chance (0..1) that a free tile starts with a destructible block. */
export const DEFAULT_BLOCK_DENSITY = 0.75;

/** Chance (0..1) that a block hides a power-up. */
export const ITEM_CHANCE = 0.35;

/** Relative odds of each basic power-up when a block hides one. */
export const ITEM_WEIGHTS = { fire: 4, bomb: 4, speed: 2 } as const;

export const START_BOMB_CAPACITY = 1;
export const START_FIRE_RANGE = 1;

export const MAX_BOMB_CAPACITY = 8;
export const MAX_FIRE_RANGE = 8;

/** Speed gained per speed power-up (units per tick). */
export const SPEED_STEP = 4;
export const MAX_SPEED = BASE_SPEED * 2;

/** Spawn tiles for the default 13x11 arena, in player order. */
export const SPAWN_POINTS: readonly { x: number; y: number }[] = [
  { x: 1, y: 1 },
  { x: 11, y: 9 },
  { x: 11, y: 1 },
  { x: 1, y: 9 },
  { x: 6, y: 5 },
];
