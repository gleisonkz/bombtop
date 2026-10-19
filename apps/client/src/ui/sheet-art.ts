import { TICK_RATE, type CharacterId } from "@bombtop/shared";
import { paintHues, recolor, SHEETS, type SheetLayout } from "../render/sprites";

/** The sheet each character is drawn from, in the arena and in the menus. */
export const CHARACTER_SHEETS: Record<CharacterId, SheetLayout> = { bomb: SHEETS.bomber, ninja: SHEETS.ninja };

export type PreviewState = "walk" | "idle" | "dizzy";

/** Which row a preview plays and how fast: the same timing as in the arena. */
export function previewPose(sheet: SheetLayout, state: PreviewState): { row: number; frames: number; seconds: number } {
  const strip = state === "walk" ? sheet.walk.down : state === "dizzy" && sheet.stun ? sheet.stun : sheet.idle.down;
  return { row: strip.row, frames: strip.frames, seconds: (strip.frames * sheet.ticksPerFrame) / TICK_RATE };
}

const painted = new Map<string, Promise<string>>();

/** A sheet repainted in a player color, as an image URL (made once per sheet and color). */
function sheetUrl(sheet: SheetLayout, color: string): Promise<string> {
  const key = `${sheet.url}:${color}`;
  let url = painted.get(key);
  if (!url) {
    url = (async () => {
      const img = new Image();
      img.src = `${import.meta.env.BASE_URL}${sheet.url}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = sheet.width;
      canvas.height = sheet.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, sheet.width, sheet.height);
      const rgb = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16)) as [number, number, number];
      if (sheet.clothes) recolor(data.data, sheet.clothes, rgb);
      if (sheet.hues) paintHues(data.data, sheet.hues, rgb);
      ctx.putImageData(data, 0, 0);
      return canvas.toDataURL();
    })();
    painted.set(key, url);
  }
  return url;
}

/**
 * A character for the menus: one row of its sheet played in CSS, standing on the
 * bottom of its box (the box moves it around like the old mascot).
 */
export function characterArt(character: CharacterId, color: string, state: PreviewState = "walk"): HTMLElement {
  const sheet = CHARACTER_SHEETS[character];
  const pose = previewPose(sheet, state);
  const span = document.createElement("span");
  span.className = `mascot sheet ${character}`;
  const sprite = document.createElement("i");
  const vars: Record<string, string> = {
    "--fw": `${sheet.frameW}px`,
    "--fh": `${sheet.frameH}px`,
    "--sw": `${sheet.width}px`,
    "--sh": `${sheet.height}px`,
    "--ax": `${sheet.anchorX}px`,
    "--ay": `${sheet.anchorY}px`,
    "--row": `${pose.row}`,
    "--frames": `${pose.frames}`,
    "--dur": `${pose.seconds}s`,
  };
  for (const [k, v] of Object.entries(vars)) sprite.style.setProperty(k, v);
  span.appendChild(sprite);
  sheetUrl(sheet, color)
    .then((url) => (sprite.style.backgroundImage = `url(${url})`))
    .catch((e) => console.error("character preview", e));
  return span;
}
