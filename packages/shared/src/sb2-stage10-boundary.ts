import { DIR_VECTORS, type Facing } from "./state";

/** Reentrada medida nas quatro bordas da arena10. */
export interface Sb2Stage10Boundary {
  x: number;
  y: number;
  direction: Facing;
  wrapped: boolean;
  done: boolean;
}

export function startSb2Stage10Boundary(x: number, y: number, direction: Facing): Sb2Stage10Boundary {
  // Na aterrissagem vertical sobre a faixa externa, alinha apenas o inteiro.
  if (direction === "up" || direction === "down") y = Math.floor((y + 23) / 16) * 16 - 16 + y % 1;
  return { x, y, direction, wrapped: false, done: false };
}

/** Posição e troca de fase do controle forçado; não resolve entrada no salto.
 * Após voltar à faixa interna, recentra na célula nativa (offsets8/23).
 */
export function advanceSb2Stage10Boundary(state: Sb2Stage10Boundary): Sb2Stage10Boundary {
  if (state.done) return state;
  const next = { ...state };
  const [dx, dy] = DIR_VECTORS[state.direction];
  next.x += dx;
  next.y += dy;
  if (Math.floor(next.x) < 0) { next.x += 256; next.wrapped = true; }
  if (Math.floor(next.x) >= 256) { next.x -= 256; next.wrapped = true; }
  if (Math.floor(next.y) < 25) { next.y += 208; next.wrapped = true; }
  if (Math.floor(next.y) >= 233) { next.y -= 208; next.wrapped = true; }
  if (next.wrapped && (dx ? Math.floor(next.x) >= 24 && Math.floor(next.x) < 232
    : Math.floor(next.y) >= 41 && Math.floor(next.y) < 217)) {
    if (dx) next.x = Math.floor((next.x + 8) / 16) * 16 + next.x % 1;
    else next.y = Math.floor((next.y + 23) / 16) * 16 - 16 + next.y % 1;
    next.done = true;
  }
  return next;
}
