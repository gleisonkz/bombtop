import {
  BASE_SPEED,
  DEFAULT_BLOCK_DENSITY,
  DEFAULT_HEIGHT,
  DEFAULT_WIDTH,
  ITEM_CHANCE,
  ITEM_WEIGHTS,
  MAX_PLAYERS,
  ROUND_TICKS,
  TICK_RATE,
  SPAWN_POINTS,
  START_BOMB_CAPACITY,
  START_FIRE_RANGE,
} from "./constants";
import { createRng } from "./rng";
import { MANIAC_ITEM_KINDS, normalizeManiac, type ManiacItemKind } from "./maniac";
import { SB4_STAGE_DEFINITIONS } from "./sb4-stage-definitions";
import { buildStage, sb4Map, type StageId } from "./stage";
import { firstPickers } from "./own-colors";
import { initializeStageMechanics } from "./stage-mechanics";
import { DEFAULT_CHARACTER, ItemKind, tileCenter, Tile, type CharacterId, type Item, type MatchState } from "./state";

export interface MatchOptions {
  seed: number;
  playerIds: string[];
  blockDensity?: number;
  /** Dead players ride revenge carts (default false: off until the idea is settled). */
  revenge?: boolean;
  stage?: StageId;
  timeLimitMinutes?: 1 | 2 | 3 | 5 | null;
  suddenDeath?: boolean;
  maniacItems?: Partial<Record<ManiacItemKind, number>>;
  startingHitPoints?: Record<string, number>;
  /** Each player's character (default: the bomb). */
  characters?: Record<string, CharacterId>;
  /** Players in their character's original colors (default: the first seat on each character, see `firstPickers`). */
  ownColors?: Iterable<string>;
}

const CLASSIC_ITEM_COUNTS: readonly [ItemKind, number][] = [
  [ItemKind.Bomb, SB4_STAGE_DEFINITIONS[0].itemCounts[ItemKind.Bomb]],
  [ItemKind.Fire, SB4_STAGE_DEFINITIONS[0].itemCounts[ItemKind.Fire]],
  [ItemKind.Speed, SB4_STAGE_DEFINITIONS[0].itemCounts[ItemKind.Speed]],
  [ItemKind.Egg, SB4_STAGE_DEFINITIONS[0].itemCounts[ItemKind.Egg]],
  [ItemKind.Glove, SB4_STAGE_DEFINITIONS[0].itemCounts[ItemKind.Glove]],
  [ItemKind.Punch, SB4_STAGE_DEFINITIONS[0].itemCounts[ItemKind.Punch]],
  [ItemKind.Push, SB4_STAGE_DEFINITIONS[0].itemCounts[ItemKind.Push]],
  [ItemKind.Kick, SB4_STAGE_DEFINITIONS[0].itemCounts[ItemKind.Kick]],
  [ItemKind.Skull, SB4_STAGE_DEFINITIONS[0].itemCounts[ItemKind.Skull]],
];

