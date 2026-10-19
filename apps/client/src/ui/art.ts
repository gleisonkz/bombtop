/** Body colors of players 1..5, shared by the arena and the menus. */
export const PLAYER_COLORS = ["#f5f5f5", "#3a3a48", "#e84a4a", "#3d7bf2", "#45c25b"] as const;

/** The mascot's navy body, as on the app icon. */
export const MASCOT_COLOR = "#2c2c5a";

export type Mood = "happy" | "wow" | "sad" | "wink";
/** Which way the mascot is seen: facing us, from behind, or from its right side. */
export type MascotView = "front" | "back" | "side";

const HEX = /^#[0-9a-f]{3,8}$/i;

const EYE = (x: number) =>
  `<ellipse cx="${x}" cy="54" rx="7" ry="9" fill="#fff" stroke="#000" stroke-width="2.5"/>` +
  `<g class="pupil"><circle cx="${x + 2}" cy="56" r="3.6" fill="#111"/><circle cx="${x + 3.4}" cy="53.6" r="1.3" fill="#fff"/></g>`;

/** A leg from the hip at (x, 84) to its foot at (foot, y); drawn behind the body. */
const LEG = (side: "left" | "right", x: number, foot: number, y = 100, shade = "#ffb03a") =>
  `<g class="leg ${side}"><path d="M${x} 84 L${foot} ${y}" stroke="#000" stroke-width="5" stroke-linecap="round"/>` +
  `<ellipse class="foot ${side}" cx="${foot}" cy="${y + 2}" rx="10" ry="5" fill="${shade}" stroke="#000" stroke-width="2.5"/></g>`;

/**
 * Both legs at `step` (0..3) of the walk: feet planted apart, then one lifted, then
 * apart the other way, then the other lifted. Seen from the side the far leg is darker.
 */
function legs(view: MascotView, step: number): string {
  if (view === "side") {
    const far = "#d98a20";
    return [
      LEG("left", 44, 30, 100, far) + LEG("right", 52, 64),
      LEG("left", 44, 50, 93, far) + LEG("right", 52, 46),
      LEG("left", 44, 64, 100, far) + LEG("right", 52, 30),
      LEG("left", 44, 46, 100, far) + LEG("right", 52, 50, 93),
    ][step]!;
  }
  return [
    LEG("left", 38, 35) + LEG("right", 58, 61),
    LEG("left", 38, 37, 93) + LEG("right", 58, 61),
    LEG("left", 38, 37, 101) + LEG("right", 58, 59, 101),
    LEG("left", 38, 35) + LEG("right", 58, 59, 93),
  ][step]!;
}

const SMILE = `<path d="M38 70 Q48 80 58 70" fill="#7a1f2b" stroke="#000" stroke-width="2.5" stroke-linejoin="round"/>`;

/** Each mood's eyes (blinked as one group) and mouth. */
const FACES: Record<Mood, { eyes: string; mouth: string }> = {
  happy: { eyes: EYE(38) + EYE(58), mouth: SMILE },
  wow: { eyes: EYE(38) + EYE(58), mouth: `<ellipse cx="48" cy="73" rx="5" ry="6" fill="#7a1f2b" stroke="#000" stroke-width="2.5"/>` },
  sad: {
    eyes: `${EYE(38)}${EYE(58)}<path d="M31 43 L43 46 M65 43 L53 46" stroke="#000" stroke-width="3" stroke-linecap="round"/>`,
    mouth: `<path d="M40 76 Q48 69 56 76" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round"/>`,
  },
  wink: {
    eyes: `<path d="M32 55 Q38 50 44 55" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round"/>${EYE(58)}`,
    mouth: SMILE,
  },
};

/** Seen from its right: the near eye big, the far one peeking past the curve. */
const SIDE_EYE = (x: number, rx: number) =>
  `<ellipse cx="${x}" cy="54" rx="${rx}" ry="9" fill="#fff" stroke="#000" stroke-width="2.5"/>` +
  `<g class="pupil"><circle cx="${x + rx * 0.45}" cy="56" r="3.4" fill="#111"/><circle cx="${x + rx * 0.6}" cy="53.6" r="1.2" fill="#fff"/></g>`;

