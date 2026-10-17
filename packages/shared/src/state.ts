import { TILE } from "./constants";

export enum Tile {
  Empty = 0,
  Wall = 1,
  Block = 2,
}

export interface Grid {
  width: number;
  height: number;
  /** Row-major: index = y * width + x */
  tiles: Tile[];
}

export type Direction = "up" | "down" | "left" | "right" | null;

export type Facing = Exclude<Direction, null>;

export type BombType = "normal" | "remote" | "pierce";

export const DIR_VECTORS: Record<Facing, readonly [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

export interface PlayerInput {
  dir: Direction;
  /** Primary button: drop bomb. */
  bomb: boolean;
  /** Secondary button: detonate / punch. */
  action?: boolean;
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
}

export interface Cart {
  /** Index into perimeter(width, height). */
  pos: number;
  /** Ticks until the cart may move again. */
  cooldown: number;
}

export type MountKind = "hopper" | "dasher" | "pusher";

export type CurseKind = "slow" | "fast" | "reverse" | "diarrhea" | "constipation" | "weakFire";

export interface Curse {
  kind: CurseKind;
  ticks: number;
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
}

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
}

export function getTile(s: MatchState, x: number, y: number): Tile {
  const { width, height, tiles } = s.grid;
  if (x < 0 || y < 0 || x >= width || y >= height) return Tile.Wall;
  return tiles[y * width + x]!;
}

export function setTile(s: MatchState, x: number, y: number, tile: Tile): void {
  s.grid.tiles[y * s.grid.width + x] = tile;
}

export function hasFlame(s: MatchState, x: number, y: number): boolean {
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
export function bombAt(s: MatchState, x: number, y: number): Bomb | undefined {
  return s.bombs.find((b) => b.x === x && b.y === y && !b.air && !b.heldBy);
}
