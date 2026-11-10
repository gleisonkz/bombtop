import { TILE } from "./constants";
import { playerElevated } from "./player-carry";
import { moveSb2Player } from "./sb2-movement";
import { SB2_STAGE_CAPTURES } from "./sb2-stage-captures";
import { sb2NativeCounter } from "./sb2-stage";
import { sb2ConveyorBodyBlocks, sb2ConveyorControlEntry, sb2ConveyorOutgoingDirection, sb2NativeConveyorBombStep, sb2NativeConveyorBombReservation, sb2NativeConveyorSpeed, sb2NativeConveyorStep, type Sb2ConveyorControlState } from "./sb2-conveyor";
import { bombAt, DIR_VECTORS, getTile, hasFlame, Tile, tileCenter, type Bomb, type Facing, type Direction, type MatchState, type Player } from "./state";

// Integração interna; os testes mantêm os nove casos inicialmente divergentes.
// Colisões entre objetos, bombas e itens ainda precisam de validação própria.
interface Actor { floor: number; suppressTransport: boolean; previousFacing: Facing; staticBombAhead?: boolean }
export interface Sb2Stage8Controller {
  control: Sb2ConveyorControlState;
  pending: Sb2ConveyorControlState | null;
  players: Record<string, Actor>;
}
export function createSb2Stage8Controller(): Sb2Stage8Controller {
  return { control: { reversed: false, fast: false }, pending: null, players: {} };
}
function cell(p: Player) {
  return { x: Math.floor(p.px / TILE), y: Math.floor((p.py - TILE / 16) / TILE) };
}
function floorAt(s: MatchState, p: Player): number {
  const at = cell(p);
  if (bombAt(s, at.x, at.y)) return 3;
  return SB2_STAGE_CAPTURES[7].background[at.y]?.[at.x] ?? 0;
}
function controller(s: MatchState): Sb2Stage8Controller {
  return s.stageState!.sb2!.conveyor ??= createSb2Stage8Controller();
}

/** A entrada vista neste frame solicita a troca global para o frame seguinte. */
export function prepareSb2Stage8(s: MatchState): void {
  const state = controller(s);
  if (state.pending) { state.control = state.pending; state.pending = null; }
  // A reserva deste passo é publicada antes de o comando de plantio ser consultado.
  for (const bomb of s.bombs) {
    if (!bomb.sb2Motion || bomb.sb2Motion.startedAt !== undefined || bomb.air || bomb.heldBy) continue;
    bomb.sb2Motion.reservation = sb2NativeConveyorBombReservation({ x: bomb.sb2Motion.px / (TILE / 16) + 8,
      y: bomb.sb2Motion.py / (TILE / 16) + 24 }, state.control, bomb.sb2Motion.occupied);
    bomb.sb2Motion.reservationReady = true;
  }
  for (const p of s.players) {
    if (!p.alive) { delete state.players[p.id]; continue; }
    const code = floorAt(s, p), actor = state.players[p.id] ??= { floor: 0, suppressTransport: false, previousFacing: p.facing };
    const before: Sb2ConveyorControlState = state.pending ?? state.control;
    const next = sb2ConveyorControlEntry(before, actor.floor, code);
    if (next !== before) state.pending = next;
    actor.floor = code;
    actor.suppressTransport = false;
    actor.previousFacing = p.facing;
    const direction = sb2ConveyorOutgoingDirection(code, state.control.reversed);
    const at = cell(p), vector = direction ? DIR_VECTORS[direction] : [0, 0];
    actor.staticBombAhead = !!direction && !!bombAt(s, at.x + vector[0]!, at.y + vector[1]!);
  }
  if ((sb2NativeCounter(s) & 1) === 0) {
    for (const bomb of s.bombs) {
      if (!bomb.sb2Motion && !bomb.air && !bomb.heldBy && bomb.fuse > 3) beginSb2Stage8Bomb(bomb, s.tick);
    }
  }
}

