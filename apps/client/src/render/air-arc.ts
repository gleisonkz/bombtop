import { AIR_TICKS_PER_TILE, type AirState } from "@bombtop/shared";

/** Peak height (arena pixels) of a punched or thrown bomb's arc over its whole flight. */
export const PUNCH_HEIGHT = 22;
/** Peak height of a bounce, one tile long. */
export const BOUNCE_HEIGHT = 7;

/** A seesaw's throw: 27 px at the top of its arc, 6 px bounces (e-bomb-on-launch-end, e-bomb-launched-off-edge). */
const SEESAW_HEIGHT = 27;
const SEESAW_BOUNCE_HEIGHT = 6;

/** How far across the current tile a flying bomb is, 0..1, at its own pace (a seesaw throws faster than a punch). */
export function airStep(air: AirState): number {
  return Math.max(0, Math.min(1, air.progress / (air.ticksPerTile ?? AIR_TICKS_PER_TILE)));
}

/** How high a flying bomb is drawn: one arc across its span, as in Super Bomberman 4. */
export function airLift(air: AirState): number {
  const along = (air.span - air.tilesLeft + airStep(air)) / air.span;
  const peak = air.seesaw ? (air.span > 1 ? SEESAW_HEIGHT : SEESAW_BOUNCE_HEIGHT) : air.span > 1 ? PUNCH_HEIGHT : BOUNCE_HEIGHT;
  return Math.sin(along * Math.PI) * peak;
}
