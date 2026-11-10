import { TILE } from "./constants";
import { getTile, Tile, type Facing, type MatchState, type Player, type PlayerInput } from "./state";
import { SB2_STAGE_CAPTURES } from "./sb2-stage-captures";
import { sb2NativeCounter } from "./sb2-stage";
import { sb2NativeJumpFlightY } from "./sb2-native-motion";
import { advanceSb2JumpEscape, type Sb2JumpEscape } from "./sb2-jump-escape";
import { triggerSb2Stage12Floor } from "./sb2-stage12-floor";
import { startSb2SpringPadClock } from "./sb2-spring-pad";
import { advanceSb2Stage12Preparation, startSb2Stage12Preparation, type Sb2Stage12Preparation } from "./sb2-stage12-preparation";
import { advanceSb2Stage12HorizontalFlight, startSb2Stage12HorizontalFlight, type Sb2Stage12HorizontalFlight,
  advanceSb2Stage12VerticalFlight, startSb2Stage12VerticalFlight, type Sb2Stage12VerticalFlight } from "./sb2-stage12-flight";

export interface Sb2Stage12Player {
  impacted?: true;
  deathFrame?: number;
  bodyRemoved?: true;
  preparation?: Sb2Stage12Preparation;
  horizontal?: Sb2Stage12HorizontalFlight;
  vertical?: Sb2Stage12VerticalFlight;
  neutral?: { x: number; y: number; originY: number; frame: number };
  escape?: Sb2JumpEscape;
}

/** Piso12: entrada amostrada antes do movimento,preparo e projecao livre. */
export function advanceSb2Stage12Player(s: MatchState, player: Player, input?: PlayerInput): boolean {
  const state = ((s.stageState!.sb2!.stage12 ??= {})[player.id] ??= {});
  if (state.impacted) return true;
  const scale = TILE / 16;
  const write = (x: number, y: number) => { player.px = (x - 8) * scale; player.py = (y - 24) * scale; };
  const x = player.px / scale + 8, y = player.py / scale + 24;
  const cell = (px: number, py: number) => ({ x: Math.floor((px + 8) / 16) - 1, y: Math.floor((py + 23) / 16) - 3 });
  const occupied = (px: number, py: number) => {
    const pos = cell(px, py);
    return getTile(s, pos.x, pos.y) !== Tile.Empty || s.bombs.some(b => !b.air && !b.heldBy && !b.sb2Motion && b.x === pos.x && b.y === pos.y);
  };
  if (state.escape) {
    const escape = state.escape;
    if (advanceSb2JumpEscape(escape, occupied)) delete state.escape;
    write(escape.x, escape.y);
    player.facing = escape.direction;
    return true;
  }
  if (state.preparation) {
    const pos = cell(state.preparation.x, state.preparation.y);
    const floorAvailable = !s.flames.some(flame => flame.x === pos.x && flame.y === pos.y);
    state.preparation = advanceSb2Stage12Preparation(state.preparation, input?.dir ?? null, floorAvailable);
    if (!state.preparation.ready) return true;
    const p = state.preparation;
    if (p.direction === "left" || p.direction === "right") state.horizontal = startSb2Stage12HorizontalFlight(p.x, p.y, p.direction);
    else if (p.direction) state.vertical = startSb2Stage12VerticalFlight(p.y, p.direction);
    else state.neutral = { x: p.x, y: p.y, originY: p.y, frame: 0 };
    delete state.preparation;
  }
  if (state.horizontal || state.vertical || state.neutral) {
    let px = x, py = y, landed = false;
    let direction: Facing = input?.dir ?? "down";
    if (state.horizontal) {
      const previous = state.horizontal;
      landed = previous.frame >= 40 && Math.floor(previous.y) >= Math.floor(previous.originY);
      direction = previous.direction;
      if (!landed) state.horizontal = advanceSb2Stage12HorizontalFlight(previous, input?.dir === "right" ? 1 : input?.dir === "left" ? -1 : 0);
      px = state.horizontal.x; py = state.horizontal.y;
    } else if (state.vertical) {
      state.vertical = advanceSb2Stage12VerticalFlight(state.vertical, sb2NativeCounter(s), input?.dir === "down" ? 1 : input?.dir === "up" ? -1 : 0);
      direction = state.vertical.direction; py = state.vertical.y; landed = state.vertical.landed;
    } else {
      const jump = state.neutral!;
      landed = jump.frame >= 40 && Math.floor(jump.y) >= Math.floor(jump.originY);
      if (!landed) {
        jump.frame++;
        jump.x += input?.dir === "right" ? 0.5 : input?.dir === "left" ? -0.5 : 0;
        jump.y = sb2NativeJumpFlightY(jump.originY, jump.frame, 5);
      }
      px = jump.x; py = jump.y;
    }
    if (landed) {
      delete state.horizontal; delete state.vertical; delete state.neutral;
      if (occupied(px, py)) {
        px = Math.floor((px + 8) / 16) * 16 + px % 1;
        py = Math.floor((py + 23) / 16) * 16 - 16 + py % 1;
        state.escape = { x: px, y: py, direction };
      }
    }
    write(px, py);
    return true;
  }
  const pos = cell(x, y);
  if ((SB2_STAGE_CAPTURES[11]!.current[pos.y]?.[pos.x]! & 63) === 11 && !occupied(x, y)
    && triggerSb2Stage12Floor(s, player, pos.x, pos.y)) return true;
  if ((SB2_STAGE_CAPTURES[11]!.current[pos.y]?.[pos.x]! & 63) === 12 && !occupied(x, y)) {
    state.preparation = startSb2Stage12Preparation(x, y);
    const pads = s.stageState!.sb2!.stage12Pads ??= [];
    const pad = pads.find(value => value.x === pos.x && value.y === pos.y);
    if (pad) pad.clock = startSb2SpringPadClock();
    else pads.push({ x: pos.x, y: pos.y, clock: startSb2SpringPadClock() });
    write(state.preparation.x, state.preparation.y);
    return true;
  }
  return false;
}