/** C0B62D..B7FB: o vetor combinado escolhe um eixo pela colisão e orientação anterior. */
export function moveSb2Stage8Player(s: MatchState, p: Player, dir: Direction, nativeSpeed: number): void {
  if (!dir || !p.alive || playerElevated(p)) return;
  const state = controller(s), actor = state.players[p.id] ??= { floor: floorAt(s, p), suppressTransport: false, previousFacing: p.facing };
  const belt = sb2ConveyorOutgoingDirection(actor.floor, state.control.reversed);
  // O piso é o da entrada do frame: atravessar sua borda agora só ativa a correia no próximo.
  actor.suppressTransport = true;
  if (!belt) { moveSb2Player(s, p, dir, nativeSpeed); return; }
  const [ix, iy] = DIR_VECTORS[dir], [bx, by] = DIR_VECTORS[belt];
  const speed = sb2NativeConveyorSpeed(state.control.fast);
  const dx = ix * nativeSpeed + bx * speed, dy = iy * nativeSpeed + by * speed;
  const oldX = p.px / (TILE / 16) + 8, oldY = p.py / (TILE / 16) + 24;
  const x = oldX + dx, y = oldY + dy;
  // C0A92A: sem mudança de pixel inteiro, só as frações avançam; não há despacho nem nova orientação.
  if (Math.floor(oldX) === Math.floor(x) && Math.floor(oldY) === Math.floor(y)) {
    p.px = (x - 8) * TILE / 16; p.py = (y - 24) * TILE / 16;
    p.facing = actor.previousFacing;
    return;
  }
  const xDir: Facing = dx < 0 ? "left" : "right", yDir: Facing = dy < 0 ? "up" : "down";
  let selected: Facing = dx ? xDir : yDir;
  if (dx && dy) {
    const solid = (ox: number, oy: number) => {
      const tile = getTile(s, Math.floor((Math.floor(x) + ox - 8) / 16), Math.floor((Math.floor(y) + oy - 25) / 16));
      return tile === Tile.Wall || tile === Tile.Block && !p.canBlockPass;
    };
    const corners = [solid(7, 8), solid(7, -7), solid(-8, -7), solid(-8, 8)];
    const xCorners = dx > 0 ? [corners[0], corners[1]] : [corners[2], corners[3]];
    const yCorners = dy > 0 ? [corners[0], corners[3]] : [corners[1], corners[2]];
    const blockedX = xCorners.every(Boolean), blockedY = yCorners.every(Boolean);
    if (blockedX && blockedY) return;
    if (blockedX) selected = yDir;
    else if (blockedY) selected = xDir;
    else selected = actor.previousFacing === yDir
      ? xCorners.some(Boolean) ? yDir : xDir
      : yCorners.some(Boolean) ? xDir : yDir;
  }
  const horizontal = selected === "left" || selected === "right";
  const beforeX = p.px, beforeY = p.py;
  moveSb2Player(s, p, selected, horizontal ? Math.abs(dx) : Math.abs(dy), nativeSpeed, true);
  const proposed = { x: p.px / (TILE / 16) + 8, y: p.py / (TILE / 16) + 24 };
  const crossesPixel = Math.floor(proposed.x) !== Math.floor(oldX) || Math.floor(proposed.y) !== Math.floor(oldY);
  const contact = horizontal ? { x: proposed.x, y: oldY } : { x: oldX, y: proposed.y };
  if (!p.canBombPass && crossesPixel && s.bombs.some(b => {
    if (!b.sb2Motion || b.air || b.heldBy || b.bornAt === s.tick || b.sb2Motion.startedAt === s.tick) return false;
    return sb2ConveyorBodyBlocks(selected, contact, [{ x: b.sb2Motion.px / (TILE / 16) + 8,
      y: b.sb2Motion.py / (TILE / 16) + 24 }], 15);
  })) { p.px = beforeX; p.py = beforeY; }
}

