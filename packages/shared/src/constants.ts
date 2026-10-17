/** Simulation ticks per second. Every timer in the sim is expressed in ticks. */
export const TICK_RATE = 60;

/** Ticks between placing a bomb and its explosion. */
export const FUSE_TICKS = 3 * TICK_RATE;

/** Ticks a flame tile stays lethal. */
export const FLAME_TICKS = Math.round(0.5 * TICK_RATE);

export const MAX_PLAYERS = 5;

export const DEFAULT_WIDTH = 13;
export const DEFAULT_HEIGHT = 11;

/** Chance (0..1) that a free tile starts with a destructible block. */
export const DEFAULT_BLOCK_DENSITY = 0.75;

export const START_BOMB_CAPACITY = 1;
export const START_FIRE_RANGE = 1;

/** Spawn tiles for the default 13x11 arena, in player order. */
export const SPAWN_POINTS: readonly { x: number; y: number }[] = [
  { x: 1, y: 1 },
  { x: 11, y: 9 },
  { x: 11, y: 1 },
  { x: 1, y: 9 },
  { x: 6, y: 5 },
];
