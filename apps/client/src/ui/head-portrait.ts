import type { CharacterId } from "@bombtop/shared";
import { scorePortraitCrop } from "../render/score-portrait";
import { paintSheet, SHEETS, type SheetLayout } from "../render/sprites";

/** The arena's sheets (the bomb mascot plays from its own atlas there). */
const ARENA_SHEET = (character: CharacterId): SheetLayout =>
  character === "bomb" ? SHEETS.bomber : (SHEETS as unknown as Record<string, SheetLayout>)[character]!;

const images = new Map<string, Promise<HTMLImageElement>>();
const heads = new Map<string, Promise<HTMLCanvasElement>>();

function image(url: string): Promise<HTMLImageElement> {
  let img = images.get(url);
  if (!img) {
    img = new Promise((done, fail) => {
      const el = new Image();
      el.onload = () => done(el);
      el.onerror = () => fail(new Error(`head portrait: ${url}`));
      el.src = `${import.meta.env.BASE_URL}${url}`;
    });
    images.set(url, img);
  }
  return img;
}

/** The head the arena's score bar showed (same reviewed crop), standing still, in the player's paint (null: its own). */
async function head(character: CharacterId, paint: string | null): Promise<HTMLCanvasElement> {
  const sheet = ARENA_SHEET(character);
  const img = await image(sheet.url);
  const full = document.createElement("canvas");
  full.width = sheet.width;
  full.height = sheet.height;
  const ctx = full.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const crop = scorePortraitCrop({ sheet, pixels: ctx.getImageData(0, 0, sheet.width, sheet.height).data });
  if (paint) {
    const row = sheet.idle.down.row;
    const data = ctx.getImageData(0, row * sheet.frameH, sheet.width, sheet.frameH);
    const rgb = [1, 3, 5].map((i) => parseInt(paint.slice(i, i + 2), 16)) as [number, number, number];
    paintSheet(data.data, sheet, rgb, row);
    ctx.putImageData(data, 0, row * sheet.frameH);
  }
  const out = document.createElement("canvas");
  out.width = crop.width;
  out.height = crop.height;
  const o = out.getContext("2d")!;
  if (crop.outline) {
    o.beginPath();
    crop.outline.forEach(([x, y], i) => (i ? o.lineTo(x! - crop.x, y! - crop.y) : o.moveTo(x! - crop.x, y! - crop.y)));
    o.closePath();
    o.clip();
  }
  o.drawImage(full, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
  full.width = full.height = 0; // iOS keeps a canvas's pixels until it is shrunk
  return out;
}

/** A character's head, as in the arena's score bar, for the cards beside the arena (drawn once per look). */
export function headPortrait(character: CharacterId, paint: string | null): HTMLCanvasElement {
  const shown = document.createElement("canvas");
  shown.className = "head-portrait";
  const key = `${character}:${paint}`;
  let made = heads.get(key);
  if (!made) heads.set(key, (made = head(character, paint)));
  made
    .then((src) => {
      shown.width = src.width;
      shown.height = src.height;
      shown.getContext("2d")!.drawImage(src, 0, 0);
    })
    .catch((e) => console.error("head portrait", e));
  return shown;
}
