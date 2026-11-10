import { TILE } from "./constants";
import { playerElevated } from "./player-carry";
import { stepSb2Stage6Warp } from "./sb2-warp";
import { sb2ConveyorBodyBlocks } from "./sb2-conveyor";
import { moveSb2Player } from "./sb2-movement";
import { DIR_VECTORS, hasFlame, playerTile, tileCenter, type Direction, type MatchState, type Player } from "./state";

/** Portais internos; trocas simultâneas e chegadas ocupadas medidas com dois humanos. */
export function prepareSb2Stage6(s: MatchState): void {
  const players = s.stageState!.sb2!.warps ??= {};
  const scale = TILE / 16;
  for (const player of s.players) {
    if (!player.alive) { delete players[player.id]; continue; }
    if (playerElevated(player)) continue;
    const at = playerTile(player);
    // A chama substitui o código corrente do portal; não há transporte na entrada.
    if (hasFlame(s, at.x, at.y)) continue;
    const state = players[player.id] ??= {};
    const position = stepSb2Stage6Warp({ x: player.px / scale + 8, y: player.py / scale + 24 }, state);
    player.px = (position.x - 8) * scale;
    player.py = (position.y - 24) * scale;
  }
}

/** A bomba vizinha bloqueia o corpo inteiro, inclusive a fração do eixo de avanço. */
export function moveSb2Stage6Player(s: MatchState, player: Player, dir: Direction, nativeSpeed: number,
  integerAlignment = false): void {
  const before = { x: player.px, y: player.py };
  const at = playerTile(player);
  // No contato letal medido, o avanço do frame precede a morte e o limite do bloco.
  if (dir && player.alive && !playerElevated(player) && hasFlame(s, at.x, at.y)) {
    const [dx, dy] = DIR_VECTORS[dir];
    player.px += dx * nativeSpeed * TILE / 16;
    player.py += dy * nativeSpeed * TILE / 16;
    return;
  }
  moveSb2Player(s, player, dir, nativeSpeed, nativeSpeed, integerAlignment);
  if (!dir || player.canBombPass) return;
  const scale = TILE / 16;
  const horizontal = dir === "left" || dir === "right";
  const next = { x: before.x / scale, y: before.y / scale };
  if (horizontal) next.x += (dir === "left" ? -1 : 1) * nativeSpeed;
  else next.y += (dir === "up" ? -1 : 1) * nativeSpeed;
  if (Math.floor(horizontal ? before.x / scale : before.y / scale) === Math.floor(horizontal ? next.x : next.y)) return;
  const blocked = s.bombs.filter(bomb => !bomb.air && !bomb.heldBy && (bomb.x !== at.x || bomb.y !== at.y))
    .some(bomb => {
      const mobile = s.stage === "sb2-09" ? bomb.sb2Motion : undefined;
      const point = mobile ? { x: mobile.px / scale, y: mobile.py / scale }
        : { x: tileCenter(bomb.x) / scale, y: tileCenter(bomb.y) / scale };
      return sb2ConveyorBodyBlocks(dir, next, [point], mobile ? 15 : 16);
    });
  if (blocked) {
    if (horizontal) player.px = before.x;
    else player.py = before.y;
  }
}
