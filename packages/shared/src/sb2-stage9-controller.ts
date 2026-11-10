import { TILE } from "./constants";
import { SB2_STAGE_CAPTURES } from "./sb2-stage-captures";
import { sb2Stage9ArrowEntry } from "./sb2-stage9-arrows";
import { playerElevated } from "./player-carry";
import { moveSb2Stage6Player } from "./sb2-stage6-controller";
import { sb2ConveyorBodyBlocks } from "./sb2-conveyor";
import { bombAt, DIR_VECTORS, getTile, playerTile, tileCenter, Tile,
  type Direction, type MatchState, type Player, type PlayerInput } from "./state";

/** C0A8D3/C10592: velocidade anterior tem prioridade sobre comando atual. */
export function prepareSb2Stage9(s: MatchState, inputs: Record<string, PlayerInput>): void {
  const reservations: Record<string, { x: number; y: number }> = {};
  for (const player of s.players) {
    if (!player.alive || playerElevated(player)) continue;
    const velocity = s.stageState!.sb2!.stage9Velocity?.[player.id];
    const direction: Direction = velocity?.vx ? velocity.vx < 0 ? "left" : "right"
      : velocity?.vy ? velocity.vy < 0 ? "up" : "down" : inputs[player.id]?.dir ?? null;
    if (!direction) continue;
    const delta = DIR_VECTORS[direction];
    const at = playerTile(player), [dx, dy] = delta;
    reservations[player.id] = { x: at.x + dx, y: at.y + dy };
  }
  s.stageState!.sb2!.stage9Reservations = reservations;
  s.stageState!.sb2!.stage9KickContacts = {};
}

/** Guarda o avanço inteiro para a reserva do próximo frame nativo. */
export function moveSb2Stage9Player(s: MatchState, player: Player, direction: Direction, speed: number): void {
  const scale = TILE / 16, before = { x: player.px / scale, y: player.py / scale };
  if (direction) {
    const [dx, dy] = DIR_VECTORS[direction], at = playerTile(player);
    const bomb = bombAt(s, at.x + dx, at.y + dy);
    if (bomb && sb2ConveyorBodyBlocks(direction,
      { x: before.x + dx * speed, y: before.y + dy * speed },
      [{ x: tileCenter(bomb.x) / scale, y: tileCenter(bomb.y) / scale }])) {
      (s.stageState!.sb2!.stage9KickContacts ??= {})[player.id] = true;
    }
  }
  moveSb2Stage6Player(s, player, direction, speed, true);
  const after = { x: player.px / scale, y: player.py / scale };
  const dx = after.x - before.x, dy = after.y - before.y;
  (s.stageState!.sb2!.stage9Velocity ??= {})[player.id] = {
    // A aproximação final ao centro de uma faixa bloqueada zera a velocidade
    // nativa, mesmo quando a posição ainda avança parte de um pixel.
    vx: Math.abs(dx) === speed ? dx : 0,
    vy: Math.abs(dy) === speed ? dy : 0,
  };
}

/** C0AFAF: FF habilita contato com a bomba da célula à frente. */
export function kickSb2Stage9Bomb(s: MatchState, player: Player, direction: Direction): void {
  if (!direction || !s.stageState?.sb2?.stage9KickContacts?.[player.id]) return;
  const at = playerTile(player), [dx, dy] = DIR_VECTORS[direction];
  const bomb = bombAt(s, at.x + dx, at.y + dy);
  if (!bomb || bomb.slide || bomb.air || bomb.heldBy) return;
  const target = { x: bomb.x + dx, y: bomb.y + dy };
  if (getTile(s, target.x, target.y) !== Tile.Empty || bombAt(s, target.x, target.y)) return;
  if (s.players.some(other => other.alive && playerTile(other).x === target.x && playerTile(other).y === target.y)) return;
  bomb.slide = direction;
  bomb.kickedBy = player.id;
  bomb.sb2Motion = { px: tileCenter(bomb.x), py: tileCenter(bomb.y), startedAt: s.tick,
    occupied: { x: bomb.x, y: bomb.y }, arrowLatch: 0x8000 };
}

