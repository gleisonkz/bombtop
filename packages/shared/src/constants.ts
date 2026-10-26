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

export const DEFAULT_WIDTH = 15;
export const DEFAULT_HEIGHT = 13;

/** Chance (0..1) that a free tile starts with a destructible block. */
export const DEFAULT_BLOCK_DENSITY = 0.75;

/** Chance (0..1) that a block hides a power-up. */
export const ITEM_CHANCE = 0.5;

export const ITEM_WEIGHTS = { fire: 6, bomb: 6, speed: 2, kick: 1, remote: 1, pierce: 1, punch: 1, push: 1, glove: 1, skull: 1, fullFire: 0.5, egg: 2, picanha: 0, bombPass: 0, blockPass: 0, fireSuit: 0, heart: 0 } as const;

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
export const FIRE_SUIT_TICKS = 16 * TICK_RATE;

/** A hopper jump covers two tiles in JUMP_TICKS. */
export const JUMP_TICKS = 16;
export const JUMP_SPEED = (TILE * 2) / JUMP_TICKS;

/** A dasher burst lasts DASH_TICKS at DASH_SPEED. */
export const DASH_TICKS = 16;
export const DASH_SPEED = BASE_SPEED * 3;

/** Round length before sudden death starts. */
export const ROUND_TICKS = 3 * 60 * TICK_RATE;
/** Once only bots are left in a match, sudden death comes this soon (they also go all out: botHeat). */
export const BOTS_ONLY_HURRY = 30 * TICK_RATE;
/** Ticks a round's results screen stays up before the next round (or, once the match is won, the lobby). */
export const RESULTS_TICKS = 6 * TICK_RATE;
/** Rounds to win a match (as in Super Bomberman 4, at most 5): between rounds the next one starts by itself. */
export const WINS_TO_WIN = 5;

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

/** A brief knockdown after a bomb lands on a player (0.75 seconds). */
export const STUN_TICKS = Math.round(0.75 * TICK_RATE);

export const SPECIAL_COOLDOWN = 20 * TICK_RATE;

/** Two-second special stun leaves time to escape a freshly placed three-second bomb. */
export const SPECIAL_STUN_TICKS = 2 * TICK_RATE;

/** Thor's lightning bolt: reach in tiles. */
export const BOLT_RANGE = 5;

/** The spider's web shot: reach in tiles and how long it keeps the first player hit wrapped up. */
export const WEB_RANGE = 5;
export const WEB_TICKS = 4 * TICK_RATE;
/** Penelope's blown kiss: how far it flies; whoever it charms is stunned SPECIAL_STUN_TICKS. */
export const KISS_RANGE = 5;
/** How long the pink panther tiptoes out of sight (4 s). */
export const SNEAK_TICKS = 240;
/** Harry's patronus (a silver stag) gallops on until a wall or block: its recharge is longer (25 s). */
export const PATRONUS_COOLDOWN = 25 * TICK_RATE;
/** How fast the stag gallops (ticks a tile), and how long it lingers, fading, where it stopped. */
export const PATRONUS_TICKS_PER_TILE = 4;
export const PATRONUS_FADE = 24;

/**
 * Optimus's "roll out": he turns into his truck where he stands for TRUCK_SHIFT ticks, then drives up to TRUCK_RANGE
 * tiles straight ahead, TRUCK_TICKS_PER_TILE ticks a tile, shoving whoever is in front along; 25 s recharge.
 */
export const TRUCK_SHIFT = 12;
export const TRUCK_RANGE = 6;
export const TRUCK_TICKS_PER_TILE = 4;
export const TRUCK_TICKS = TRUCK_RANGE * TRUCK_TICKS_PER_TILE;
export const TRUCK_COOLDOWN = 25 * TICK_RATE;

/** Pelé's kick: how far the ball flies; the first player it hits is knocked down, stunned SPECIAL_STUN_TICKS. */
export const BALL_RANGE = 7;

/** Static's magnet pull: reach in tiles (the first player in it is dragged next to him and stunned). */
export const MAGNET_RANGE = 5;

/** The flash's super speed: how far his dash reaches in tiles (everyone he runs through is left dizzy). */
export const FLASH_RANGE = 5;

/** Bugs' tunnel: how far ahead he can dig to come out (under walls, blocks, bombs and players). */
export const TUNNEL_RANGE = 5;

/** The green lantern's bubble: how long it keeps the fire out (3 s), and its recharge (25 s). */
export const BUBBLE_TICKS = 180;
export const BUBBLE_COOLDOWN = 25 * 60;

/** Pikachu's thunder shock: how far each arm of the cross around him reaches. */
export const THUNDER_RANGE = 2;

/**
 * Goku's Kamehameha: reach in tiles, the charge before it fires (he stands still; a stun
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

/** Spawn tiles for the default 15x13 arena (13x11 inside its walls, as in Super Bomberman 4), in player order. */
export const SPAWN_POINTS: readonly { x: number; y: number }[] = [
  { x: 1, y: 1 },
  { x: 13, y: 11 },
  { x: 13, y: 1 },
  { x: 1, y: 11 },
  { x: 7, y: 5 },
];
