import { TILE } from "./constants";
import { sb2NativeCounter } from "./sb2-stage";
import { advanceSb2Stage10Jump, startSb2Stage10Jump } from "./sb2-stage10-jump";
import { advanceSb2Stage10Boundary, startSb2Stage10Boundary } from "./sb2-stage10-boundary";
import type { MatchState, Player, PlayerInput } from "./state";
import { getTile, Tile } from "./state";
import { advanceSb2JumpEscape } from "./sb2-jump-escape";

/** Voo, reentrada e saída de bomba; movimento livre usa o loop existente. */
export function advanceSb2Stage10Player(s: MatchState, player: Player, input?: PlayerInput): boolean {
  const runtime = (s.stageState!.sb2!.stage10 ??= {});
  const state = (runtime[player.id] ??= { actionHeld: false });
  const freshJump = !!input?.action && !state.actionHeld;
  state.actionHeld = !!input?.action;
  const scale = TILE / 16;
  const write = (x: number, y: number) => { player.px = (x - 8) * scale; player.py = (y - 24) * scale; };
  const occupied = (x: number, y: number) => {
    const cellX = Math.floor((x + 8) / 16) - 1;
    const cellY = Math.floor((y + 23) / 16) - 3;
    return getTile(s, cellX, cellY) !== Tile.Empty || s.bombs.some(bomb => !bomb.air && !bomb.heldBy
      && !bomb.sb2Motion && bomb.x === cellX && bomb.y === cellY);
  };
  const advanceEscape = () => {
    const escape = state.escape!;
    if (advanceSb2JumpEscape(escape, occupied)) delete state.escape;
    player.facing = escape.direction;
    write(escape.x, escape.y);
  };
  if (state.escape) { advanceEscape(); return true; }
  if (state.boundary) {
    state.boundary = advanceSb2Stage10Boundary(state.boundary);
    write(state.boundary.x, state.boundary.y);
    player.facing = state.boundary.direction;
    if (state.boundary.done) delete state.boundary;
    return true;
  }
  if (!state.jump && freshJump) {
    state.jump = startSb2Stage10Jump(player.px / scale + 8, player.py / scale + 24, input?.dir ?? null, state.verticalFraction);
  }
  if (!state.jump) { state.verticalFraction = 0; return false; }
  state.jump = advanceSb2Stage10Jump(state.jump, sb2NativeCounter(s));
  state.targetY = state.jump.targetY;
  if (state.jump.direction) player.facing = state.jump.direction;
  write(state.jump.x, state.jump.y);
  if (state.jump.landed) {
    const { x, y, direction } = state.jump;
    if (direction && (x < 24 || x >= 232 || y < 41 || y >= 217)) {
      state.boundary = startSb2Stage10Boundary(x, y, direction);
      write(state.boundary.x, state.boundary.y);
    } else if (occupied(x, y)) {
      // C08447: direcao +C2 prevalece; salto neutro usa DOWN. A saida
      // sobre bomba inicia nesta passada e recentra ao sair da celula.
      const escapeDirection = direction ?? "down";
      const terrain = getTile(s, Math.floor((x + 8) / 16) - 1, Math.floor((y + 23) / 16) - 3);
      const alignedX = Math.floor((x + 8) / 16) * 16 + x % 1;
      const alignedY = Math.floor((y + 23) / 16) * 16 - 16 + y % 1;
      state.escape = { x: alignedX, y: alignedY, direction: escapeDirection };
      player.facing = escapeDirection;
      write(alignedX, alignedY);
      // Sobre bomba move na aterrissagem; parede/bloco comeca na seguinte.
      if (terrain === Tile.Empty) advanceEscape();
    }
    delete state.jump;
  }
  return true;
}
