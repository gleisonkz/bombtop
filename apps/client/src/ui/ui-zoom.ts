/** The screens are laid out for up to this much room (the menu's tallest layout needs about 820 px). */
const DESIGN_WIDTH = 1440;
const DESIGN_HEIGHT = 820;
const MAX_ZOOM = 2;

/**
 * How much to grow the screens (menu, lobby, guides) on a big display such as a TV seen from the couch: as far as both
 * the width and the height allow, never below 1 (phones, tablets and laptops stay as they are), at most 2x.
 */
export function uiZoom(width: number, height: number): number {
  return Math.min(MAX_ZOOM, Math.max(1, Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT)));
}
