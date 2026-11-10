import { ItemKind, type Player } from "./state";
import { SB2_ITEM_SPEEDS } from "./sb2-items";
import { TILE } from "./constants";

export interface Sb2ItemReturn {
  available: number[];
  queue: number[];
  cursor: number;
  resumeNativeFrame: number;
}

/** C09712: varredura0204..07FE,repetida ate preencher128palavras. */
export function sb2ReturnCells(readCode: (x: number, y: number) => number): number[] {
  const cells: number[] = [];
  for (let cell = 0x204; cell < 0x800; cell += 2) {
    const code = readCode((cell % 128) / 2 - 1, Math.floor(cell / 128) - 3);
    if (code === 0 || ![17, 18, 19, 0x44, 1].includes(code) && !(code & 0xc0)) cells.push(cell);
  }
  return cells.length ? Array.from({ length: 128 }, (_, index) => cells[index % cells.length]!) : [];
}

/** C097A0/C5FF7D: fila sem alterar os atributos restantes do jogador. */
export function sb2BasicReturnQueue(player: Player): number[] {
  const speed = SB2_ITEM_SPEEDS.findIndex(value => value * TILE / 16 === player.speed);
  return [...Array<number>(Math.max(0, player.bombCapacity - 1)).fill(0),
    ...Array<number>(Math.max(0, player.fireRange - 2)).fill(2),
    ...Array<number>(Math.max(0, speed - 1)).fill(4), ...(player.canGlove ? [7] : []),
    ...(player.canKick ? [8] : [])];
}

/** C09614/C0963E: consome uma entrada por passada,mesmo se o destino foi ocupado. */
export function takeSb2ReturnedItem(state: Sb2ItemReturn, randomWord: number,
  readCode: (x: number, y: number) => number): { x: number; y: number; kind: ItemKind } | null {
  const selector = state.queue[state.cursor];
  if (selector === undefined) return null;
  state.cursor++;
  const cell = state.available[(randomWord & 0xfe) >> 1];
  if (cell === undefined) return null;
  const x = (cell % 128) / 2 - 1, y = Math.floor(cell / 128) - 3;
  const code = readCode(x, y);
  if (code !== 0 && (code === 0x44 || code === 1 || (code & 0xc0))) return null;
  return { x, y, kind: selector === 0 ? ItemKind.Bomb : selector === 2 ? ItemKind.Fire
    : selector === 7 ? ItemKind.Glove : selector === 8 ? ItemKind.Kick : ItemKind.Speed };
}