const SIDE_MOUTHS: Record<Mood, string> = {
  happy: `<path d="M64 70 Q71 77 77 69" fill="#7a1f2b" stroke="#000" stroke-width="2.5" stroke-linejoin="round"/>`,
  wink: `<path d="M64 70 Q71 77 77 69" fill="#7a1f2b" stroke="#000" stroke-width="2.5" stroke-linejoin="round"/>`,
  wow: `<ellipse cx="71" cy="73" rx="4" ry="5.5" fill="#7a1f2b" stroke="#000" stroke-width="2.5"/>`,
  sad: `<path d="M65 76 Q71 70 77 75" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round"/>`,
};

/** The body's markings for a view: highlight, cheeks and face (none from behind). */
function face(view: MascotView, mood: Mood): string {
  if (view === "back") {
    return (
      `<ellipse cx="34" cy="42" rx="9" ry="6" transform="rotate(-35 34 42)" fill="#fff" opacity=".35"/>`
    );
  }
  if (view === "side") {
    return (
      `<ellipse cx="30" cy="44" rx="9" ry="6" transform="rotate(-35 30 44)" fill="#fff" opacity=".35"/>` +
      `<ellipse cx="68" cy="66" rx="4" ry="3" fill="#ff7aa2" opacity=".55"/>` +
      `<g class="eyes">${SIDE_EYE(76, 4.5)}${SIDE_EYE(63, 6.5)}</g>` +
      SIDE_MOUTHS[mood]
    );
  }
  return (
    `<ellipse cx="34" cy="42" rx="9" ry="6" transform="rotate(-35 34 42)" fill="#fff" opacity=".35"/>` +
    `<ellipse cx="29" cy="66" rx="5" ry="3" fill="#ff7aa2" opacity=".55"/>` +
    `<ellipse cx="67" cy="66" rx="5" ry="3" fill="#ff7aa2" opacity=".55"/>` +
    `<g class="eyes">${FACES[mood].eyes}</g>` +
    FACES[mood].mouth
  );
}

/**
 * Bombtop, the mascot: a round bomb with a lit fuse, big eyes and little feet.
 * Returns static SVG markup (only validated colors are interpolated).
 */
export function mascotSvg({
  color = MASCOT_COLOR,
  mood = "happy",
  view = "front",
  step = 0,
}: { color?: string; mood?: Mood; view?: MascotView; step?: number } = {}): string {
  if (!HEX.test(color)) throw new Error(`Not a hex color: ${color}`);
  return (
    `<svg viewBox="0 0 100 108" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
    legs(view, step % 4) +
    `<g class="body">` +
    (view === "back" ? `<g transform="translate(96 0) scale(-1 1)">` : "") + // seen from behind, the fuse leans the other way
    `<path d="M66 22 Q74 8 84 12" fill="none" stroke="#8a6a3c" stroke-width="4" stroke-linecap="round"/>` +
    `<g class="spark"><path d="M86 2 L88.5 9 L96 10 L90 14.5 L92 22 L86 17.5 L80 22 L82 14.5 L76 10 L83.5 9 Z" fill="#ffd23f" stroke="#ff7a1a" stroke-width="1.5" stroke-linejoin="round"/></g>` +
    `<rect x="58" y="20" width="14" height="12" rx="2" transform="rotate(25 65 26)" fill="#5b5f73" stroke="#000" stroke-width="2.5"/>` +
    (view === "back" ? "</g>" : "") +
    `<circle cx="48" cy="60" r="34" fill="${color}" stroke="#000" stroke-width="3"/>` +
    face(view, mood) +
    `</g>` +
    `</svg>`
  );
}

/** An element holding the mascot (markup comes from mascotSvg, never from user input). */
export function mascot(opts: { color?: string; mood?: Mood; className?: string } = {}): HTMLElement {
  const span = document.createElement("span");
  span.className = `mascot ${opts.className ?? ""}`.trim();
  span.innerHTML = mascotSvg(opts);
  return span;
}
