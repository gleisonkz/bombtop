import { SB2_ITEM_COUNTS, SB2_ITEM_GLYPHS } from "./sb2-item-tables";
import { nextSb2RandomWord } from "./sb2-rng";
import type { Sb2ArenaNumber } from "./sb2-stage-captures";

export interface Sb2ItemBag {
  slots: number[];
  seed: number;
  draws: number;
}

/** C01CF2: coloca os itens em posições vagas de uma bolsa de 64 entradas. */
export function createSb2ItemBag(arena: Sb2ArenaNumber, seed: number): Sb2ItemBag {
  const bag: Sb2ItemBag = { slots: new Array(64).fill(0x8000), seed: seed & 0xffff, draws: 0 };
  let kind = 0, placed = 0;
  while (true) {
    let slot: number;
    do {
      const random = nextSb2RandomWord(bag.seed);
      bag.seed = random.seed;
      bag.draws++;
      slot = random.word & 63;
    } while (bag.slots[slot]! < 0x8000);
    // A chamada anterior também acontece para contagem zero e para o terminador.
    if (kind === SB2_ITEM_GLYPHS.length) return bag;
    if (placed === SB2_ITEM_COUNTS[arena][kind]) {
      kind++; placed = 0;
      continue;
    }
    placed++;
    bag.slots[slot] = SB2_ITEM_GLYPHS[kind]!;
  }
}

/** C0DE24: consome a primeira entrada não usada; 0x8000 significa nenhum item. */
export function takeSb2Item(bag: Pick<Sb2ItemBag, "slots">): number | null {
  const index = bag.slots.findIndex(value => value !== 0);
  if (index < 0) return null;
  const glyph = bag.slots[index]!;
  bag.slots[index] = 0;
  return glyph & 0x8000 ? null : glyph;
}
