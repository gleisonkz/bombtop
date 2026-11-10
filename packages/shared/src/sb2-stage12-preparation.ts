import type { Facing } from "./state";

// C20EB5..0ECF: espera inicial2,comandos2/2/8/2/2 e uma passada de liberacao.
const PREPARATION_FRAMES = 2 + [2, 2, 8, 2, 2].reduce((sum, value) => sum + value, 0) + 1;

export interface Sb2Stage12Preparation {
  x: number;
  y: number;
  frame: number;
  ready: boolean;
  direction: Facing | null;
}

/** C047A5/C0456D recentram a parte inteira e preservam a fracao nativa. */
export function startSb2Stage12Preparation(x: number, y: number): Sb2Stage12Preparation {
  return { x: Math.floor((x + 8) / 16) * 16 + x % 1,
    y: Math.floor((y + 23) / 16) * 16 - 16 + y % 1,
    frame: 0, ready: false, direction: null };
}

/** C04936 consulta o comando corrente somente na partida. */
export function advanceSb2Stage12Preparation(state: Sb2Stage12Preparation,
  direction: Facing | null, floorAvailable = true): Sb2Stage12Preparation {
  if (state.ready) return state;
  // A animacao termina antes das duas chamadas finais do dispatcher do piso.
  // Se a chama cobre o codigo12,essas chamadas esperam o proximo desenho.
  if (state.frame >= PREPARATION_FRAMES - 2 && !floorAvailable) return state;
  const frame = state.frame + 1;
  const ready = frame === PREPARATION_FRAMES;
  return { ...state, frame, ready, direction: ready ? direction : null };
}
