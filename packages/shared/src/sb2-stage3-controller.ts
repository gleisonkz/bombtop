import { TILE } from "./constants";
import { playerElevated } from "./player-carry";
import { moveSb2Player } from "./sb2-movement";
import { sb2Stage3TunnelEntry } from "./sb2-stage3-tunnel";
import { bombAt, getTile, setTile, Tile, type Direction, type MatchState, type Player, type PlayerInput } from "./state";

/** C07EAE/C06F46: par alinhado, empurrão UP sem oposição, medido com dois MAN. */
export function prepareSb2Stage3Contacts(s: MatchState, inputs: Record<string, PlayerInput>): void {
  const runtime = s.stageState!.sb2!.stage3 ??= { tunnels: {} };
  const contacts = runtime.contacts = {} as Record<string, { direction: "up"; speed: number }>;
  const alive = s.players.filter(player => player.alive && !playerElevated(player));
  if (alive.length !== 2 || alive.some(player => runtime.tunnels[player.id])) return;
  const scale = TILE / 16;
  const [upper, lower] = [...alive].sort((a, b) => a.py - b.py) as [Player, Player];
  const upperX = Math.floor(upper.px / scale + 8), lowerX = Math.floor(lower.px / scale + 8);
  const upperY = Math.floor(upper.py / scale + 24), lowerY = Math.floor(lower.py / scale + 24);
  if (upperX !== lowerX || lowerY - upperY >= 15) return;
  if (inputs[lower.id]?.dir !== "up" || inputs[upper.id]?.dir) return;
  const column = Math.floor(upper.px / scale / 16), row = Math.floor((upper.py / scale - 1) / 16);
  const ahead = getTile(s, column, row - 1);
  const blocked = upperY % 16 === 0 && (ahead !== Tile.Empty || !!bombAt(s, column, row - 1));
  contacts[upper.id] = contacts[lower.id] = { direction: "up", speed: blocked ? 0 : 0.5 };
}

/** C0427B/C042D9: reserva liberada no passo seguinte à saída do piso17. */
export function prepareSb2Stage3(s: MatchState): void {
  const runtime = s.stageState!.sb2!.stage3;
  if (!runtime) return;
  const tunnels = runtime.tunnels;
  const release = runtime.releaseDirections = {} as Record<string, "up" | "down">;
  for (const [id, gate] of Object.entries(tunnels)) {
    const player = s.players.find(player => player.id === id);
    const y = player ? player.py / (TILE / 16) + 24 : 0;
    if (player?.alive && (y < 25 || y >= 233)) continue;
    setTile(s, gate.column, gate.edge === "top" ? 12 : 0, Tile.Empty);
    if (player?.alive) release[id] = gate.edge === "top" ? "up" : "down";
    delete tunnels[id];
  }
}

/** Travessias internas; bloqueio por célula de saída e trava esquerda medidos. */
export function moveSb2Stage3Player(s: MatchState, player: Player, input: Direction, speed: number): void {
  if (!player.alive || playerElevated(player)) return;
  const runtime = s.stageState!.sb2!.stage3 ??= { tunnels: {} };
  const contact = runtime.contacts?.[player.id];
  if (contact) {
    moveSb2Player(s, player, contact.direction, contact.speed);
    return;
  }
  const release = runtime.releaseDirections?.[player.id];
  if (release) {
    // A limpeza do portão não apaga o controle já aplicado neste quadro.
    player.facing = release;
    moveSb2Player(s, player, release, speed);
    return;
  }
  const scale = TILE / 16;
  const x = player.px / scale + 8, y = player.py / scale + 24;
  const column = Math.floor((x - 8) / 16);
  let gate = runtime.tunnels[player.id];
  if (!gate && (column === 3 || column === 11) && (y < 25 || y >= 233)) {
    const edge = y < 25 ? "top" : "bottom";
    const destination = edge === "top" ? 12 : 0;
    const outer = edge === "top" ? 13 : -1;
    // C05182 consulta A8 da célula de chegada e da faixa externa adjacente.
    const occupied = s.players.some(other => other.id !== player.id && other.alive
      && Math.floor(other.px / scale / 16) === column
      && [destination, outer].includes(Math.floor((other.py / scale - 1) / 16)))
      || s.bombs.some(bomb => !bomb.air && !bomb.heldBy && bomb.x === column
        && (bomb.y === destination || bomb.y === outer))
      || getTile(s, column, destination) !== Tile.Empty;
    // Os quatro ramos nativos testam5D04&0003, inclusive a coluna direita.
    const leftBusy = Object.values(runtime.tunnels).some(tunnel => tunnel.column === 3);
    if (occupied || leftBusy) {
      // C05006/C051AE contam piso17 até retornar à borda visível; a colisão
      // zera o avanço do quadro e conserva a fração, como nos ensaios ocupados.
      player.py = ((edge === "top" ? 25 : 232) + y - Math.floor(y) - 24) * scale;
      return;
    }
    gate = runtime.tunnels[player.id] = { column, edge };
    setTile(s, column, gate.edge === "top" ? 12 : 0, Tile.Wall);
    const entry = sb2Stage3TunnelEntry(y, gate.edge, speed);
    player.py = (entry.y + entry.vy - 24) * scale;
    return;
  }
  if (gate) {
    const direction = gate.edge === "top" ? "up" : "down";
    const next = y + (direction === "up" ? -speed : speed);
    player.facing = direction;
    // Fronteira observada nos quatro percursos: ao voltar à faixa visível,
    // há avanço inteiro de8; conserva a fração resultante do movimento.
    const shift = gate.edge === "top" && y >= 233 && next < 233 ? -8
      : gate.edge === "bottom" && y < 25 && next >= 25 ? 8 : 0;
    player.py = (next + shift - 24) * scale;
    return;
  }
  moveSb2Player(s, player, input, speed);
}
