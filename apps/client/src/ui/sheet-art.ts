import { TICK_RATE, type CharacterId } from "@bombtop/shared";
import { CAST_TICKS_PER_FRAME, paintSheet, SHEETS, type SheetLayout, type Strip } from "../render/sprites";

/** The sheet each character is drawn from, in the arena and in the menus. */
export const CHARACTER_SHEETS: Record<CharacterId, SheetLayout> = { bomb: SHEETS.bomber, ninja: SHEETS.ninja, captain: SHEETS.captain, thor: SHEETS.thor, goku: SHEETS.goku, naruto: SHEETS.naruto };

export type PreviewState = "walk" | "idle" | "dizzy";

export const TITLE_BOMBER_SHEET = {
  url: "sprites/bomber-title-fly.png",
  columns: 4,
  rows: 2,
  frames: 8,
} as const;

/** Bomber's dedicated eight-frame airborne loop for the title-screen hero. */
export function titleBomberArt(): HTMLElement {
  const span = document.createElement("span");
  span.className = "mascot title-bomber";
  span.appendChild(document.createElement("i"));
  return span;
}

/** Which row a preview plays and how fast: the sheet's lobby pose when it has one, else walking; arena timing. */
export function previewPose(sheet: SheetLayout, state: PreviewState): { row: number; frames: number; seconds: number } {
  const strip = state === "walk" ? (sheet.lobby ?? sheet.walk.down) : state === "dizzy" && sheet.stun ? sheet.stun : sheet.idle.down;
  const per = state === "idle" && sheet.idleTicksPerFrame ? sheet.idleTicksPerFrame : sheet.ticksPerFrame;
  return { row: strip.row, frames: strip.frames, seconds: (strip.frames * per) / TICK_RATE };
}

/** One animation of a sheet, as the guide shows it: which row, how many frames, how long one loop lasts. */
export interface Move {
  label: string;
  row: number;
  frames: number;
  seconds: number;
}

/** Every animation a sheet has, each at the speed the arena plays it. */
export function characterMoves(sheet: SheetLayout): Move[] {
  const move = (label: string, strip: Strip | undefined, ticksPerFrame: number): Move[] =>
    strip ? [{ label, row: strip.row, frames: strip.frames, seconds: (strip.frames * ticksPerFrame) / TICK_RATE }] : [];
  const per = sheet.ticksPerFrame;
  return [
    ...move("Parado", sheet.idle.down, sheet.idleTicksPerFrame ?? per),
    ...move("Andando (frente)", sheet.walk.down, per),
    ...move("Andando (lado)", sheet.walk.side, per),
    ...move("Andando (costas)", sheet.walk.up, per),
    ...move("Carregando bomba", sheet.carryWalk?.down, per),
    ...move("Especial (frente)", sheet.cast?.down, CAST_TICKS_PER_FRAME),
    ...move("Especial (lado)", sheet.cast?.side, CAST_TICKS_PER_FRAME),
    ...move("Tonto", sheet.stun, per),
    ...move("Derrota", sheet.death, per),
    ...move("Vitória", sheet.lobby, per),
  ];
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
      paintSheet(data.data, sheet, rgb);
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
export function characterArt(character: CharacterId, color: string, state: PreviewState | Omit<Move, "label"> = "walk"): HTMLElement {
  const sheet = CHARACTER_SHEETS[character];
  const pose = typeof state === "string" ? previewPose(sheet, state) : state;
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
    // Same size relative to each other as in the arena; each box zooms with --k.
    "--s": `calc(var(--k) * ${sheet.scale ?? 1})`,
  };
  for (const [k, v] of Object.entries(vars)) sprite.style.setProperty(k, v);
  span.appendChild(sprite);
  sheetUrl(sheet, color)
    .then((url) => (sprite.style.backgroundImage = `url(${url})`))
    .catch((e) => console.error("character preview", e));
  return span;
}
