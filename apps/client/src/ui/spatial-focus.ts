import type { Direction } from "@bombtop/shared";

/** Where an element sits on the screen (a DOMRect is one). */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * The box to move to from `from` going `dir`, as a controller walks a menu: the nearest one lying that way, those
 * straight ahead before those off to the side. Stays on `from` at an edge; with nothing (or a box no longer listed)
 * focused, starts on the first.
 */
export function nextFocus(from: number | null, boxes: readonly Box[], dir: Exclude<Direction, null>): number | null {
  if (boxes.length === 0) return null;
  const cur = from === null ? undefined : boxes[from];
  if (!cur) return 0;
  const vertical = dir === "up" || dir === "down";
  const sign = dir === "down" || dir === "right" ? 1 : -1;
  let best = from!;
  let bestScore = Infinity;
  boxes.forEach((b, i) => {
    if (i === from) return;
    // How far ahead it starts, along the way we go (a pixel of overlap still counts as ahead).
    const ahead = vertical
      ? sign > 0 ? b.top - (cur.top + cur.height) : cur.top - (b.top + b.height)
      : sign > 0 ? b.left - (cur.left + cur.width) : cur.left - (b.left + b.width);
    if (ahead < -1) return;
    // How far off to the side: 0 when the two overlap across the way we go.
    const [aStart, aSize, bStart, bSize] = vertical ? [cur.left, cur.width, b.left, b.width] : [cur.top, cur.height, b.top, b.height];
    const aside = Math.max(0, bStart - (aStart + aSize), aStart - (bStart + bSize));
    // Between equals, the one whose middle lines up best.
    const offCenter = Math.abs(bStart + bSize / 2 - (aStart + aSize / 2));
    const score = Math.max(0, ahead) + 2 * aside + offCenter / 1000;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}
