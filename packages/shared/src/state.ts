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
  x: number;
  y: number;
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
