import { AIR_TICKS_PER_TILE, type AirState } from "@bombtop/shared";

/** Peak height (arena pixels) of a punched or thrown bomb's arc over its whole flight. */
export const PUNCH_HEIGHT = 22;
/** Peak height of a bounce, one tile long. */
export const BOUNCE_HEIGHT = 7;

/** How high a flying bomb is drawn: one arc across its span, as in Super Bomberman 4. */
export function airLift(air: AirState): number {
  const along = (air.span - air.tilesLeft + air.progress / AIR_TICKS_PER_TILE) / air.span;
  return Math.sin(along * Math.PI) * (air.span > 1 ? PUNCH_HEIGHT : BOUNCE_HEIGHT);
}
