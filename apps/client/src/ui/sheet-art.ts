import { TICK_RATE, type CharacterId } from "@bombtop/shared";
import { CAST_TICKS_PER_FRAME, paintSheet, SHEETS, type SheetLayout, type Strip } from "../render/sprites";

/** The sheet each character is drawn from, in the arena and in the menus. */
export const CHARACTER_SHEETS: Record<CharacterId, SheetLayout> = { bomb: SHEETS.bomber, ninja: SHEETS.ninja, captain: SHEETS.captain, thor: SHEETS.thor, goku: SHEETS.goku, naruto: SHEETS.naruto, spider: SHEETS.spider, pikachu: SHEETS.pikachu, static: SHEETS.static, flash: SHEETS.flash, bugs: SHEETS.bugs, lantern: SHEETS.lantern, donatello: SHEETS.donatello, penelope: SHEETS.penelope, panther: SHEETS.panther, harry: SHEETS.harry, optimus: SHEETS.optimus, pele: SHEETS.pele };

/** `walk`: the lobby pose (or walking); `win`: the victory pose (or the lobby pose). */
export type PreviewState = "walk" | "win" | "idle" | "dizzy";

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

/** A showpiece (lobby or victory) kept in its own image, as a layout of its own: that image's cells, the sheet's colors and size. */
function ownSheet(sheet: SheetLayout, strip: Strip): SheetLayout | undefined {
  const show = [sheet.lobby, sheet.victory].find((s) => s === strip);
  if (!show?.image) return undefined;
  const { victory: _, ...rest } = sheet;
  return { ...rest, ...show.image, lobby: { row: show.row, frames: show.frames } };
}

/**
 * Which row a preview plays and how fast: the sheet's lobby pose when it has one, else walking; arena timing.
 * `sheet` is set when the row is in another image (a lobby of its own).
 */
export function previewPose(sheet: SheetLayout, state: PreviewState): { row: number; frames: number; seconds: number; sheet?: SheetLayout } {
  const lobby = sheet.lobby ?? sheet.walk.down;
  const strip = state === "walk" ? lobby : state === "win" ? (sheet.victory ?? lobby) : state === "dizzy" && sheet.stun ? sheet.stun : sheet.idle.down;
  const per = state === "idle" && sheet.idleTicksPerFrame ? sheet.idleTicksPerFrame : sheet.ticksPerFrame;
  const pose = { row: strip.row, frames: strip.frames, seconds: (strip.frames * per) / TICK_RATE };
  const own = ownSheet(sheet, strip);
  return own ? { ...pose, sheet: own } : pose;
}

/** One animation of a sheet, as the guide shows it: which row, how many frames, how long one loop lasts. */
export interface Move {
  label: string;
  row: number;
  frames: number;
  seconds: number;
  /** The layout to play it from, when not the character's sheet (a lobby in its own image). */
  sheet?: SheetLayout;
}

/** Every animation a sheet has, each at the speed the arena plays it. */
export function characterMoves(sheet: SheetLayout): Move[] {
  const move = (label: string, strip: Strip | undefined, ticksPerFrame: number): Move[] => {
    if (!strip) return [];
    const m: Move = { label, row: strip.row, frames: strip.frames, seconds: (strip.frames * ticksPerFrame) / TICK_RATE };
    const own = ownSheet(sheet, strip);
    return [own ? { ...m, sheet: own } : m];
  };
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
    ...(sheet.victory ? move("Na sala", sheet.lobby, per) : []),
    ...move("Vitória", sheet.victory ?? sheet.lobby, per),
  ];
}

const painted = new Map<string, Promise<string>>();

/**
 * One row of a sheet repainted in a player color, as an image URL (made once per row and color); null: the whole sheet in
 * its original colors. Only the row a preview plays is repainted: a phone took seconds over whole sheets on opening.
 */
function sheetUrl(sheet: SheetLayout, color: string | null, row: number): Promise<string> {
  if (color === null) return Promise.resolve(`${import.meta.env.BASE_URL}${sheet.url}`);
  const key = `${sheet.url}:${row}:${color}`;
  let url = painted.get(key);
  if (!url) {
    url = queue(async () => {
      const img = await loaded(sheet.url);
      const canvas = document.createElement("canvas");
      canvas.width = sheet.width;
      canvas.height = sheet.frameH;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!; // read back on the CPU, not from the GPU
      ctx.drawImage(img, 0, row * sheet.frameH, sheet.width, sheet.frameH, 0, 0, sheet.width, sheet.frameH);
      const data = ctx.getImageData(0, 0, sheet.width, sheet.frameH);
      const rgb = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16)) as [number, number, number];
      paintSheet(data.data, sheet, rgb);
      ctx.putImageData(data, 0, 0);
      // toBlob encodes off the page's thread (toDataURL held a phone's menu up)
      const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done));
      canvas.width = canvas.height = 0; // iOS keeps a canvas's pixels until it is shrunk
      if (!blob) throw new Error("preview not encoded");
      return URL.createObjectURL(blob);
    });
    painted.set(key, url);
  }
  return url;
}

let line: Promise<unknown> = Promise.resolve();

/**
 * Runs the paint jobs one after another, each in a task of its own: all at once they held a phone's page up for seconds
 * as the menu opened (and its freeze watch fired).
 */
function queue<T>(job: () => Promise<T>): Promise<T> {
  const run = line.then(() => new Promise((next) => setTimeout(next))).then(job);
  line = run.catch(() => {});
  return run;
}

/** A sheet's image, decoded (not kept: a phone's memory holds few whole sheets). */
async function loaded(src: string): Promise<HTMLImageElement> {
  const im = new Image();
  im.src = `${import.meta.env.BASE_URL}${src}`;
  await im.decode();
  return im;
}

/**
 * A character for the menus: one row of its sheet played in CSS, standing on the
 * bottom of its box (the box moves it around like the old mascot). `color` null: the character's original colors.
 */
export function characterArt(character: CharacterId, color: string | null, state: PreviewState | Omit<Move, "label"> = "walk"): HTMLElement {
  const pose = typeof state === "string" ? previewPose(CHARACTER_SHEETS[character], state) : state;
  const sheet = pose.sheet ?? CHARACTER_SHEETS[character];
  const span = document.createElement("span");
  span.className = `mascot sheet ${character}`;
  const sprite = document.createElement("i");
  const vars: Record<string, string> = {
    "--fw": `${sheet.frameW}px`,
    "--fh": `${sheet.frameH}px`,
    "--sw": `${sheet.width}px`,
    // a painted preview is its one row only
    "--sh": `${color === null ? sheet.height : sheet.frameH}px`,
    "--ax": `${sheet.anchorX}px`,
    "--ay": `${sheet.anchorY}px`,
    "--row": `${color === null ? pose.row : 0}`,
    "--frames": `${pose.frames}`,
    "--dur": `${pose.seconds}s`,
    // Same size relative to each other as in the arena; each box zooms with --k.
    "--s": `calc(var(--k) * ${sheet.scale ?? 1})`,
  };
  for (const [k, v] of Object.entries(vars)) sprite.style.setProperty(k, v);
  span.appendChild(sprite);
  sheetUrl(sheet, color, pose.row)
    .then((url) => (sprite.style.backgroundImage = `url(${url})`))
    .catch((e) => console.error("character preview", e));
  return span;
}