/** Avanço livre e parada diante de bloco/pilar; demais colisões em integração. */
export function transportSb2Stage9Bombs(s: MatchState): void {
  const scale = TILE / 16;
  for (const bomb of s.bombs) {
    const motion = bomb.sb2Motion;
    if (!motion || motion.startedAt === s.tick || !bomb.slide || bomb.air || bomb.heldBy) continue;
    const [dx, dy] = DIR_VECTORS[bomb.slide];
    const proposed = { x: motion.px / scale + 8 + dx * 2, y: motion.py / scale + 24 + dy * 2 };
    const cell = { x: Math.floor((proposed.x - 8) / 16), y: Math.floor((proposed.y - 25) / 16) };
    // A tabela estática retoma a bomba antes da ignição, como no transporte8.
    // Essa transição não é um comando X e não transfere sua fase adicional.
    if (bomb.fuse <= 3) {
      bomb.x = cell.x;
      bomb.y = cell.y;
      bomb.slide = null;
      bomb.offset = 0;
      delete bomb.sb2Motion;
      continue;
    }
    // C0895F usa C5D904=4 no teste estrito C19BFB, antes de consultar
    // o piso à frente em C08AC6 e devolver a bomba por C08BDA.
    const centered = Math.abs(Math.floor(proposed.x) - (cell.x + 1) * 16) < 4
      && Math.abs(Math.floor(proposed.y) - (cell.y + 2) * 16) < 4;
    const ahead = getTile(s, cell.x + dx, cell.y + dy);
    const restingBombAhead = bombAt(s, cell.x + dx, cell.y + dy);
    // C08537 compara +A8 do jogador com célula ocupada+delta da bomba.
    // Esse contato precede o teste de proximidade ao centro usado pelo piso.
    const playerAhead = s.players.some(player => {
      if (!player.alive || playerElevated(player)) return false;
      const at = playerTile(player);
      const reserved = s.stageState?.sb2?.stage9Reservations?.[player.id];
      return at.x === cell.x + dx && at.y === cell.y + dy
        || reserved?.x === cell.x + dx && reserved.y === cell.y + dy;
    });
    if (playerAhead || centered && (ahead === Tile.Block || ahead === Tile.Wall || restingBombAhead)) {
      bomb.x = cell.x;
      bomb.y = cell.y;
      bomb.slide = null;
      bomb.offset = 0;
      delete bomb.sb2Motion;
      continue;
    }
    const code = s.stage === "sb2-11" ? 0 : SB2_STAGE_CAPTURES[8]!.background[cell.y]?.[cell.x] ?? 0;
    const latch = motion.arrowLatch ?? 0;
    const entry = sb2Stage9ArrowEntry(proposed, cell, code, !!(latch & 1), !!(latch & 0x8000));
    if (s.stage === "sb2-11" && centered && (cell.x + dx <= 0 || cell.x + dx >= s.grid.width - 1
      || cell.y + dy <= 0 || cell.y + dy >= s.grid.height - 1)) {
      entry.x = (cell.x + 1) * 16 + proposed.x % 1;
      entry.y = (cell.y + 2) * 16 + proposed.y % 1;
      entry.direction = bomb.slide === "right" ? "left" : bomb.slide === "left" ? "right"
        : bomb.slide === "up" ? "down" : "up";
    }
    motion.arrowLatch = (code & 63) < 60 ? 0 : entry.locked ? latch | 1 : latch;
    motion.px = (entry.x - 8) * scale;
    motion.py = (entry.y - 24) * scale;
    motion.occupied = cell;
    if (entry.direction) bomb.slide = entry.direction;
    bomb.x = Math.floor(motion.px / TILE);
    bomb.y = Math.floor(motion.py / TILE);
    // C08A30/C0DDF7 remove o item da célula ocupada pela entidade móvel.
    s.items = s.items.filter(item => item.x !== cell.x || item.y !== cell.y);
  }
}
