import { Floor, getTile, isSb2Stage, sb2ArenaNumber, SB2_STAGE_CAPTURES, Tile, type PublicView } from "@bombtop/shared";

/** Cells of sb2-floors.png (scripts/build-sb2-floors.py), in order. */
export const SB2_FLOOR_CELLS = [
  "ice", "launch", "track-arm", "track-hub", "channel-arm", "channel-hub", "plate",
  "pad-1", "pad-2", "pad-3", "pad-4", "pad-5", "pause", "switch-reverse", "switch-speed",
  "arrow", "tunnel", "launcher", "trap", "trap-used", "spring",
] as const;
export type Sb2FloorCell = (typeof SB2_FLOOR_CELLS)[number];

/**
 * A floor piece on tile (x, y). `rotation` is in clockwise quarter turns: arms point right at 0,
 * arrows and launchers point up. `warp` uses the ground effects' portal, `belt` the conveyor art.
 */
export type Sb2FloorDecal =
  | { cell: Sb2FloorCell; x: number; y: number; rotation: number }
  | { cell: "warp"; x: number; y: number; rotation: 0 }
  | { cell: "belt"; x: number; y: number; rotation: 0; belt: Floor };

const STEPS = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const; // rotation 0..3: right, down, left, up
const ARROWS: Record<number, number> = { 60: 0, 61: 2, 62: 1, 63: 3 };
const BELTS: Record<number, Floor> = {
  23: Floor.ConveyorRight, 24: Floor.ConveyorLeft, 25: Floor.ConveyorUp, 26: Floor.ConveyorDown,
  27: Floor.ConveyorDown, 28: Floor.ConveyorLeft, 29: Floor.ConveyorRight, 30: Floor.ConveyorUp,
};
const OPPOSITE: Record<number, Floor> = {
  [Floor.ConveyorRight]: Floor.ConveyorLeft, [Floor.ConveyorLeft]: Floor.ConveyorRight,
  [Floor.ConveyorUp]: Floor.ConveyorDown, [Floor.ConveyorDown]: Floor.ConveyorUp,
};
const PAD = (n: number | undefined) => `pad-${Math.min(5, Math.max(1, n ?? 3))}` as Sb2FloorCell;

/** The floor pieces of an SB2 arena, read off the original's background grid and the arena's state. */
export function sb2FloorDecals(s: PublicView): Sb2FloorDecal[] {
  if (!isSb2Stage(s.stage)) return [];
  const arena = sb2ArenaNumber(s.stage);
  const background = SB2_STAGE_CAPTURES[arena - 1]!.background;
  const code = (x: number, y: number) => background[y]?.[x] ?? -1;
  const sb2 = s.stageState?.sb2;
  const out: Sb2FloorDecal[] = [];
  const add = (cell: Sb2FloorCell, x: number, y: number, rotation = 0) => out.push({ cell, x, y, rotation });
  const linked = (x: number, y: number, kinds: readonly number[], arm: Sb2FloorCell, hub: Sb2FloorCell) => {
    STEPS.forEach(([dx, dy], r) => { if (kinds.includes(code(x + dx, y + dy))) add(arm, x, y, r); });
    add(hub, x, y);
  };
  const { width, height } = s.grid;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const c = code(x, y);
      // A floor piece is only seen where nothing stands on it (a block hides it until it burns).
      if (getTile(s, x, y) !== Tile.Empty) continue;
      if (arena === 2) {
        add("ice", x, y);
        if (c === 73) add("launch", x, y);
        else if (c === 8 || c === 10) linked(x, y, [8, 10, 73], "track-arm", "track-hub");
      }
      if (arena === 3 && (y === 0 || y === height - 1) && (x === 3 || x === 11)) add("tunnel", x, y, y === 0 ? 0 : 2);
      if (arena === 4 && c === 14) linked(x, y, [14], "channel-arm", "channel-hub");
      if (arena === 5 && c === 20) add("plate", x, y);
      if (arena === 6 && c === 80) out.push({ cell: "warp", x, y, rotation: 0 });
      if (arena === 7 && c === 15) add(x < 7 ? PAD(sb2?.stage7?.numbers?.left) : x > 7 ? PAD(sb2?.stage7?.numbers?.right) : "pause", x, y);
      if (arena === 8) {
        const belt = BELTS[c];
        if (belt !== undefined) out.push({ cell: "belt", x, y, rotation: 0, belt: sb2?.conveyor?.control?.reversed ? OPPOSITE[belt]! : belt });
        if (c === 18) add("switch-reverse", x, y);
        if (c === 19) add("switch-speed", x, y);
      }
      if (arena === 9 && c in ARROWS) add("arrow", x, y, ARROWS[c]);
      if (arena === 11 && c === 192) add("launcher", x, y, y === height - 1 ? 0 : y === 0 ? 2 : x === 0 ? 1 : 3);
      if (arena === 12 && c === 75) add(sb2?.stage12Floors?.some(f => f.x === x && f.y === y) ? "trap-used" : "trap", x, y);
      if (arena === 12 && c === 76) add("spring", x, y);
    }
  }
  return out;
}
