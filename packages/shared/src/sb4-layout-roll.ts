import { Tile } from "./state";

/**
 * How Super Bomberman 4 lays out a battle arena (measured in Snes9x, E:/Projetos/bombtop-src/sb4-evidence/layout):
 * every cell that is neither a wall nor a gimmick starts as a block, only the seats in play are cleared (an absent
 * seat's corner keeps its blocks), then C4179C takes out a few random blocks: up to 15 tries at rand(13)+1,
 * rand(11)+1 each until one lands on a block. The draw goes on from round to round, so each round is new.
 * Only the stages measured so far: 1 and 9.
 */
const HOLES: Readonly<Record<number, number>> = { 1: 14, 9: 4 };
const HOLE_TRIES = 15;

/** The cells cleared for each seat, in seat order (P1..P5). */
const SEAT_CLEARS: readonly (readonly (readonly [number, number])[])[] = [
  [[1, 1], [2, 1], [1, 2]],
  [[13, 11], [12, 11], [13, 10]],
  [[13, 1], [12, 1], [13, 2]],
  [[1, 11], [2, 11], [1, 10]],
  [[7, 6], [6, 5], [7, 5], [8, 5], [6, 7], [7, 7], [8, 7]],
];

/** Rolls the blocks of SB4 stage `number` for `players` seats into `tiles`. Returns false for a stage it does not roll. */
export function rollSb4Blocks(number: number, tiles: Tile[], keepClear: ReadonlySet<number>, width: number, height: number,
  players: number, rng: () => number): boolean {
  const holes = HOLES[number];
  if (holes === undefined) return false;
  for (let index = 0; index < tiles.length; index++) {
    if (tiles[index] !== Tile.Wall && !keepClear.has(index)) tiles[index] = Tile.Block;
  }
  for (const seat of SEAT_CLEARS.slice(0, players)) for (const [x, y] of seat) tiles[y * width + x] = Tile.Empty;
  for (let hole = 0; hole < holes; hole++) {
    for (let tries = 0; tries < HOLE_TRIES; tries++) {
      const index = (Math.floor(rng() * (height - 2)) + 1) * width + Math.floor(rng() * (width - 2)) + 1;
      if (tiles[index] !== Tile.Block) continue;
      tiles[index] = Tile.Empty;
      break;
    }
  }
  return true;
}
