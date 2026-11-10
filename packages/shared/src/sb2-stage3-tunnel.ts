/** C04E20/C04EC2/C04F64/C050E0: troca apenas a palavra inteira de Y.
 * A física do primeiro quadro usa o bit de subida nas quatro entradas.
 * Não executa reservas, bloqueios de destino ou o avanço nos quadros seguintes.
 */
export function sb2Stage3TunnelEntry(y: number, edge: "top" | "bottom", nativeSpeed: number): { y: number; vy: number } {
  return { y: (edge === "top" ? 239 : 17) + y - Math.floor(y), vy: -nativeSpeed };
}
