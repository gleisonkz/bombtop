export type Sb2PadNumber = 1 | 2 | 3 | 4 | 5;

/**
 * Pixels por frame PAL após entrar na placa numerada da arena 7.
 * O efeito usa o número anterior à entrada; a placa define o número da próxima
 * passagem, que pode se repetir.
 */
export function sb2NativeNumberedPadSpeed(number: Sb2PadNumber): number {
  const speeds: Record<Sb2PadNumber, number> = {
    1: 0.375,
    2: 0.8125,
    3: 1.25,
    4: 3,
    5: 3.5,
  };
  return speeds[number];
}

/**
 * Tabela nativa indexada pelos bits 1–3 da palavra aleatória do jogo.
 * A palavra vem de fora: esta função não reproduz o gerador global da ROM.
 */
export function sb2NextPadNumber(randomWord: number): Sb2PadNumber {
  const choices: readonly Sb2PadNumber[] = [1, 2, 3, 4, 5, 5, 4, 3];
  return choices[(randomWord & 0x000e) >>> 1]!;
}
