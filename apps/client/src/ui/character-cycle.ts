import { CHARACTERS, type CharacterId } from "@bombtop/shared";

/** The character `step` places along from `current` in the lobby picker, wrapping round. */
export function cycleCharacter(current: CharacterId, step: 1 | -1): CharacterId {
  const n = CHARACTERS.length;
  return CHARACTERS[(CHARACTERS.indexOf(current) + step + n) % n]!;
}
