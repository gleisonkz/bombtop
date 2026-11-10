import { TICK_RATE } from "./constants";

/** Razão PAL exposta pelo Snes9x e conferida na DLL carregada pelo MCP. */
export const SB2_NATIVE_CLOCK = { cyclesPerSecond: 21_281_370, cyclesPerFrame: 425_568 } as const;

/**
 * Frames nativos decorridos após um número inteiro de ticks da simulação.
 * A origem tem fase zero; BigInt evita acumular arredondamento entre ticks.
 */
export function sb2NativeFramesAfterTicks(ticks: number): number {
  return Number(BigInt(ticks) * BigInt(SB2_NATIVE_CLOCK.cyclesPerSecond)
    / (BigInt(SB2_NATIVE_CLOCK.cyclesPerFrame) * BigInt(TICK_RATE)));
}

/** Quantos passos nativos executar ao completar o tick indicado (primeiro = 1). */
export function sb2NativeFramesOnTick(tick: number): number {
  if (tick === 0) return 0;
  return sb2NativeFramesAfterTicks(tick) - sb2NativeFramesAfterTicks(tick - 1);
}
