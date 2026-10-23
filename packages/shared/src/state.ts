import { TILE } from "./constants";

export enum Tile {
  Empty = 0,
  Wall = 1,
  Block = 2,
}

/** Floor features under a tile (stage gimmicks). */
export enum Floor {
  Normal = 0,
  ConveyorUp = 1,
  ConveyorDown = 2,
  ConveyorLeft = 3,
  ConveyorRight = 4,
  Warp = 5,
}

export interface Grid {
  width: number;
  height: number;
  /** Row-major: index = y * width + x */
  tiles: Tile[];
  /** Row-major floor features, parallel to `tiles`. */
  floor: Floor[];
  /** Warp tiles; warps[i] is paired with warps[i ^ 1]. */
  warps: { x: number; y: number }[];
}

export type Direction = "up" | "down" | "left" | "right" | null;

export type Facing = Exclude<Direction, null>;

export type BombType = "normal" | "remote" | "pierce";

/** Playable characters: each has its own look and special. */
export const CHARACTERS = ["bomb", "ninja", "captain", "thor", "goku", "naruto", "spider", "pikachu", "static", "flash", "bugs"] as const;
export type CharacterId = (typeof CHARACTERS)[number];
export const DEFAULT_CHARACTER: CharacterId = "bomb";

export const DIR_VECTORS: Record<Facing, readonly [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

export interface PlayerInput {
  dir: Direction;
  /**
   * Second held direction (diagonal on a stick or two keys): used while `dir`
   * is blocked, so holding up+left walks up and turns left at the next opening.
   */
  alt?: Direction;
  /** Primary button: drop bomb (pressed this tick). */
  bomb: boolean;
  /** The bomb button is down right now: a bomb lifted with the glove is carried until it is let go. */
  hold?: boolean;
  /** Secondary button: detonate / punch. */
  action?: boolean;
  /** Special button: the character's own move (ninja: ice blast). */
  special?: boolean;
}

export interface Player {
  id: string;
  /** Center position in fixed-point units (see TILE). */
  px: number;
  py: number;
  alive: boolean;
  bombCapacity: number;
  fireRange: number;
  /** Units moved per tick. */
  speed: number;
  facing: Facing;
  canKick: boolean;
  bombType: BombType;
  canPunch: boolean;
  canGlove: boolean;
  /** Ticks left being stunned (no movement or actions). */
  stun: number;
  character: CharacterId;
  /** Ticks left frozen by an ice blast (no movement or actions; flames still kill). */
  frozen: number;
  /** Ticks left wrapped in the spider's web (no movement or actions; flames still kill). */
  webbed: number;
  /** Ticks until the special can be used again. */
  specialCooldown: number;
  /** Ticks left with the captain's shield up (planted, facing `facing`). */
  shield: number;
  /** Ticks until Goku's Kamehameha fires (he stands still while it charges). */
  charge: number;
  /** Ticks left in Naruto's Rasengan dash (he runs `facing`, deaf to the stick; see `updateRasengan`). */
  rasengan: number;
  curse: Curse | null;
  mount: MountKind | null;
  /** Ticks left of post-hit invulnerability. */
  invuln: number;
  /** Ticks left in a hopper jump (moving JUMP_SPEED per tick in `facing`). */
  jumpTicks: number;
  /** Ticks left in a dasher burst. */
  dashTicks: number;
  /** Revenge cart a dead player rides along the border, or null. */
  cart: Cart | null;
  /** Set after warping; cleared once the player leaves the warp tile. */
  warpLock: boolean;
}

export interface Cart {
  /** Index into perimeter(width, height). */
  pos: number;
  /** Ticks until the cart may move again. */
  cooldown: number;
}

export type MountKind = "hopper" | "dasher" | "pusher";

export type CurseKind = "slow" | "fast" | "reverse" | "diarrhea" | "constipation" | "weakFire";

/** A skull's curse: it lasts until passed on by touch or cured by picking up another item. */
export interface Curse {
  kind: CurseKind;
  /** Who just passed it on: it cannot go back to them until the two have parted. */
  from?: string;
}

export interface Bomb {
  ownerId: string;
  x: number;
  y: number;
  /** Ticks left until explosion. */
  fuse: number;
  range: number;
  type: BombType;
  /** Direction the bomb is sliding after a kick, or null when resting. */
  slide: Facing | null;
  /** Units travelled from (x,y) toward the next tile while sliding. */
  offset: number;
  /** Set while flying (punched/thrown); airborne bombs sit on no tile and their fuse pauses. */
  air: AirState | null;
  /** Id of the player carrying this bomb (glove), or null. Held bombs sit on no tile. */
  heldBy: string | null;
  /** The bomb mascot's special: a mega bomb, drawn bigger; it takes none of his bomb slots. */
  mega?: boolean;
}

export interface AirState {
  dir: Facing;
  /** Tiles still to travel before trying to land. */
  tilesLeft: number;
  /** Ticks spent on the current tile hop (0..AIR_TICKS_PER_TILE). */
  progress: number;
}

export enum ItemKind {
  Fire = "fire",
  Bomb = "bomb",
  Speed = "speed",
  Kick = "kick",
  Remote = "remote",
  Pierce = "pierce",
  Punch = "punch",
  Glove = "glove",
  Skull = "skull",
  FullFire = "fullFire",
  Egg = "egg",
}

/** A power-up. Hidden while its tile is still a block. */
export interface Item {
  x: number;
  y: number;
  kind: ItemKind;
}

export interface Flame {
  x: number;
  y: number;
  /** Ticks left until the flame disappears. */
  ttl: number;
  /** Player whose bomb made this flame (for kill credit). */
  ownerId?: string;
  /** A blown-up block burning on this tile: it stays solid until the flame dies, then it is gone. */
  block?: true;
}

/** A special's shot, kept a few ticks so clients can draw it. */
export interface Blast {
  ownerId: string;
  /** Caster's tile; the blast covers `length` tiles from the next one in `dir`. */
  x: number;
  y: number;
  dir: Facing;
  length: number;
  ttl: number;
  /**
   * Ninja's ice (freezes), Thor's lightning (stuns), the spider's web (wraps up), Goku's Kamehameha (breaks blocks) or
   * where Naruto's Rasengan struck (`length` 1; 0 when it ran its course).
   */
  kind: BlastKind;
}

export type BlastKind = "ice" | "lightning" | "web" | "kamehameha" | "rasengan" | "thunder" | "magnet" | "flash" | "tunnel";

export interface MatchState {
  tick: number;
  /** PRNG state for in-match randomness (see nextRandom). */
  rng: number;
  /** Sudden death: how many spiral tiles have been processed. */
  pressure: number;
  /** Whether dead players get revenge carts. */
  revenge: boolean;
  grid: Grid;
  players: Player[];
  bombs: Bomb[];
  flames: Flame[];
  items: Item[];
  blasts: Blast[];
}

/** Read-only helpers take just the fields they need, so they also work on network snapshots. */
type WithGrid = Pick<MatchState, "grid">;

export function getTile(s: WithGrid, x: number, y: number): Tile {
  const { width, height, tiles } = s.grid;
  if (x < 0 || y < 0 || x >= width || y >= height) return Tile.Wall;
  return tiles[y * width + x]!;
}

export function getFloor(s: WithGrid, x: number, y: number): Floor {
  const { width, height, floor } = s.grid;
  if (x < 0 || y < 0 || x >= width || y >= height) return Floor.Normal;
  return floor[y * width + x]!;
}

export function setTile(s: MatchState, x: number, y: number, tile: Tile): void {
  s.grid.tiles[y * s.grid.width + x] = tile;
}

export function hasFlame(s: Pick<MatchState, "flames">, x: number, y: number): boolean {
  return s.flames.some((f) => f.x === x && f.y === y);
}

export function playerTile(p: Player): { x: number; y: number } {
  return { x: Math.floor(p.px / TILE), y: Math.floor(p.py / TILE) };
}

/** Center of tile `t` in fixed-point units. */
export function tileCenter(t: number): number {
  return t * TILE + TILE / 2;
}

/** Teleports a player to the center of a tile. */
export function placePlayerAt(s: MatchState, playerId: string, x: number, y: number): void {
  const p = s.players.find((p) => p.id === playerId);
  if (!p) throw new Error(`Unknown player ${playerId}`);
  p.px = tileCenter(x);
  p.py = tileCenter(y);
}

/** The grounded bomb on a tile (airborne and held bombs are not on any tile). */
export function bombAt(s: Pick<MatchState, "bombs">, x: number, y: number): Bomb | undefined {
  return s.bombs.find((b) => b.x === x && b.y === y && !b.air && !b.heldBy);
}