/** Transporte de jogadores livres; colisões de objetos e bombas exigem integração própria. */
export function transportSb2Stage8Players(s: MatchState): void {
  const state = controller(s);
  for (const p of s.players) {
    if (!p.alive || playerElevated(p) || state.players[p.id]?.suppressTransport) continue;
    if (!sb2ConveyorOutgoingDirection(state.players[p.id]?.floor ?? floorAt(s, p), state.control.reversed)) continue;
    const position = { x: p.px / (TILE / 16) + 8, y: p.py / (TILE / 16) + 24 };
    const next = sb2NativeConveyorStep(position, state.control);
    const crossesPixel = Math.floor(next.x) !== Math.floor(position.x) || Math.floor(next.y) !== Math.floor(position.y);
    const direction = sb2ConveyorOutgoingDirection(state.players[p.id]?.floor ?? floorAt(s, p), state.control.reversed);
    if (state.players[p.id]?.staticBombAhead && direction) {
      const horizontal = direction === "left" || direction === "right";
      const sign = direction === "left" || direction === "up" ? -1 : 1;
      const at = cell(p), along = horizontal ? position.x : position.y;
      const center = horizontal ? (at.x + 1) * 16 : (at.y + 2) * 16;
      if (sign * (Math.floor(next[horizontal ? "x" : "y"]) - center) > 0) {
        const limited = center + along - Math.floor(along);
        if (horizontal) p.px = (limited - 8) * TILE / 16; else p.py = (limited - 24) * TILE / 16;
        continue;
      }
    }
    const contact = direction === "left" || direction === "right" ? { x: next.x, y: position.y } : { x: position.x, y: next.y };
    if (!p.canBombPass && crossesPixel && s.bombs.some(b => {
      if (b.air || b.heldBy || b.bornAt === s.tick || b.sb2Motion?.startedAt === s.tick) return false;
      const point = b.sb2Motion ? { x: b.sb2Motion.px / (TILE / 16) + 8, y: b.sb2Motion.py / (TILE / 16) + 24 }
        : { x: (b.x + 1) * 16, y: (b.y + 2) * 16 };
      return sb2ConveyorBodyBlocks(direction, contact, [point], b.sb2Motion ? 15 : 16);
    })) continue;
    p.px = (next.x - 8) * TILE / 16;
    p.py = (next.y - 24) * TILE / 16;
  }
}

/** O plantio sobre a correia cria uma entidade móvel no centro da célula. */
export function beginSb2Stage8Bomb(bomb: Bomb, tick: number): void {
  const code = SB2_STAGE_CAPTURES[7].background[bomb.y]?.[bomb.x] ?? 0;
  if (!sb2ConveyorOutgoingDirection(code, false)) return;
  bomb.sb2Motion = { px: tileCenter(bomb.x), py: tileCenter(bomb.y), startedAt: tick };
}

/** Um passo PAL; a bomba recém-criada só começa o transporte no próximo frame. */
export function transportSb2Stage8Bombs(s: MatchState): void {
  const players = s.players.filter(p => p.alive && !playerElevated(p)).map(p => ({
    x: p.px / (TILE / 16) + 8, y: p.py / (TILE / 16) + 24,
  }));
  for (const bomb of s.bombs) {
    if (bomb.air || bomb.heldBy) continue;
    if (!bomb.sb2Motion || bomb.sb2Motion.startedAt === s.tick) continue;
    const reservation = sb2NativeConveyorBombReservation({ x: bomb.sb2Motion.px / (TILE / 16) + 8, y: bomb.sb2Motion.py / (TILE / 16) + 24 }, controller(s).control, bomb.sb2Motion.occupied);
    const proposed = sb2NativeConveyorBombStep({ x: bomb.sb2Motion.px / (TILE / 16) + 8, y: bomb.sb2Motion.py / (TILE / 16) + 24 }, controller(s).control, []);
    const occupied = { x: Math.floor((proposed.x - 8) / 16), y: Math.floor((proposed.y - 25) / 16) };
    const bodies = [...players, ...s.bombs.filter(other => other !== bomb && !other.air && !other.heldBy).map(other => other.sb2Motion
      ? { x: other.sb2Motion.px / (TILE / 16) + 8, y: other.sb2Motion.py / (TILE / 16) + 24 }
      : { x: (other.x + 1) * 16, y: (other.y + 2) * 16 })];
    const next = sb2NativeConveyorBombStep({ x: bomb.sb2Motion.px / (TILE / 16) + 8,
      y: bomb.sb2Motion.py / (TILE / 16) + 24 }, controller(s).control, bodies);
    const reservationReady = bomb.sb2Motion.startedAt === undefined;
    bomb.sb2Motion = { px: (next.x - 8) * TILE / 16, py: (next.y - 24) * TILE / 16, reservationReady, occupied, ...(reservationReady ? { reservation } : {}) };
    bomb.x = Math.floor(bomb.sb2Motion.px / TILE);
    bomb.y = Math.floor(bomb.sb2Motion.py / TILE);
    if (hasFlame(s, bomb.x, bomb.y)) {
      delete bomb.sb2Motion;
      bomb.fuse = 1;
      bomb.sb2MovingChain = true;
      s.flames = s.flames.filter(f => f.x !== bomb.x || f.y !== bomb.y);
      continue;
    }
    // A entidade móvel devolve a bomba à tabela estática antes do fogo.
    if (bomb.fuse <= 3) delete bomb.sb2Motion;
  }
}
