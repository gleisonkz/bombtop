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
import { buildStage, type StageId } from "./stage";
import { DEFAULT_CHARACTER, ItemKind, tileCenter, Tile, type CharacterId, type Item, type MatchState } from "./state";

export interface MatchOptions {
  seed: number;
  playerIds: string[];
  blockDensity?: number;
  /** Dead players ride revenge carts (default true). */
  revenge?: boolean;
  stage?: StageId;
  /** Each player's character (default: the bomb). */
  characters?: Record<string, CharacterId>;
}

export function createMatch(opts: MatchOptions): MatchState {
  const { seed, playerIds, blockDensity = DEFAULT_BLOCK_DENSITY, revenge = true, stage = "classic" } = opts;
  if (playerIds.length > MAX_PLAYERS) {
    throw new Error(`At most ${MAX_PLAYERS} players per match`);
  }

  const width = DEFAULT_WIDTH;
  const height = DEFAULT_HEIGHT;
  const rng = createRng(seed);
  const layout = buildStage(stage, width, height);
  const safe = new Set([...safeTiles(width), ...layout.keepClear]);
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
    rng: (seed ^ 0x85ebca6b) >>> 0,
    pressure: 0,
    revenge,
    items: hideItems(tiles, width, seed),
    grid: { width, height, tiles, floor: layout.floor, warps: layout.warps },
    players: playerIds.map((id, i) => ({
      id,
      px: tileCenter(SPAWN_POINTS[i]!.x),
      py: tileCenter(SPAWN_POINTS[i]!.y),
      alive: true,
      bombCapacity: START_BOMB_CAPACITY,
      fireRange: START_FIRE_RANGE,
      speed: BASE_SPEED,
      facing: "down" as const,
      canKick: false,
      bombType: "normal" as const,
      canPunch: false,
      canGlove: false,
      stun: 0,
      character: opts.characters?.[id] ?? DEFAULT_CHARACTER,
      frozen: 0,
      specialCooldown: 0,
      curse: null,
      mount: null,
      invuln: 0,
      jumpTicks: 0,
      dashTicks: 0,
      cart: null,
      warpLock: false,
    })),
    bombs: [],
    flames: [],
    blasts: [],
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
