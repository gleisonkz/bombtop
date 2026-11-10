import type { Facing } from "./state";
import { SB2_STAGE_CAPTURES } from "./sb2-stage-captures";

export type Sb2NativeConveyorPosition = Readonly<{ x: number; y: number }>;

export interface Sb2ConveyorControlState {
  readonly reversed: boolean;
  readonly fast: boolean;
}

export const SB2_CONVEYOR_DEFAULT: Sb2ConveyorControlState = { reversed: false, fast: false };

/** Faixa de contato à frente; a coordenada inteira proposta decide o bloqueio. */
export function sb2ConveyorBodyBlocks(direction: Facing | null, next: Sb2NativeConveyorPosition,
  bodies: readonly Sb2NativeConveyorPosition[], reach = 16): boolean {
  const dx = direction === "right" ? 1 : direction === "left" ? -1 : 0;
  const dy = direction === "down" ? 1 : direction === "up" ? -1 : 0;
  return bodies.some(body => {
    const x = Math.floor(body.x) - Math.floor(next.x), y = Math.floor(body.y) - Math.floor(next.y);
    return dx !== 0 ? x * dx > 0 && x * dx < reach && Math.abs(y) < 8
      : dy !== 0 && y * dy > 0 && y * dy < reach && Math.abs(x) < 8;
  });
}

/** Pixels por frame nativo, incluindo a precisão fracionária observada. */
export function sb2NativeConveyorSpeed(fast: boolean): number {
  return (fast ? 0x24fff : 0x8fff) / 65536;
}

/** Uma nova entrada no piso 18 inverte o sentido; no 19 alterna a velocidade. */
export function sb2ConveyorControlEntry(
  state: Sb2ConveyorControlState,
  previousFloorCode: number,
  floorCode: number,
): Sb2ConveyorControlState {
  if (previousFloorCode === floorCode) return state;
  if (floorCode === 18) return { ...state, reversed: !state.reversed };
  if (floorCode === 19) return { ...state, fast: !state.fast };
  return state;
}

/**
 * Direção de saída do piso. O alinhamento fracionário é aplicado por
 * sb2NativeConveyorStep, separadamente da direção.
 */
export function sb2ConveyorOutgoingDirection(floorCode: number, reversed: boolean): Facing | null {
  const clockwise: Record<number, Facing> = {
    23: "right", 24: "left", 25: "up", 26: "down",
    27: "down", 28: "left", 29: "right", 30: "up",
  };
  const counterclockwise: Record<number, Facing> = {
    23: "left", 24: "right", 25: "down", 26: "up",
    27: "left", 28: "up", 29: "down", 30: "right",
  };
  return (reversed ? counterclockwise : clockwise)[floorCode] ?? null;
}

/** Alinha a parte inteira sem perder a fração produzida pelo deslocamento. */
function alignNativeLane(position: number, target: number): number {
  const sign = Math.sign(target - Math.floor(position));
  const next = position + sign * 1.25;
  if (sign * (Math.floor(next) - target) > 0) return target + next % 1;
  return next;
}

/**
 * Um frame nativo na correia livre, sem entrada manual ou colisões com objetos.
 * O ponto de leitura do piso usa Y-25; os centros das faixas usam Y=32+16*linha.
 * Ambos foram confrontados com os percursos completos de jogadores sem itens.
 */
export function sb2NativeConveyorStep(
  position: Sb2NativeConveyorPosition,
  state: Sb2ConveyorControlState,
): Sb2NativeConveyorPosition {
  const column = Math.floor((position.x - 8) / 16);
  const row = Math.floor((position.y - 25) / 16);
  const code = SB2_STAGE_CAPTURES[7].background[row]?.[column] ?? 0;
  const direction = sb2ConveyorOutgoingDirection(code, state.reversed);
  const speed = sb2NativeConveyorSpeed(state.fast);
  if (direction === "left" || direction === "right") {
    const x = position.x + (direction === "right" ? speed : -speed);
    const y = Math.floor(x) === Math.floor(position.x)
      ? position.y : alignNativeLane(position.y, (row + 2) * 16);
    return { x, y };
  }
  if (direction === "up" || direction === "down") {
    const y = position.y + (direction === "down" ? speed : -speed);
    const x = Math.floor(y) === Math.floor(position.y)
      ? position.x : alignNativeLane(position.x, (column + 1) * 16);
    return { x, y };
  }
  return position;
}

