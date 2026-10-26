import { Floor, Tile } from "./state";
import type { StageLayout } from "./stage";
import type { Sb4StageNumber } from "./sb4-stage-definitions";
import { sb4TrolleyRoute } from "./sb4-trolley-route";

/**
 * Group 1, concept/references/sb4-battle/stage-NN.png, 13x11 interior.
 * # hard wall, B soft block, . clear, P pit, F foliage, S surprise panel,
 * L slot button, T seesaw pivot, R rail, G flag, U/D directional floor.
 * Borders are hard walls. Flag posts follow the five seat anchors; the flags
 * themselves are initialized by stage mechanics, independently of this floor.
 * Raised art and players obscure some cells: those cells and paths beneath
 * foliage are inferred from adjacent tiles, not measured ROM collision data.
 * 01/02 share the observed 80-block arrangement, rather than a seeded shuffle.
 * 03 clears the two ball anchors agreed with stage mechanics. 04's pit edges,
 * 06's nine exposed panels, 07's concealed paths/directions, 09's pivots and
 * the other obscured cells are capture-based reconstructions. In these
 * stages the exact obscured soft-block cells still require ROM verification.
 * 05/08 visibly have no soft blocks; 10/12 use the dense visible block pattern.
 * Fixed captures establish this initial arrangement, not original RNG behavior.
 * Stage 11 now overlays the measured ROM trolley route A without clearing
 * blocks from its track. Block placement remains the provisional USUAL preset.
 */
const USUAL = [
  "..BBBB.BBBB..",
  ".#B#.#.#B#B#.",
  "BBB.BBBBBBBBB",
  ".#B#B#B#B#B#B",
  ".BBBB...BBB.B",
  "B#.#B#.#B#B#B",
  "BBBBB...B.BBB",
  "B#B#B#B#B#B#B",
  ".B.BBBBBBBBBB",
  ".#B#.#B#B#.#.",
  "..BBBB.BBBB..",
] as const;

const ROWS: readonly (readonly string[])[] = [
  USUAL,
  USUAL,
  [
    "..BBBB.BBBB..", ".#B#.#.#B#B#.", "BBB.BBBBBBBBB",
    ".#B#B#B#B#B#B", ".BBB....BBB.B", "B#.#B#.#B#B#B",
    "BBBBB.....BBB", "B#B#B#B#B#B#B", ".B.BBBBBBBBBB",
    ".#B#.#B#B#.#.", "..BBBB.BBBB..",
  ],
  [
    "..BBBPPPBBB..", ".#B#BPPPB#B#.", "BBBBBPPPBBBBB",
    "B#B#B#B#B#B#B", "PPPPB...BPPPP", "PPPPB#.#BPPPP",
    "PPPPB...BPPPP", "B#B#B#B#B#B#B", "BBBBBPPPBBBBB",
    ".#B#BPPPB#B#.", "..BBBPPPBBB..",
  ],
  [
    ".............", ".#.#.#.#.#.#.", ".............",
    ".#.#.#.#.#.#.", ".............", ".#.#.#.#.#.#.",
    ".............", ".#.#.#.#.#.#.", ".............",
    ".#.#.#.#.#.#.", ".............",
  ],
  [
    "S.BBBBSBBBB.S", ".#B#B#B#B#B#.", "BBBBBBBBBBBBB",
    "B#B#B#B#B#B#B", "BBBBB...BBBBB", "S#B#B#S#B#B#S",
    "BBBBB...BBBBB", "B#B#B#B#B#B#B", "BBBBBBBBBBBBB",
    ".#B#B#B#B#B#.", "S.BBBBSBBBB.S",
  ],
  [
    "..BBBB.BBBB..", ".#B#B#F#B#B#.", "BBB.FFF.BBBBB",
    "B#F#F#D#B#B#B", "BFFFBB.BBFFFB", "B#F#B#.#B#F#B",
    "BFFFBB.BBFFFB", "B#B#B#U#F#F#B", "BBBBB.FFF.BBB",
    ".#B#B#F#B#B#.", "..BBBB.BBBB..",
  ],
  [
    ".............", ".#.#.#.#.#.#.", ".............",
    ".#.#.#.#.#.#.", ".............", ".#.#.#.#.#.#.",
    "..L...L...L..", ".#.#.#.#.#.#.", ".............",
    ".#.#.#.#.#.#.", ".............",
  ],
  [
    "..BBBB.BBBB..", ".#B#B#B#B#B#.", "BB.T.BBB.T.BB",
    "B#B#B#B#B#B#B", "BBBBB...BBBBB", "B#B#B#.#B#B#B",
    "BBBBB...BBBBB", "B#B#B#B#B#B#B", "BB.T.BBB.T.BB",
    ".#B#B#B#B#B#.", "..BBBB.BBBB..",
  ],
  [
    "..BBBB.BBBB..", ".#B#B#B#B#B#.", "BBBBBBBBBBBBB",
    "B#B#B#B#B#B#B", "BBBBB...BBBBB", "B#B#B#.#B#B#B",
    "BBBBB...BBBBB", "B#B#B#B#B#B#B", "BBBBBBBBBBBBB",
    ".#B#B#B#B#B#.", "..BBBB.BBBB..",
  ],
  USUAL,
  [
    "G.BBBB.BBBB.G", ".#B#B#B#B#B#.", "BBBBBBBBBBBBB",
    "B#B#B#B#B#B#B", "BBBBB...BBBBB", "B#B#B#G#B#B#B",
    "BBBBB...BBBBB", "B#B#B#B#B#B#B", "BBBBBBBBBBBBB",
    ".#B#B#B#B#B#.", "G.BBBB.BBBB.G",
  ],
];

