import type { FrameRect, SheetLayout, Strip } from "./sprites";

interface ArtAnchor { x: number; y: number }
export type HeadAnchors = ReadonlyMap<number, ArtAnchor>;

export function buildHeadAnchors(data: Uint8ClampedArray, sheet: SheetLayout): HeadAnchors {
  const strips: Strip[] = [...Object.values(sheet.idle), ...Object.values(sheet.walk)];
  const carryStrips = [...Object.values(sheet.carryIdle ?? {}), ...Object.values(sheet.carryWalk ?? {})];
  const carryRows = new Set(carryStrips.map(strip => strip.row));
  strips.push(...carryStrips);
  if (sheet.stun) strips.push(sheet.stun);
  const rows = new Map<number, Set<number>>();
  for (const strip of strips) {
    const columns = rows.get(strip.row) ?? new Set<number>();
    for (let frame = 0; frame < strip.frames; frame++) columns.add(strip.columns?.[frame] ?? frame);
    rows.set(strip.row, columns);
  }
  const anchors = new Map<number, ArtAnchor>();
  for (const [row, columns] of rows) {
    const scanLeft = carryRows.has(row) ? Math.max(0, Math.round(sheet.anchorX - sheet.bodyH / 8)) : 0;
    const scanRight = carryRows.has(row) ? Math.min(sheet.frameW, Math.round(sheet.anchorX + sheet.bodyH / 8)) : sheet.frameW;
    let left = sheet.frameW;
    let right = -1;
    let top = sheet.frameH;
    const opaque = (column: number, x: number, y: number) =>
      (data[((row * sheet.frameH + y) * sheet.width + column * sheet.frameW + x) * 4 + 3] ?? 0) >= 128;
    for (const column of columns) {
      for (let y = 0; y < top; y++) {
        let found = false;
        for (let x = scanLeft; x < scanRight; x++) {
          if (!opaque(column, x, y)) continue;
          top = y;
          found = true;
          break;
        }
        if (found) break;
      }
    }
    const headBottom = Math.min(sheet.frameH, top + Math.max(1, Math.ceil((sheet.anchorY - top) / 3)));
    for (const column of columns) {
      for (let y = top; y < headBottom; y++) {
        for (let x = 0; x < sheet.frameW; x++) {
          if (!opaque(column, x, y)) continue;
          left = Math.min(left, x);
          right = Math.max(right, x);
        }
      }
    }
    if (right >= left) anchors.set(row, { x: (left + right + 1) / 2, y: top });
  }
  return anchors;
}

export function headAnchor({ sheet, anchors, frame, x, feetY, headRow }: {
  sheet: SheetLayout; anchors: HeadAnchors; frame: FrameRect; x: number; feetY: number; headRow?: number | undefined;
}): { x: number; headY: number } {
  const anchor = anchors.get(headRow ?? frame.y / sheet.frameH);
  const scale = sheet.scale ?? 1;
  return {
    x: x + (anchor ? (anchor.x - sheet.anchorX) * scale * (frame.flip ? -1 : 1) : 0),
    headY: feetY + (anchor ? (anchor.y - sheet.anchorY) * scale : -sheet.bodyH * scale),
  };
}

export function avoidHeldBomb(head: { x: number; headY: number }, bomb: { x: number; y: number; rx: number; ry: number }): { x: number; headY: number } {
  const halfWidth = 16;
  const bottom = head.headY + 1;
  const top = bottom - 16;
  if (bottom <= bomb.y - bomb.ry || top >= bomb.y + bomb.ry || Math.abs(head.x - bomb.x) >= bomb.rx + halfWidth + 1) return head;
  const direction = head.x <= bomb.x ? -1 : 1;
  return { x: bomb.x + direction * (bomb.rx + halfWidth + 1), headY: head.headY };
}
