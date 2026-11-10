import { DIR_VECTORS, type Facing } from "./state";

export interface Sb2JumpEscape { x: number; y: number; direction: Facing }

/** Saida forcada de um pixel,com retorno pela borda e alinhamento ao piso livre. */
export function advanceSb2JumpEscape(escape: Sb2JumpEscape,
  occupied: (x: number, y: number) => boolean): boolean {
  const [dx, dy] = DIR_VECTORS[escape.direction];
  escape.x += dx;
  escape.y += dy;
  if (escape.x < 0) escape.x += 256;
  if (escape.x >= 256) escape.x -= 256;
  if (escape.y < 25) escape.y += 208;
  if (escape.y >= 233) escape.y -= 208;
  if (occupied(escape.x, escape.y)) return false;
  if (dx) escape.x = Math.floor((escape.x + 8) / 16) * 16 + escape.x % 1;
  else escape.y = Math.floor((escape.y + 23) / 16) * 16 - 16 + escape.y % 1;
  return true;
}