export function createMatch(opts: MatchOptions): MatchState {
  const { seed, playerIds, blockDensity = DEFAULT_BLOCK_DENSITY, revenge = false, stage = "classic", timeLimitMinutes = null, suddenDeath = true } = opts;
  if (playerIds.length > MAX_PLAYERS) {
    throw new Error(`At most ${MAX_PLAYERS} players per match`);
  }
  const maniac = opts.maniacItems === undefined && opts.startingHitPoints === undefined
    ? null
    : normalizeManiac({ items: opts.maniacItems ?? {}, hitPoints: opts.startingHitPoints ?? {} }, playerIds);
  if ((opts.maniacItems !== undefined || opts.startingHitPoints !== undefined) && !maniac) throw new Error("Invalid Maniac configuration");

  const width = DEFAULT_WIDTH;
  const height = DEFAULT_HEIGHT;
  const rng = createRng(seed);
  const layout = buildStage(stage, width, height);
  const original = sb4Map(stage);
  const startingFireRange = original ? 2 : START_FIRE_RANGE;
  const spawnPoints = original
    ? [SPAWN_POINTS[0]!, SPAWN_POINTS[1]!, SPAWN_POINTS[2]!, SPAWN_POINTS[3]!, { x: 7, y: 6 }]
    : SPAWN_POINTS;
  const safe = new Set([...safeTiles(width, spawnPoints), ...layout.keepClear]);
  const tiles: Tile[] = layout.tiles?.slice() ?? [];
  const candidates: number[] = [];

  for (let y = 0; y < height && !layout.tiles; y++) {
    for (let x = 0; x < width; x++) {
      const border = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      const pillar = x % 2 === 0 && y % 2 === 0;
      if (border || pillar) tiles.push(Tile.Wall);
      else if (safe.has(y * width + x)) tiles.push(Tile.Empty);
      else tiles.push(rng() < blockDensity ? Tile.Block : Tile.Empty);
    }
  }

  if (original && original.softBlocks > 0 && opts.blockDensity !== undefined) {
    for (let index = 0; index < tiles.length; index++) {
      if (tiles[index] === Tile.Wall || safe.has(index)) continue;
      candidates.push(index);
      tiles[index] = Tile.Empty;
    }
    shuffle(candidates, rng);
    const count = Math.round(candidates.length * Math.max(0, Math.min(1, opts.blockDensity)));
    for (const index of candidates.slice(0, count)) tiles[index] = Tile.Block;
  }

  const character = (id: string): CharacterId => opts.characters?.[id] ?? DEFAULT_CHARACTER;
  const own = new Set(opts.ownColors ?? firstPickers(playerIds.map((id) => ({ id, character: character(id) }))));

  const state: MatchState = {
    tick: 0,
    ...(original && { stage, ...(original.timeFlow && { tempo: 1 as const }) }),
    rng: (seed ^ 0x85ebca6b) >>> 0,
    pressure: 0,
    pressureAt: timeLimitMinutes === null ? ROUND_TICKS : Math.max(0, (timeLimitMinutes - 1) * 60 * TICK_RATE),
    ...(suddenDeath ? {} : { pressureLimit: 2 * (width - 2 + height - 2) - 4 }),
    ...(timeLimitMinutes === null ? {} : { roundEndsAt: timeLimitMinutes * 60 * TICK_RATE }),
    revenge,
    items: hideItems(tiles, width, seed, stage, opts.maniacItems === undefined ? undefined : maniac!.items),
    grid: { width, height, tiles, floor: layout.floor, warps: layout.warps },
    players: playerIds.map((id, i) => ({
      id,
      px: tileCenter(spawnPoints[i]!.x),
      py: tileCenter(spawnPoints[i]!.y),
      alive: true,
      // ROM: normal reach table C11A77 starts at two; stage 05 starts at six.
      bombCapacity: stage === "sb4-05" ? 5 : START_BOMB_CAPACITY,
      fireRange: stage === "sb4-05" ? 6 : startingFireRange,
      // Stage 05 native held-RIGHT replay advances one pixel per logic update.
      speed: BASE_SPEED,
      facing: "down" as const,
      canKick: stage === "sb4-05",
      ...(maniac && { hitPoints: maniac.hitPoints[id] }),
      bombType: "normal" as const,
      canPunch: stage === "sb4-05",
      ...(stage === "sb4-05" && { canPush: true }),
      canGlove: stage === "sb4-05",
      stun: 0,
      character: character(id),
      ...(own.has(id) && { ownColors: true as const }),
      webbed: 0,
      charmed: 0,
      sneak: 0,
      bubble: 0,
      specialCooldown: 0,
      shield: 0,
      charge: 0,
      rasengan: 0,
      truck: 0,
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
  initializeStageMechanics(state);
  return state;
}

/** Spawn tiles plus their orthogonal neighbours never get blocks, so nobody starts trapped. */
function safeTiles(width: number, spawnPoints: readonly { x: number; y: number }[] = SPAWN_POINTS): Set<number> {
  const safe = new Set<number>();
  for (const { x, y } of spawnPoints) {
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
function shuffle<T>(values: T[], rng: () => number): void {
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [values[i], values[j]] = [values[j]!, values[i]!];
  }
}

function hideItems(tiles: Tile[], width: number, seed: number, stage: StageId, maniacItems?: Partial<Record<ManiacItemKind, number>>): Item[] {
  if (stage === "sb4-05" || stage === "sb4-08") return [];
  const rng = createRng(seed ^ 0x9e3779b9);
  if (maniacItems !== undefined) {
    const blocks = tiles.flatMap((tile, i) => tile === Tile.Block ? [i] : []);
    const pool = MANIAC_ITEM_KINDS.flatMap((kind) => Array<ItemKind>(maniacItems[kind] ?? 0).fill(kind));
    shuffle(blocks, rng);
    shuffle(pool, rng);
    return pool.slice(0, blocks.length).map((kind, i) => ({ x: blocks[i]! % width, y: Math.floor(blocks[i]! / width), kind }));
  }
  const original = sb4Map(stage);
  if (stage === "classic" || original) {
    const blocks = tiles.flatMap((tile, i) => tile === Tile.Block ? [i] : []);
    const definition = original ? SB4_STAGE_DEFINITIONS[original.number - 1] : null;
    const counts: readonly (readonly [ItemKind, number])[] = definition?.kind === "documented"
      ? Object.entries(definition.itemCounts).filter(([kind]) => kind !== "honey").map(([kind, count]) => [kind as ItemKind, count])
      : CLASSIC_ITEM_COUNTS;
    const pool = counts.flatMap(([kind, count]) => Array<ItemKind>(count).fill(kind));
    shuffle(blocks, rng);
    shuffle(pool, rng);
    return pool.slice(0, blocks.length).map((kind, i) => ({
      x: blocks[i]! % width,
      y: Math.floor(blocks[i]! / width),
      kind,
    }));
  }

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
