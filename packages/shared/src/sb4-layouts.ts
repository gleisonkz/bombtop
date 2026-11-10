import { Floor, Tile } from "./state";
import type { StageLayout } from "./stage";
import { SB4_FLAG_SPAWNS, type Sb4StageNumber } from "./sb4-stage-definitions";
import { sb4TrolleyRoute } from "./sb4-trolley-route";

/**
 * Group 1, concept/references/sb4-battle/stage-NN.png, 13x11 interior.
 * # hard wall, B soft block, . clear, P pit, F foliage, f foliage over a pillar, S surprise panel,
 * L slot button, T seesaw pivot, R rail, >v<^ arrow panel.
 * Borders are hard walls. Flag posts follow the native constructor; the flags
 * themselves are initialized by stage mechanics, independently of this floor.
 * Raised art and players obscure some cells: those cells and paths beneath
 * foliage are inferred from adjacent tiles, not measured ROM collision data.
 * 01/02 share the observed 80-block arrangement, rather than a seeded shuffle. Stages 1-4, 6, 7, 9 and 10 are rolled
 * each round as SB4 does (sb4-layout-roll.ts); their B/. letters only matter with a block density override.
 * 04's pits, 06's open panels and 07's foliage, paths and arrows were checked against the emulator's grids
 * (sb4-evidence/layout): 07's paths under the foliage and its arrows are always open, its pillars hide under it too.
 * 03 clears the two ball anchors agreed with stage mechanics. 09's pivots and
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
    "..BBBPPPBBB..", ".#B#BPPPB#B#.", "BBBBBBBBBBBBB",
    "B#B#B#B#B#B#B", "PPPPB...BPPPP", "PPPPB#.#BPPPP",
    "BBBBB...BBBBB", "B#B#B#B#B#B#B", "BBBBBBBBBBBBB",
    ".#B#BPPPB#B#.", "..BBBPPPBBB..",
  ],
  [
    ".............", ".#.#.#.#.#.#.", ".............",
    ".#.#.#.#.#.#.", ".............", ".#.#.#.#.#.#.",
    ".............", ".#.#.#.#.#.#.", ".............",
    ".#.#.#.#.#.#.", ".............",
  ],
  [
    "..BBBBBBBBB..", ".#B#B#B#B#B#.", "BBBBBBBBBBBBB",
    "B#B#B#B#B#B#B", "BBBBB...BBBBB", "B#B#B#.#B#B#B",
    "BBBBB...BBBBB", "B#B#B#B#B#B#B", "BBBBBBBBBBBBB",
    ".#B#B#B#B#B#.", "..BBBBBBBBB..",
  ],
  [
    "..BBBBBBBBB..", ".#B#BfFfB#B#.", "BB>BBFFFBBvBB",
    "BfBfB#F#BfBfB", "BFFFB...BFFFB", "BfFfB#.#BfFfB",
    "BFFFB...BFFFB", "B#B#BfFfB#B#B", "BB^BBFFFBB<BB",
    ".#B#B#F#B#B#.", "..BBBBBBBBB..",
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
    "..BBBB.BBBB..", ".#B#B#B#B#B#.", "BBBBBBBBBBBBB",
    "B#B#B#B#B#B#B", "BBBBB...BBBBB", "B#B#B#.#B#B#B",
    "BBBBB...BBBBB", "B#B#B#B#B#B#B", "BBBBBBBBBBBBB",
    ".#B#B#B#B#B#.", "..BBBB.BBBB..",
  ],
];

const FEATURES: Readonly<Record<string, Floor>> = {
  P: Floor.Pit, F: Floor.Foliage, S: Floor.Surprise, L: Floor.Slot,
  T: Floor.Seesaw, R: Floor.Rail,
  ">": Floor.ConveyorRight, v: Floor.ConveyorDown, "<": Floor.ConveyorLeft, "^": Floor.ConveyorUp,
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
      const feature = cell === "f" ? Floor.Foliage : FEATURES[cell] ?? Floor.Normal;
      const wall = cell === "#" || cell === "f";
      floor.push(feature);
      if (feature !== Floor.Normal && !wall) keepClear.add(tiles.length);
      tiles.push(wall ? Tile.Wall : Tile.Empty);
      if (cell === "B") tiles[tiles.length - 1] = Tile.Block;
    }
  }
  const layout: StageLayout = { tiles, floor, warps: [], keepClear };
  if (number === 12) {
    for (const point of SB4_FLAG_SPAWNS) {
      const index = point.y * width + point.x;
      floor[index] = Floor.Flag;
      tiles[index] = Tile.Empty;
      keepClear.add(index);
    }
  }
  if (number === 6) {
    // Native persistent map: all 113 non-wall cells are 1C06, including blocks.
    // Do not add these to keepClear: a surprise floor can be buried under a block.
    for (let index = 0; index < tiles.length; index++) {
      if (tiles[index] !== Tile.Wall) floor[index] = Floor.Surprise;
    }
  }
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
