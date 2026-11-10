import type { Facing } from "./state";

export interface Sb2ArrowBombEntry {
  x: number;
  y: number;
  locked: boolean;
  direction: Facing | null;
}

/** C10F81/C19BFB/C1C6CE: entrada na seta, em pixels nativos.
 * O chamador mantém a trava +C0 e fornece a célula ocupada +A8.
 * Não resolve deslocamento, colisões, fusível ou início por chute.
 */
export function sb2Stage9ArrowEntry(
  position: Readonly<{ x: number; y: number }>,
  cell: Readonly<{ x: number; y: number }>,
  floorCode: number,
  locked: boolean,
  stopped: boolean,
): Sb2ArrowBombEntry {
  if ((floorCode & 63) < 60) return { ...position, locked: false, direction: null };
  if (locked || stopped) return { ...position, locked, direction: null };
  const centerX = (cell.x + 1) * 16, centerY = (cell.y + 2) * 16;
  // C5D908 fornece limite6 ao teste estrito de C19BFB.
  if (Math.abs(Math.floor(position.x) - centerX) >= 6
    || Math.abs(Math.floor(position.y) - centerY) >= 6) {
    return { ...position, locked, direction: null };
  }
  // Os handlers comparam a palavra inteira após o teste inicial dos seis bits.
  const directions: Partial<Record<number, Facing>> = { 60: "up", 61: "down", 62: "right", 63: "left" };
  return { x: centerX + position.x % 1, y: centerY + position.y % 1,
    locked: true, direction: directions[floorCode] ?? null };
}
