import {
  BASE_SPEED,
  DEFAULT_BLOCK_DENSITY,
  DEFAULT_HEIGHT,
  DEFAULT_WIDTH,
  ITEM_CHANCE,
  ITEM_WEIGHTS,
  MAX_PLAYERS,
  SPAWN_POINTS,
  START_BOMB_CAPACITY,
  START_FIRE_RANGE,
} from "./constants";
import { createRng } from "./rng";
import { ItemKind, tileCenter, Tile, type Item, type MatchState } from "./state";

export interface MatchOptions {
  seed: number;
  playerIds: string[];
  blockDensity?: number;
}

export function createMatch(opts: MatchOptions): MatchState {
  const { seed, playerIds, blockDensity = DEFAULT_BLOCK_DENSITY } = opts;
  if (playerIds.length > MAX_PLAYERS) {
    throw new Error(`At most ${MAX_PLAYERS} players per match`);
  }

  const width = DEFAULT_WIDTH;
  const height = DEFAULT_HEIGHT;
  const rng = createRng(seed);
  const safe = safeTiles(width);
  const tiles: Tile[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const border = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      const pillar = x % 2 === 0 && y % 2 === 0;
      if (border || pillar) tiles.push(Tile.Wall);
      else if (safe.has(y * width + x)) tiles.push(Tile.Empty);
      else tiles.push(rng() < blockDensity ? Tile.Block : Tile.Empty);
    }
  }

  return {
    tick: 0,
    items: hideItems(tiles, width, seed),
    grid: { width, height, tiles },
    players: playerIds.map((id, i) => ({
      id,
      px: tileCenter(SPAWN_POINTS[i]!.x),
      py: tileCenter(SPAWN_POINTS[i]!.y),
      alive: true,
      bombCapacity: START_BOMB_CAPACITY,
      fireRange: START_FIRE_RANGE,
      speed: BASE_SPEED,
      facing: "down" as const,
    })),
    bombs: [],
    flames: [],
  };
}

/** Spawn tiles plus their orthogonal neighbours never get blocks, so nobody starts trapped. */
function safeTiles(width: number): Set<number> {
  const safe = new Set<number>();
  for (const { x, y } of SPAWN_POINTS) {
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      safe.add((y + dy) * width + (x + dx));
    }
  }
  return safe;
}

/**
 * Picks which blocks hide power-ups. Uses its own PRNG stream so adding item
 * kinds never changes the block layout of a seed.
 */
function hideItems(tiles: Tile[], width: number, seed: number): Item[] {
  const rng = createRng(seed ^ 0x9e3779b9);
  const kinds = Object.entries(ITEM_WEIGHTS) as [ItemKind, number][];
  const total = kinds.reduce((sum, [, w]) => sum + w, 0);
  const items: Item[] = [];

  tiles.forEach((tile, i) => {
    if (tile !== Tile.Block || rng() >= ITEM_CHANCE) return;
    let roll = rng() * total;
    const kind = kinds.find(([, w]) => (roll -= w) < 0)?.[0] ?? kinds[0]![0];
    items.push({ x: i % width, y: Math.floor(i / width), kind });
  });
  return items;
}
