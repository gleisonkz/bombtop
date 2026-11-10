import { DIR_VECTORS, type Facing } from "./state";

/** Projecao do lancamento da arena11; preparacao/animacao ficam separadas. */
export interface Sb2Stage11Flight {
  x: number;
  y: number;
  direction: Facing;
  velocity: number;
  groundSpeed: number;
  done: boolean;
}

export function startSb2Stage11Flight(x: number, y: number, direction: Facing, groundSpeed: number): Sb2Stage11Flight {
  return { x, y, direction, velocity: 5, groundSpeed, done: false };
}

/** WRAM +24/+26=0000:1800 reduz a velocidade em3/32 por passada.
 * Quando a velocidade anterior cai abaixo de1, volta ao movimento de chao
 * na mesma passada; nao recorta o percurso a uma distancia inteira.
 */
export function advanceSb2Stage11Flight(state: Sb2Stage11Flight): Sb2Stage11Flight {
  if (state.done) return state;
  const next = { ...state };
  if (state.velocity < 1) { next.done = true; next.velocity = state.groundSpeed; }
  else next.velocity -= 3 / 32;
  const [dx, dy] = DIR_VECTORS[state.direction];
  next.x += dx * next.velocity;
  next.y += dy * next.velocity;
  return next;
}
