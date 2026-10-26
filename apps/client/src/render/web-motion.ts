import { BEAM_DELAY } from "./sprites";

export function webShotPose(age: number) {
  if (age < BEAM_DELAY || age >= BEAM_DELAY + 16) return null;
  const elapsed = age - BEAM_DELAY;
  return {
    impact: elapsed >= 8,
    frame: Math.floor((elapsed % 8) / 2),
    progress: Math.min(1, elapsed / 8),
  };
}
