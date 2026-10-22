/** Simulation ticks per second. Every timer in the sim is expressed in ticks. */
export const TICK_RATE = 60;

/** Ticks between placing a bomb and its explosion. */
export const FUSE_TICKS = 3 * TICK_RATE;

/** Ticks a flame tile stays lethal. */
export const FLAME_TICKS = Math.round(0.5 * TICK_RATE);

export const MAX_PLAYERS = 5;

/** Screens that may watch a room without a seat (a TV showing the match to the couch). */
export const MAX_WATCHERS = 2;

/** Fixed-point units per tile (16px sprites x 16 subpixels). Positions are integers. */
export const TILE = 256;

/** Movement per tick at base speed (units). 16 => 3.75 tiles/s at 60 ticks/s. */
export const BASE_SPEED = 16;

export const DEFAULT_WIDTH = 13;
export const DEFAULT_HEIGHT = 11;

/** Chance (0..1) that a free tile starts with a destructible block. */
export const DEFAULT_BLOCK_DENSITY = 0.75;

/** Chance (0..1) that a block hides a power-up. */
export const ITEM_CHANCE = 0.5;

/** Relative odds of each basic power-up when a block hides one. 0 = not in play (eggs: mounts are off until their art and rules are settled). */
export const ITEM_WEIGHTS = { fire: 6, bomb: 6, speed: 2, kick: 1, remote: 1, pierce: 1, punch: 1, glove: 1, skull: 1, fullFire: 0.5, egg: 0 } as const;

export const START_BOMB_CAPACITY = 1;
export const START_FIRE_RANGE = 1;

export const MAX_BOMB_CAPACITY = 8;
export const MAX_FIRE_RANGE = 8;

/** Speed gained per speed power-up (units per tick). */
export const SPEED_STEP = 4;
export const MAX_SPEED = BASE_SPEED * 2;

/** Speed forced by the "slow" curse. */
export const SLOW_SPEED = BASE_SPEED / 2;


/** Invulnerability after losing a mount. */
export const INVULN_TICKS = 2 * TICK_RATE;

/** A hopper jump covers two tiles in JUMP_TICKS. */
export const JUMP_TICKS = 16;
export const JUMP_SPEED = (TILE * 2) / JUMP_TICKS;

/** A dasher burst lasts DASH_TICKS at DASH_SPEED. */
export const DASH_TICKS = 16;
export const DASH_SPEED = BASE_SPEED * 3;

/** Round length before sudden death starts. */
export const ROUND_TICKS = 3 * 60 * TICK_RATE;
/** Ticks the results screen stays up before the room goes back to the lobby. */
export const RESULTS_TICKS = 6 * TICK_RATE;

/** Ticks between falling walls during sudden death. */
export const PRESSURE_INTERVAL = 12;

/** Units per tick a conveyor belt moves whoever stands on it. */
export const CONVEYOR_SPEED = BASE_SPEED / 2;

/** Ticks a revenge cart takes to move one border tile. */
export const CART_TICKS = 8;

/** Units per tick a kicked bomb slides. */
export const KICK_SPEED = BASE_SPEED * 2;

/** Ticks an airborne bomb takes to cross one tile. */
export const AIR_TICKS_PER_TILE = 6;

/** Tiles a punched or thrown bomb travels before trying to land. */
export const AIR_DISTANCE = 3;

/** Ticks a player stays stunned after a bomb lands on them. */
export const STUN_TICKS = TICK_RATE;

/** Ninja ice blast: reach in tiles, how long it freezes, and its recharge. */
export const ICE_RANGE = 4;
export const FREEZE_TICKS = 5 * TICK_RATE;
export const SPECIAL_COOLDOWN = 20 * TICK_RATE;

/** How long a special that stuns (Thor's bolt, Goku's Kamehameha, Naruto's Rasengan) stuns whoever it hits. */
export const SPECIAL_STUN_TICKS = 3 * TICK_RATE;

/** Thor's lightning bolt: reach in tiles. */
export const BOLT_RANGE = 5;

/** The spider's web shot: reach in tiles and how long it keeps the first player hit wrapped up. */
export const WEB_RANGE = 5;
export const WEB_TICKS = 4 * TICK_RATE;

/** Static's magnet pull: reach in tiles (the first player in it is dragged next to him and stunned). */
export const MAGNET_RANGE = 5;

/** The flash's super speed: how far his dash reaches in tiles (everyone he runs through is left dizzy). */
export const FLASH_RANGE = 5;

/** Pikachu's thunder shock: how far each arm of the cross around him reaches. */
export const THUNDER_RANGE = 2;

/**
 * Goku's Kamehameha: reach in tiles, the charge before it fires (he stands still; a stun or freeze
 * cancels it) and its recharge.
 */
export const KAME_RANGE = 5;
export const KAME_CHARGE = 20;
export const KAME_COOLDOWN = 30 * TICK_RATE;

/** The bomb mascot's mega bomb (piercing, twice his fire): its recharge. */
export const MEGA_COOLDOWN = 25 * TICK_RATE;

/**
 * Naruto's Rasengan: a dash RASENGAN_RANGE tiles straight ahead, RASENGAN_TICKS_PER_TILE ticks a tile;
 * the first player he runs into is knocked back up to RASENGAN_PUSH tiles and stunned.
 */
export const RASENGAN_RANGE = 3;
export const RASENGAN_TICKS_PER_TILE = 4;
export const RASENGAN_TICKS = RASENGAN_RANGE * RASENGAN_TICKS_PER_TILE;
export const RASENGAN_PUSH = 2;

/** Captain's shield: how long it stays up (he stands still behind it). */
export const SHIELD_TICKS = 3 * TICK_RATE;

/** Ticks a blast stays on screen. */
export const BLAST_TICKS = 36;

/** Spawn tiles for the default 13x11 arena, in player order. */
export const SPAWN_POINTS: readonly { x: number; y: number }[] = [
  { x: 1, y: 1 },
  { x: 11, y: 9 },
  { x: 11, y: 1 },
  { x: 1, y: 9 },
  { x: 6, y: 5 },
];
