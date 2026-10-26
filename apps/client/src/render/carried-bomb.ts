import type { Bomb } from "@bombtop/shared";
import anchors from "./carry-anchors.json";
import { BOMBS, SHEETS, bombLook, type FrameRect, type SheetLayout } from "./sprites";

interface Grip { x: number; y: number; span: number }
interface CarryFrames { frameW: number; frameH: number; rows: Record<string, Grip[]>; front: boolean }
const sockets = new Map<string, CarryFrames>(Object.entries(anchors.characters).map(([name, frames]) => [
  // Captain's legacy carry cells contain a bomb already; the live body must cover that baked prop.
  SHEETS[name as keyof typeof SHEETS].url.split("?")[0]!, { ...frames, front: name === "captain" },
]));

/** The visible palms, transformed by exactly the same frame, scale and mirror as the character. */
export function carriedBombPose({ sheet, frame, cx, feetY, bomb, tick, headY }: {
  sheet: SheetLayout;
  frame: FrameRect;
  cx: number;
  feetY: number;
  bomb: Pick<Bomb, "fuse" | "type" | "mega">;
  tick: number;
  headY?: number;
}): { x: number; y: number; scale: number; front: boolean } {
  const scale = sheet.scale ?? 1;
  const data = sockets.get(sheet.url.split("?")[0]!);
  const grip = data?.frameW === sheet.frameW && data.frameH === sheet.frameH
    ? data.rows[String(frame.y / sheet.frameH)]?.[frame.x / sheet.frameW] : undefined;
  if (!grip) return { x: cx, y: feetY - 6 - sheet.bodyH * scale, scale: 1, front: false };
  const art = bomb.mega ? BOMBS.mega : BOMBS;
  const look = bombLook({ ...bomb, tick, carrying: true });
  // Opaque body radii, excluding the transparent cell padding and fuse.
  const radius = bomb.mega ? 175 : 42;
  const halfSpan = grip.span * scale / 2;
  const fit = 1;
  const rx = radius * art.scale * look.sx * fit;
  const ry = radius * art.scale * look.sy * fit;
  const mirror = frame.flip ? -1 : 1;
  // A side pose exposes one palm: support the near lower corner rather than burying the body behind the head.
  const side = grip.span === 0;
  const forward = sheet.side === "right" ? mirror : -mirror;
  const supportY = feetY + (grip.y - sheet.anchorY) * scale - ry * (side ? 0.6 : Math.sqrt(Math.max(0, 1 - (halfSpan / rx) ** 2)));
  const headTop = headY ?? feetY - sheet.bodyH * scale;
  return {
    x: cx + (grip.x - sheet.anchorX) * scale * mirror + (side ? forward * rx * 0.8 : 0),
    y: data!.front ? supportY : Math.min(supportY, headTop - ry - 0.5),
    scale: fit,
    front: data!.front,
  };
}
