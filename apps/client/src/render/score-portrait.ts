import profiles from "./score-portraits.json";
import type { SheetLayout } from "./sprites";

type Point = readonly number[];
interface Profile { url: string; frame: number[]; crop: number[]; outline?: Point[]; box?: number[]; bottom?: number }
export interface ScorePortraitCrop {
  x: number; y: number; width: number; height: number;
  outline?: readonly Point[];
  box?: readonly number[];
  bottom?: number;
}
const byUrl = new Map<string, Profile>(Object.values(profiles).map(profile => [profile.url, profile]));

function inside(x: number, y: number, polygon: readonly Point[]): boolean {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if ((a[1]! > y) !== (b[1]! > y) && x < (b[0]! - a[0]!) * (y - a[1]!) / (b[1]! - a[1]!) + a[0]!) hit = !hit;
  }
  return hit;
}

function trimTransparent({ pixels, width, crop }: {
  pixels: Uint8ClampedArray; width: number; crop: ScorePortraitCrop;
}): ScorePortraitCrop {
  let left = crop.x + crop.width, top = crop.y + crop.height, right = -1, bottom = -1;
  for (let y = crop.y; y < crop.y + crop.height; y++) for (let x = crop.x; x < crop.x + crop.width; x++) {
    if ((pixels[(y * width + x) * 4 + 3] ?? 0) < 32) continue;
    if (crop.outline && !inside(x + 0.5, y + 0.5, crop.outline)) continue;
    left = Math.min(left, x); right = Math.max(right, x);
    top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  if (right < left) return crop;
  return { ...crop, x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

/** A reviewed anatomical region, tightened against original alpha once when the sheet loads. */
export function scorePortraitCrop({ sheet, pixels }: { sheet: SheetLayout; pixels: Uint8ClampedArray }): ScorePortraitCrop {
  const candidate = byUrl.get(sheet.url.split("?")[0]!);
  const profile = candidate?.frame[0] === sheet.frameW && candidate.frame[1] === sheet.frameH ? candidate : undefined;
  const region = profile?.crop ?? [
    Math.max(0, Math.round(sheet.anchorX - sheet.bodyH * 0.31)),
    Math.max(0, Math.round(sheet.anchorY - sheet.bodyH)),
    Math.min(sheet.frameW, Math.round(sheet.bodyH * 0.62)),
    Math.min(sheet.frameH, Math.round(sheet.bodyH * 0.5)),
  ];
  const column = sheet.idle.down.columns?.[0] ?? 0;
  const ox = column * sheet.frameW;
  const oy = sheet.idle.down.row * sheet.frameH;
  const x0 = Math.min(sheet.frameW - 1, region[0]!);
  const y0 = Math.min(sheet.frameH - 1, region[1]!);
  const x1 = Math.min(sheet.frameW, x0 + region[2]!);
  const y1 = Math.min(sheet.frameH, y0 + region[3]!);
  const crop: ScorePortraitCrop = { x: ox + x0, y: oy + y0, width: x1 - x0, height: y1 - y0 };
  if (profile?.outline) crop.outline = profile.outline.map(([x, y]) => [ox + x!, oy + y!]);
  if (profile?.box) crop.box = profile.box;
  if (profile?.bottom !== undefined) crop.bottom = profile.bottom;
  return trimTransparent({ pixels, width: sheet.width, crop });
}

/** Aspect-preserving fit, with reviewed optical allowances for wide hair and tall ears. */
export const scorePortraitScale = ({ width, height, box = [13, 13] }: {
  width: number; height: number; box?: readonly number[] | undefined;
}): number => Math.min(box[0]! / width, box[1]! / height);
