import { SB2_STAGE_CAPTURES } from "./sb2-stage-captures";

/** C03583: no plantio sobre a placa, grava índice9 (alcance10) na bomba.
 * Não muda o inventário. Chute/luva sobre essas placas ainda exigem ensaios.
 */
export function sb2Stage5BombRange(x: number, y: number, inventoryRange: number): number {
  return SB2_STAGE_CAPTURES[4].background[y]?.[x] === 20 ? 10 : inventoryRange;
}
