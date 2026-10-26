import { ROUND_TICKS, TICK_RATE, type PublicView } from "@bombtop/shared";

export function battleClockText(state: Pick<PublicView, "tick" | "pressureAt" | "roundEndsAt" | "pressureLimit">): string {
  const left = Math.max(0, Math.ceil(((state.roundEndsAt ?? state.pressureAt ?? ROUND_TICKS) - state.tick) / TICK_RATE));
  if (left <= 0 && state.roundEndsAt === undefined) return state.pressureLimit === undefined ? "SUDDEN DEATH!" : "∞";
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
}
