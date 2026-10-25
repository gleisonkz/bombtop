import { Floor } from "./state";

export type StageId = "classic" | "conveyor" | "warp";

export const STAGES: readonly StageId[] = ["classic", "conveyor", "warp"];

export interface StageLayout {
  floor: Floor[];
  warps: { x: number; y: number }[];
  /** Tile indices that must never start with a block. */
  keepClear: Set<number>;
}

/** Floor gimmicks for a stage on a width x height arena. */
export function buildStage(id: StageId, width: number, height: number): StageLayout {
  const floor: Floor[] = new Array(width * height).fill(Floor.Normal);
  const keepClear = new Set<number>();
  const warps: { x: number; y: number }[] = [];
  const mark = (x: number, y: number, f: Floor) => {
    floor[y * width + x] = f;
    keepClear.add(y * width + x);
  };

  if (id === "conveyor") {
    for (let x = 1; x < width - 1; x++) {
      mark(x, 3, Floor.ConveyorRight);
      mark(x, height - 4, Floor.ConveyorLeft);
    }
  }

  if (id === "warp") {
    // Diagonal pairs: top-left <-> bottom-right, top-right <-> bottom-left.
    warps.push(
      { x: 3, y: 1 },
      { x: width - 4, y: height - 2 },
      { x: width - 4, y: 1 },
      { x: 3, y: height - 2 },
    );
    for (const w of warps) mark(w.x, w.y, Floor.Warp);
  }

  return { floor, warps, keepClear };
}
