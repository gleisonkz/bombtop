import type { SheetLayout } from "../../src/render/sprites";

const strips = (down: number, side: number, up: number, frames: number) => ({
  down: { row: down, frames }, side: { row: side, frames }, up: { row: up, frames },
});

export const TEST_SHEETS = {
  foozle: {
    url: "fixture:foozle",
    width: 1344,
    height: 4928,
    frameW: 64,
    frameH: 64,
    anchorX: 32,
    anchorY: 46,
    bodyH: 23,
    ticksPerFrame: 6,
    side: "right",
    idle: strips(0, 26, 51, 1),
    walk: strips(3, 29, 54, 8),
    carryIdle: strips(5, 31, 56, 1),
    carryWalk: strips(6, 32, 57, 8),
    clothes: [[82, 174, 35], [58, 123, 25], [4, 57, 31]],
  },
  james: {
    url: "fixture:james",
    width: 64,
    height: 128,
    frameW: 8,
    frameH: 16,
    anchorX: 4,
    anchorY: 15,
    bodyH: 17,
    ticksPerFrame: 8,
    side: "right",
    idle: { down: { row: 0, frames: 1 }, side: { row: 3, frames: 1 }, up: { row: 2, frames: 1 } },
    walk: strips(1, 3, 2, 4),
    clothes: [[235, 115, 201], [255, 173, 198]],
  },
} as const satisfies Record<string, SheetLayout>;
