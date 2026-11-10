import { SB2_ITEM_FLIGHT_PATHS } from "./sb2-item-flight-paths";

/** C093F6: cada registro da trajetoria tem flags,velocidadeX,velocidadeY. */
export type Sb2ItemFlightCommand = readonly [flags: number, vx: number, vy: number];

/** Tabela C5C7BC lida da ROM conferida; termina emFFFF depois destes20registros. */
export const SB2_ITEM_PATH_C5C7BC = SB2_ITEM_FLIGHT_PATHS[0xc5c7bc]!;

export interface Sb2ItemFlightSegment {
  x: number;
  y: number;
  vx: number;
  vy: number;
  command: number;
  ended: boolean;
}

export function startSb2ItemFlightSegment(x: number, y: number): Sb2ItemFlightSegment {
  return { x, y, vx: 0, vy: 0, command: 0, ended: false };
}

/** Aplica a velocidade anterior antes de carregar o proximo comando.
 * A decisao de pousar/rebater ao encontrarFFFF pertence ao chamador.
 */
export function advanceSb2ItemFlightSegment(state: Sb2ItemFlightSegment,
  commands: readonly Sb2ItemFlightCommand[]): Sb2ItemFlightSegment {
  if (state.ended) return state;
  const next = { ...state, x: (state.x + state.vx + 256) % 256, y: (state.y + state.vy + 256) % 256 };
  const command = commands[state.command];
  if (!command) { next.ended = true; return next; }
  const [flags, vx, vy] = command;
  next.vx = flags & 1 ? -vx : vx;
  next.vy = flags & 2 ? -vy : vy;
  next.command++;
  return next;
}
