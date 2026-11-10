import type { PlayerInput } from "./state";

/** Movimento e bomba medidos; não define regras para especiais do Bombtop. */
export type Sb2PauseInput = Readonly<Pick<PlayerInput, "dir" | "bomb">>;

/** Frames PAL imóveis, contando o frame de entrada como zero. */
export const SB2_PAUSE_FROZEN_FRAMES = 127;

/**
 * A pausa bloqueia a execução de comandos por 127 frames. Na liberação usa
 * uma vez o comando capturado na entrada; só depois consulta o comando atual.
 * null bloqueia comandos, não dano ou atualização do restante da partida.
 */
export function sb2NativePauseInput(
  elapsedFrames: number,
  entryInput: Sb2PauseInput,
  currentInput: Sb2PauseInput,
): Sb2PauseInput | null {
  if (elapsedFrames < 0) return currentInput;
  if (elapsedFrames < SB2_PAUSE_FROZEN_FRAMES) return null;
  if (elapsedFrames === SB2_PAUSE_FROZEN_FRAMES) return entryInput;
  return currentInput;
}
