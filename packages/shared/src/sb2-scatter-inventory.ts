import { ItemKind, type Player } from "./state";
import { SB2_ITEM_SPEEDS } from "./sb2-items";
import { TILE } from "./constants";

/** C5EDFF e C5EDDD: quantidade e ordem de busca por indice aleatorio. */
const COUNTS = [1, 1, 2, 2, 2, 2, 1, 3, 1, 1, 2, 2, 2, 2, 1, 3] as const;
const HANDLERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2, 7] as const;

/** C09155/C08F02; ramos Speed/Bomb/Fire/Glove/Kick conferidos nas capturas atuais.
 * Outros atributos,FullFire e maldicoes ainda exigem seus ramos nativos.
 */
export function scatterSb2BasicInventory(player: Player, randomWord: number): ItemKind[] {
  let cursor = randomWord & 15;
  const result: ItemKind[] = [];
  for (let remaining = COUNTS[cursor]!; remaining > 0; remaining--) {
    let found = false;
    for (let searched = 0; searched < 16; searched++) {
      const handler = HANDLERS[cursor];
      const speedIndex = SB2_ITEM_SPEEDS.findIndex(speed => speed * TILE / 16 === player.speed);
      if (handler === 0 && speedIndex > 1) {
        player.speed = SB2_ITEM_SPEEDS[speedIndex - 1]! * TILE / 16;
        result.push(ItemKind.Speed);
        found = true;
        break;
      }
      if (handler === 1 && player.bombCapacity > 1) {
        player.bombCapacity--;
        result.push(ItemKind.Bomb);
        found = true;
        break;
      }
      if (handler === 2 && player.fireRange > 2) {
        player.fireRange--;
        result.push(ItemKind.Fire);
        found = true;
        break;
      }
      if (handler === 4 && player.canGlove) {
        player.canGlove = false;
        result.push(ItemKind.Glove);
        found = true;
        break;
      }
      if (handler === 5 && player.canKick) {
        player.canKick = false;
        result.push(ItemKind.Kick);
        found = true;
        break;
      }
      cursor = (cursor + 1) & 15;
    }
    if (!found) break;
  }
  return result;
}
