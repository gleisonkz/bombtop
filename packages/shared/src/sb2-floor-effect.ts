/** Registro temporizado do piso11: efeito4,comandos de animacao de2 em2. */
export interface Sb2FloorEffectClock {
  animation: number;
  interval: number;
  timer: number;
  active: boolean;
}

export function startSb2FloorEffectClock(): Sb2FloorEffectClock {
  return { animation: 0, interval: 3, timer: 0, active: true };
}

/** A passagem impar do contador nativo avanca o registro observado em7F0000. */
export function advanceSb2FloorEffectClock(state: Sb2FloorEffectClock, nativeCounter: number): Sb2FloorEffectClock {
  if (!state.active || !(nativeCounter & 1)) return state;
  const next = { ...state };
  if (state.timer > 1) next.timer--;
  else {
    next.animation += 2;
    next.timer = state.interval;
    if (next.animation === 16) next.active = false;
  }
  return next;
}