const FEATURES: Readonly<Record<string, Floor>> = {
  P: Floor.Pit, F: Floor.Foliage, S: Floor.Surprise, L: Floor.Slot,
  T: Floor.Seesaw, R: Floor.Rail, G: Floor.Flag,
  U: Floor.ConveyorUp, D: Floor.ConveyorDown,
};

export const SB4_SOFT_BLOCK_COUNTS: readonly number[] = ROWS.map(rows => rows.join("").split("B").length - 1);

export function buildSb4Layout(number: Sb4StageNumber, width: number, height: number): StageLayout {
  if (width !== 15 || height !== 13) throw new Error("SB4 Group 1 layouts require a 15x13 arena");
  const rows = ["###############", ...ROWS[number - 1]!.map(row => `#${row}#`), "###############"];
  const tiles: Tile[] = [];
  const floor: Floor[] = [];
  const keepClear = new Set<number>();
  for (const row of rows) {
    if (row.length !== width) throw new Error(`Invalid SB4 ${number} layout row`);
    for (const cell of row) {
      const feature = FEATURES[cell] ?? Floor.Normal;
      floor.push(feature);
      if (feature !== Floor.Normal) keepClear.add(tiles.length);
      tiles.push(cell === "#" ? Tile.Wall : Tile.Empty);
      if (cell === "B") tiles[tiles.length - 1] = Tile.Block;
    }
  }
  const layout: StageLayout = { tiles, floor, warps: [], keepClear };
  if (number === 11) {
    for (const point of sb4TrolleyRoute()) {
      const index = Math.floor(point.y + 0.5) * width + Math.floor(point.x + 0.5);
      if (tiles[index] !== Tile.Wall) floor[index] = Floor.Rail;
    }
    keepClear.add(5 * width + 7);
  }
  for (let index = 0; index < floor.length; index++) {
    if (floor[index] !== Floor.Seesaw) continue;
    keepClear.add(index - 1);
    keepClear.add(index + 1);
  }
  // Shared with initializeStageMechanics; keep density overrides off both balls.
  if (number === 3) {
    layout.rollingBalls = [{ x: 5, y: 5 }, { x: 9, y: 7 }];
    for (const { x, y } of layout.rollingBalls) keepClear.add(y * width + x);
  }
  return layout;
}
