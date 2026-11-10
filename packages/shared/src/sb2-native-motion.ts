import type { Sb2ArenaNumber } from "./sb2-stage-captures";

/** Posições medidas nas estruturas 7E:8000..8300, na ordem dos jogadores. */
const CORNER_SPAWNS = [
  { x: 1, y: 1 }, { x: 13, y: 11 }, { x: 13, y: 1 }, { x: 1, y: 11 },
] as const;
const CENTRAL_SPAWNS = [
  { x: 5, y: 5 }, { x: 9, y: 7 }, { x: 9, y: 5 }, { x: 5, y: 7 },
] as const;

/** Capturas de quatro jogadores: não define uma quinta posição para SB2. */
export const SB2_SPAWN_POINTS = {
  1: CORNER_SPAWNS, 2: CORNER_SPAWNS, 3: CORNER_SPAWNS, 4: CENTRAL_SPAWNS,
  5: CORNER_SPAWNS, 6: CORNER_SPAWNS, 7: CORNER_SPAWNS, 8: CORNER_SPAWNS,
  9: CORNER_SPAWNS, 10: CORNER_SPAWNS, 11: CORNER_SPAWNS, 12: CORNER_SPAWNS,
} as const satisfies Readonly<Record<Sb2ArenaNumber, readonly { readonly x: number; readonly y: number }[]>>;

/**
 * Quinto jogador (o SB2 só tem quatro): a casa de piso comum mais perto do centro, fora de painéis,
 * placas, trilhos, alçapões e da caveira. `clear` são blocos tirados só quando há cinco jogadores,
 * para ele ter por onde fugir, como os quatro cantos originais.
 */
export const SB2_FIFTH_SPAWN = {
  1: { x: 7, y: 6, clear: [{ x: 7, y: 5 }, { x: 7, y: 7 }] },
  2: { x: 5, y: 6, clear: [] },
  3: { x: 7, y: 5, clear: [{ x: 6, y: 5 }, { x: 8, y: 5 }] },
  4: { x: 7, y: 6, clear: [] },
  5: { x: 7, y: 7, clear: [{ x: 6, y: 7 }] },
  6: { x: 7, y: 6, clear: [{ x: 7, y: 5 }, { x: 7, y: 7 }] },
  7: { x: 7, y: 7, clear: [] },
  8: { x: 7, y: 6, clear: [] },
  9: { x: 7, y: 6, clear: [{ x: 7, y: 5 }, { x: 7, y: 7 }] },
  10: { x: 7, y: 6, clear: [{ x: 7, y: 5 }, { x: 7, y: 7 }] },
  11: { x: 7, y: 5, clear: [] },
  12: { x: 7, y: 5, clear: [{ x: 6, y: 5 }, { x: 8, y: 5 }] },
} as const satisfies Readonly<Record<Sb2ArenaNumber, { readonly x: number; readonly y: number; readonly clear: readonly { readonly x: number; readonly y: number }[] }>>;

/** Referência horizontal/neutra medida em PAL; aterrissagens verticais diferem. */
export const SB2_JUMP_NATIVE_FRAMES = 32;

/** Y visual em voo livre, antes da resolução de aterrissagem/borda.
 * A velocidade vertical passa por dois frames de zero na troca de sentido.
 * Não determina quando o salto termina: nas entradas verticais medidas,
 * a aterrissagem pode acontecer antes ou depois do frame32.
 */
export function sb2NativeJumpFlightY(originY: number, elapsedFrames: number, initialVelocity = 4): number {
  const ascentFrames = Math.ceil(initialVelocity * 4);
  const ascent = Math.min(elapsedFrames, ascentFrames);
  const fallingFrames = Math.max(0, elapsedFrames - ascentFrames - 1);
  return originY - initialVelocity * ascent + ascent * (ascent + 1) / 8
    + fallingFrames * (fallingFrames + 1) / 8;
}

/**
 * Elevação visual em pixels nativos, conferida quadro a quadro na arena 10.
 * A curva mantém três amostras no ápice de 30 px. Não aplica colisões,
 * deslocamento ou travessia de borda: essas regras pertencem à integração.
 */
export function sb2NativeJumpHeight(elapsedFrames: number): number {
  if (elapsedFrames < 0 || elapsedFrames > SB2_JUMP_NATIVE_FRAMES) return 0;
  return Math.max(0, -sb2NativeJumpFlightY(0, elapsedFrames));
}
