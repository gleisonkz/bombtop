/** After this long the connection is slow (the server is always on: the network, or a deploy restarting it). */
const SLOW_MS = 3000;
const LONG_MS = 25000;

/** What the menu says while joining a room, by how long it has been trying. */
export function connectingText(elapsedMs: number): string {
  if (elapsedMs < SLOW_MS) return "Conectando…";
  if (elapsedMs < LONG_MS) return "Conectando… a conexão está lenta.";
  return "Ainda tentando… confira sua internet.";
}
