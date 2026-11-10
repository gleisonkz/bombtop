import { SB2_STAGE_CAPTURES } from "./sb2-stage-captures";
import type { Sb2Cell } from "./sb2-warp";

/** Canaleta observada da arena 4; os demais pisos não são convertidos. */
export const SB2_CHANNEL_CELLS: readonly Sb2Cell[] = SB2_STAGE_CAPTURES[3].background.flatMap((row, y) =>
  row.flatMap((code, x) => code === 14 ? [{ x, y }] : []));

/** Janela da ignição isolada medida em frames nativos, não ticks de 60 Hz. */
export const SB2_CHANNEL_NATIVE_FRAMES = 30;
export const SB2_CHANNEL_TRIGGER_DELAY_NATIVE_FRAMES = 1;

/**
 * O frame zero é o contato da explosão com a canaleta. Reativações e a
 * sobreposição com chamas normais não estão modeladas por esta função.
 */
export function sb2ChannelActive(elapsedNativeFrames: number): boolean {
  return elapsedNativeFrames >= SB2_CHANNEL_TRIGGER_DELAY_NATIVE_FRAMES
    && elapsedNativeFrames < SB2_CHANNEL_TRIGGER_DELAY_NATIVE_FRAMES + SB2_CHANNEL_NATIVE_FRAMES;
}

/** C03A92/C0E919: o temporizador de três frames é preservado quando fica inativo. */
export interface Sb2ChannelClock {
  index: number;
  timer: number;
}

export function requestSb2Channel(clock: Sb2ChannelClock): void {
  if (clock.index < 0) clock.index = 0;
}

/** Retorna o índice desenhado: 0..9 fogo, 10 restauração; null se não desenhou. */
export function advanceSb2ChannelClock(clock: Sb2ChannelClock): number | null {
  if (clock.index < 0) return null;
  if (clock.timer > 1) { clock.timer--; return null; }
  clock.timer = 3;
  const drawn = clock.index;
  clock.index = drawn === 10 ? -1 : drawn + 1;
  return drawn;
}
