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

export interface Player {
  id: string;
  /** Center position in fixed-point units (see TILE). */
  px: number;
  py: number;
  alive: boolean;
  bombCapacity: number;
  fireRange: number;
}

export interface Bomb {
  ownerId: string;
  x: number;
  y: number;
  /** Ticks left until explosion. */
  fuse: number;
  range: number;
}

export interface Flame {
  x: number;
  y: number;
  /** Ticks left until the flame disappears. */
  ttl: number;
}

export interface MatchState {
  tick: number;
  grid: Grid;
  players: Player[];
  bombs: Bomb[];
  flames: Flame[];
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

export function bombAt(s: MatchState, x: number, y: number): Bomb | undefined {
  return s.bombs.find((b) => b.x === x && b.y === y);
}
