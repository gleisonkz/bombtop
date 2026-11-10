import { TILE } from "./constants";
import { sb2NativeFramesAfterTicks } from "./sb2-native-clock";
import { moveSb2Player } from "./sb2-movement";
import { sb2NativeNumberedPadSpeed, sb2NextPadNumber, type Sb2PadNumber } from "./sb2-numbered-pad";
import { sb2NativePauseInput, type Sb2PauseInput } from "./sb2-pause-panel";
import { SB2_STAGE_CAPTURES } from "./sb2-stage-captures";
import type { Sb2Cell } from "./sb2-warp";
import type { MatchState, Player } from "./state";

interface PlayerControl {
  cell: Sb2Cell | null;
  nativeSpeed: number;
  pendingBomb: boolean;
  pause: { enteredAt: number; input: Sb2PauseInput } | null;
}

/** Estado serializável; a fase PAL pertence à arena, não ao jogador. */
export interface Sb2Stage7Controller {
  tick: number;
  nativeFrame: number;
  numbers: { left: Sb2PadNumber; right: Sb2PadNumber };
  players: Record<string, PlayerControl>;
}

export interface Sb2Stage7Control {
  /** null: nenhum comando deve ser executado neste tick. Dano continua ativo. */
  input: Sb2PauseInput | null;
  nativeSpeed: number;
}

export function createSb2Stage7Controller(): Sb2Stage7Controller {
  return { tick: 0, nativeFrame: 0, numbers: { left: 3, right: 3 }, players: {} };
}

/**
 * Compõe relógio, entrada nas placas e pausa usando as posições do MatchState.
 * Não move jogadores nem atualiza bombas: a saída descreve um passo nativo.
 * readRandomWord fornece a palavra do sorteio; o gerador global fica externo.
 */
export function advanceSb2Stage7Controller(
  state: Sb2Stage7Controller,
  players: readonly Pick<Player, "id" | "px" | "py" | "alive">[],
  inputs: Readonly<Record<string, Sb2PauseInput>>,
  readRandomWord: () => number,
  clock?: { tick: number; nativeFrame: number },
): Record<string, Sb2Stage7Control> {
  state.tick = clock?.tick ?? state.tick + 1;
  const nativeFrame = clock?.nativeFrame ?? sb2NativeFramesAfterTicks(state.tick);
  const advances = nativeFrame !== state.nativeFrame;
  state.nativeFrame = nativeFrame;
  const controls: Record<string, Sb2Stage7Control> = {};
  for (const player of players) {
    if (!player.alive) {
      delete state.players[player.id];
      controls[player.id] = { input: null, nativeSpeed: 0 };
      continue;
    }
    const actor = state.players[player.id] ??= {
      cell: null, nativeSpeed: sb2NativeNumberedPadSpeed(3), pendingBomb: false, pause: null,
    };
    const current: Sb2PauseInput = inputs[player.id] ?? { dir: null, bomb: false };
    // Preserva o evento do Bombtop entre ticks sem passo PAL. Durante a pausa
    // os novos toques são descartados, como os comandos ignorados no original.
    if (!actor.pause) actor.pendingBomb ||= current.bomb;
    if (!advances) {
      controls[player.id] = { input: null, nativeSpeed: actor.nativeSpeed };
      continue;
    }
    const input: Sb2PauseInput = { dir: current.dir, bomb: current.bomb || actor.pendingBomb };
    actor.pendingBomb = false;
    // O ponto nativo de consulta do piso fica um pixel acima do playerTile.
    const cell = { x: Math.floor(player.px / TILE), y: Math.floor((player.py - TILE / 16) / TILE) };
    const entered = actor.cell?.x !== cell.x || actor.cell?.y !== cell.y;
    actor.cell = cell;
    if (entered && !actor.pause && SB2_STAGE_CAPTURES[6].background[cell.y]?.[cell.x] === 15) {
      if (cell.x === 7 && cell.y === 6) {
        actor.pause = { enteredAt: nativeFrame, input: { ...input } };
      } else if ((cell.x === 2 || cell.x === 12) && cell.y === 6) {
        const side = cell.x === 2 ? "left" : "right";
        actor.nativeSpeed = sb2NativeNumberedPadSpeed(state.numbers[side]);
        state.numbers[side] = sb2NextPadNumber(readRandomWord());
      }
    }
    let selected: Sb2PauseInput | null = input;
    if (actor.pause) {
      const elapsed = nativeFrame - actor.pause.enteredAt;
      selected = sb2NativePauseInput(elapsed, actor.pause.input, input);
      if (selected) actor.pause = null;
    }
    controls[player.id] = { input: selected, nativeSpeed: actor.nativeSpeed };
  }
  return controls;
}

/** Aplica a composição aos jogadores reais; bombas e dano permanecem a cargo do loop. */
export function advanceSb2Stage7Movement(
  state: Sb2Stage7Controller,
  match: MatchState,
  inputs: Readonly<Record<string, Sb2PauseInput>>,
  readRandomWord: () => number,
): Record<string, Sb2Stage7Control> {
  const controls = advanceSb2Stage7Controller(state, match.players, inputs, readRandomWord);
  for (const player of match.players) {
    const control = controls[player.id]!;
    if (!control.input) continue;
    if (control.input.dir) player.facing = control.input.dir;
    moveSb2Player(match, player, control.input.dir, control.nativeSpeed);
  }
  return controls;
}
