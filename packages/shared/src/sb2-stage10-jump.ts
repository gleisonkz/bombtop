import { sb2NativeJumpFlightY } from "./sb2-native-motion";
import type { Facing } from "./state";

/** Estado de voo; reentrada pela borda e colisões no chão são etapas separadas. */
export interface Sb2Stage10Jump {
  originX: number;
  originY: number;
  x: number;
  y: number;
  frame: number;
  targetY: number;
  direction: Facing | null;
  landed: boolean;
  verticalFraction?: number;
}

/** C06852 inicializa +C0 com a parte inteira de Y. */
export function startSb2Stage10Jump(x: number, y: number, direction: Facing | null, verticalFraction = 0): Sb2Stage10Jump {
  return { originX: x, originY: y, x, y, frame: 0, targetY: Math.floor(y) & 255, direction, landed: false,
    ...(verticalFraction ? { verticalFraction } : {}) };
}

/** C0665C/C066F5/C06819: alvo e teste de aterrissagem precedem deslocamento. */
export function advanceSb2Stage10Jump(state: Sb2Stage10Jump, nativeCounter: number): Sb2Stage10Jump {
  if (state.landed) return state;
  const next = { ...state, frame: state.frame + 1 };
  if ((nativeCounter & 1) === 0) {
    if (state.direction === "up") next.targetY = (state.targetY - 1) & 255;
    if (state.direction === "down") next.targetY = (state.targetY + 1) & 255;
  }
  // O comparador nativo usa apenas o byte inteiro; a escrita preserva a fração.
  if (next.frame >= 16 && (Math.floor(state.y) & 255) >= next.targetY) {
    next.y = next.targetY + state.y - Math.floor(state.y);
    next.landed = true;
    return next;
  }
  next.x = state.originX + (state.direction === "right" ? 0.5 : state.direction === "left" ? -0.5 : 0) * next.frame;
  // C06852 escreve +1C=4, mas conserva a fracao anterior em +1E.
  next.y = sb2NativeJumpFlightY(state.originY, next.frame, 4 + (state.verticalFraction ?? 0));
  return next;
}
