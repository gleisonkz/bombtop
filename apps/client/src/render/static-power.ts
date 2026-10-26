import { SPECIAL_COOLDOWN } from "@bombtop/shared";

export function staticPowerLook(cooldown: number): { age: number; alpha: number } | null {
  const age = SPECIAL_COOLDOWN - cooldown;
  if (cooldown <= 0 || age < 0 || age >= 60) return null;
  return { age, alpha: Math.min(1, (age + 2) / 5, (60 - age) / 20) };
}
