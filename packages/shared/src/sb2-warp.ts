export type Sb2Cell = Readonly<{ x: number; y: number }>;

/** Pares conferidos por ida e volta no Snes9x, com observação REA simultânea. */
export const SB2_STAGE6_WARP_PAIRS = [
  [{ x: 3, y: 3 }, { x: 11, y: 9 }],
  [{ x: 11, y: 3 }, { x: 3, y: 9 }],
] as const;

export function sb2Stage6WarpDestination(cell: Sb2Cell): Sb2Cell | null {
  for (const pair of SB2_STAGE6_WARP_PAIRS) {
    const index = pair.findIndex(portal => portal.x === cell.x && portal.y === cell.y);
    if (index >= 0) return pair[index ^ 1]!;
  }
  return null;
}

/**
 * Posição nativa antes do deslocamento do frame: a parte inteira é recentrada,
 * preservando as frações. O deslocamento do frame acontece depois da chegada.
 */
export function sb2NativeWarpLanding(position: Sb2Cell, destination: Sb2Cell): Sb2Cell {
  return {
    x: (destination.x + 1) * 16 + position.x % 1,
    y: (destination.y + 2) * 16 + position.y % 1,
  };
}

/** Estado por jogador, preservável ao serializar uma partida. */
export interface Sb2WarpState {
  arrival?: Sb2Cell;
}

/** Consulta em coordenadas nativas, antes do movimento manual de cada frame PAL. */
export function stepSb2Stage6Warp(position: Sb2Cell, state: Sb2WarpState): Sb2Cell {
  const cell = { x: Math.floor((position.x - 8) / 16), y: Math.floor((position.y - 25) / 16) };
  if (state.arrival?.x === cell.x && state.arrival.y === cell.y) return position;
  delete state.arrival;
  const destination = sb2Stage6WarpDestination(cell);
  if (!destination) return position;
  state.arrival = { ...destination };
  return sb2NativeWarpLanding(position, destination);
}