/**
 * Transporte de uma bomba móvel; a faixa à frente é bloqueada por jogadores.
 * Confrontado com oito percursos usando posições de jogadores observadas no SNES.
 * Ainda não integra tabela estática, fusível, chute ou colisões entre bombas.
 */
export function sb2NativeConveyorBombDirection(position: Sb2NativeConveyorPosition, state: Sb2ConveyorControlState): Facing | null {
  const column = Math.floor((position.x - 8) / 16), row = Math.floor((position.y - 25) / 16);
  const code = SB2_STAGE_CAPTURES[7].background[row]?.[column] ?? 0;
  let direction = sb2ConveyorOutgoingDirection(code, state.reversed);
  const x = Math.floor(position.x), y = Math.floor(position.y);
  const centerX = (column + 1) * 16, centerY = (row + 2) * 16;
  // A bomba chega ao centro inteiro da curva antes de trocar o eixo.
  if (!state.reversed) {
    if (code === 27 && x < centerX) direction = "right";
    if (code === 28 && y < centerY) direction = "down";
    if (code === 29 && y > centerY) direction = "up";
    if (code === 30 && x > centerX) direction = "left";
  } else {
    if (code === 27 && y > centerY) direction = "up";
    if (code === 28 && x < centerX) direction = "right";
    if (code === 29 && x > centerX) direction = "left";
    if (code === 30 && y < centerY) direction = "down";
  }
  return direction;
}

export function sb2NativeConveyorBombReservation(position: Sb2NativeConveyorPosition, state: Sb2ConveyorControlState,
  cell = { x: Math.floor((position.x - 8) / 16), y: Math.floor((position.y - 25) / 16) }): { x: number; y: number } {
  const direction = sb2NativeConveyorBombDirection(position, state);
  return { x: cell.x + (direction === "right" ? 1 : direction === "left" ? -1 : 0),
    y: cell.y + (direction === "down" ? 1 : direction === "up" ? -1 : 0) };
}

export function sb2NativeConveyorBombStep(
  position: Sb2NativeConveyorPosition,
  state: Sb2ConveyorControlState,
  players: readonly Sb2NativeConveyorPosition[],
): Sb2NativeConveyorPosition {
  const column = Math.floor((position.x - 8) / 16), row = Math.floor((position.y - 25) / 16);
  const x = Math.floor(position.x), y = Math.floor(position.y);
  const centerX = (column + 1) * 16, centerY = (row + 2) * 16;
  const direction = sb2NativeConveyorBombDirection(position, state);
  const speed = sb2NativeConveyorSpeed(state.fast);
  const next = { x: position.x + (direction === "right" ? speed : direction === "left" ? -speed : 0),
    y: position.y + (direction === "down" ? speed : direction === "up" ? -speed : 0) };
  if (direction === "left" || direction === "right") {
    if (Math.floor(next.x) !== x) next.y = centerY + position.y - y;
  } else if (direction === "up" || direction === "down") {
    if (Math.floor(next.y) !== y) next.x = centerX + position.x - x;
  }
  const blocked = sb2ConveyorBodyBlocks(direction, next, players);
  // O bloqueio restaura o eixo de avanço; o alinhamento transversal já ocorreu.
  return blocked ? direction === "left" || direction === "right"
    ? { x: position.x, y: next.y } : { x: next.x, y: position.y } : next;
}
