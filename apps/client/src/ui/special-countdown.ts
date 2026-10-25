import { TICK_RATE } from "@bombtop/shared";

/** What the special button shows while it recharges: whole seconds left (rounded up), or null when ready. */
export const specialCountdown = (ticks: number): string | null =>
  ticks > 0 ? String(Math.ceil(ticks / TICK_RATE)) : null;
