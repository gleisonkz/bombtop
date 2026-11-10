import { SB2_ITEM_BOUNCE_PATHS, SB2_ITEM_FLIGHT_PATHS, SB2_ITEM_INITIAL_PATHS,
  SB2_ITEM_INITIAL_GROUPS, SB2_ITEM_SCATTER_DIRECTIONS } from "./sb2-item-flight-paths";
import { advanceSb2ItemFlightSegment, startSb2ItemFlightSegment, type Sb2ItemFlightSegment, type Sb2ItemFlightCommand } from "./sb2-item-flight";

type Direction = 2 | 4 | 8 | 16;

export interface Sb2ScatteredItem {
  path: number;
  direction: Direction;
  flight: Sb2ItemFlightSegment;
  landed: boolean;
}

/** C09231 usa o mesmo word do historico para FC6D (direcao) e EE0F (grupo). */
export function startSb2ScatteredItem(x: number, y: number, randomWord: number): Sb2ScatteredItem {
  const group = SB2_ITEM_INITIAL_GROUPS[(randomWord & 0x1e) >> 1]!;
  const direction = SB2_ITEM_SCATTER_DIRECTIONS[(randomWord & 0x1e) >> 1]!;
  return { path: SB2_ITEM_INITIAL_PATHS[group][direction], direction,
    flight: startSb2ItemFlightSegment(x, y), landed: false };
}

/** C0945F: celulas ocupadas,especiais e chama impedem deposicao. */
export function advanceSb2ScatteredItem(state: Sb2ScatteredItem,
  readNativeCode: (x: number, y: number) => number,
  commands: readonly Sb2ItemFlightCommand[] = SB2_ITEM_FLIGHT_PATHS[state.path]!): Sb2ScatteredItem {
  if (state.landed) return state;
  const flight = advanceSb2ItemFlightSegment(state.flight, commands);
  if (!flight.ended) return { ...state, flight };
  const x = Math.floor((flight.x + 8) / 16) - 1;
  const y = Math.floor((flight.y + 23) / 16) - 3;
  const code = readNativeCode(x, y);
  if (code !== 17 && code !== 18 && code !== 19 && !(code & 0x40) && code !== 1)
    return { ...state, flight, landed: true };
  // C093D1 zera velocidades e escolhe grupo0 por C02BB9/C5CAA0.
  let reboundY = flight.y;
  // C12F6C/C1303A/C13076 busca o fundo valido em passos16 apos rebater.
  // Na arena capturada,a faixa vertical do fundo vai de32 ate239.
  if (state.direction === 8 || state.direction === 16) {
    while (reboundY < 32 || reboundY >= 240) reboundY = (reboundY + (state.direction === 8 ? 16 : -16) + 512) % 512;
  }
  return { ...state, path: SB2_ITEM_BOUNCE_PATHS[state.direction],
    flight: startSb2ItemFlightSegment(flight.x, reboundY) };
}
