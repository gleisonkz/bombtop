/** After this long the free server is probably asleep and waking up. */
const SLOW_MS = 3000;
const LONG_MS = 25000;

/** What the menu says while joining a room, by how long it has been trying. */
export function connectingText(elapsedMs: number): string {
  if (elapsedMs < SLOW_MS) return "Conectando…";
  if (elapsedMs < LONG_MS) return "Acordando o servidor… pode levar até 1 minuto.";
  return "Quase lá… o servidor está terminando de acordar.";
}
