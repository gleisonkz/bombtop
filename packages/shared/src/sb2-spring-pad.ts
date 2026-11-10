/** C5E8E1: dezoito comandos de desenho do piso12,seguidos porFFFF. */
const INTERVALS = [3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] as const;
export interface Sb2SpringPadClock { timer: number; command: number; active: boolean }
export function startSb2SpringPadClock(): Sb2SpringPadClock {
  return { timer: 0, command: 0, active: true };
}
export function advanceSb2SpringPadClock(state: Sb2SpringPadClock, nativeCounter: number): { clock: Sb2SpringPadClock; draw: boolean } {
  if (!state.active || !(nativeCounter & 1)) return { clock: state, draw: false };
  if (state.timer > 1) return { clock: { ...state, timer: state.timer - 1 }, draw: false };
  const interval = INTERVALS[state.command];
  if (interval === undefined) return { clock: { ...state, active: false }, draw: false };
  return { clock: { timer: interval, command: state.command + 1, active: true }, draw: true };
}
