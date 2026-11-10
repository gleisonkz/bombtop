import { sb2NativeJumpFlightY } from "./sb2-native-motion";

/** Voo horizontal livre; preparo, pouso e reentrada sao resolvidos pelo controlador. */
export interface Sb2Stage12HorizontalFlight {
  x: number;
  y: number;
  originY: number;
  frame: number;
  direction: "left" | "right";
}

/** C04B91 escreve +14=1,+16=3000; C04B16 e o ramo simetrico. */
export function startSb2Stage12HorizontalFlight(x: number, y: number,
  direction: "left" | "right"): Sb2Stage12HorizontalFlight {
  return { x, y, originY: y, frame: 0, direction };
}

/** C04A95 inicializa UP com6; C04A0D inicializa DOWN com3.
 * Retorna somente a projecao livre,antes do teste de alvo/escape.
 */
export function sb2Stage12VerticalFlightY(originY: number, elapsedFrames: number,
  direction: "up" | "down"): number {
  return sb2NativeJumpFlightY(originY, elapsedFrames, direction === "up" ? 6 : 3);
}

export interface Sb2Stage12VerticalFlight {
  originY: number;
  y: number;
  frame: number;
  targetY: number;
  direction: "up" | "down";
  landed: boolean;
}

/** Os bytes CD/CC guardam a origem inteira e o alvo deslocado48 pixels. */
export function startSb2Stage12VerticalFlight(y: number,
  direction: "up" | "down"): Sb2Stage12VerticalFlight {
  return { originY: y, y, frame: 0, direction, landed: false,
    targetY: (Math.floor(y) + (direction === "up" ? -48 : 48)) & 255 };
}

/** A resolucao de terreno/escape apos o alvo pertence ao chamador. */
export function advanceSb2Stage12VerticalFlight(state: Sb2Stage12VerticalFlight,
  nativeCounter: number, verticalInput: -1 | 0 | 1): Sb2Stage12VerticalFlight {
  if (state.landed) return state;
  const next = { ...state, frame: state.frame + 1 };
  if (!(nativeCounter & 1)) next.targetY = (state.targetY + verticalInput) & 255;
  const ascentFrames = state.direction === "up" ? 24 : 12;
  if (next.frame > ascentFrames && (Math.floor(state.y) & 255) >= next.targetY) {
    next.y = next.targetY + state.y - Math.floor(state.y);
    next.landed = true;
  } else next.y = sb2Stage12VerticalFlightY(state.originY, next.frame, state.direction);
  return next;
}

export function advanceSb2Stage12HorizontalFlight(state: Sb2Stage12HorizontalFlight,
  horizontalInput: -1 | 0 | 1): Sb2Stage12HorizontalFlight {
  const frame = state.frame + 1;
  return { ...state, frame,
    x: state.x + (state.direction === "right" ? 1.1875 : -1.1875) + horizontalInput * 0.375,
    y: sb2NativeJumpFlightY(state.originY, frame, 5) };
}
