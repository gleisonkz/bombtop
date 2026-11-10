import { getTile, playerTile, setTile, Tile, type MatchState } from "./state";
import { SB2_CLOSURE_ANIMATION, SB2_CLOSURE_SEQUENCE } from "./sb2-closure-tables";

/**
 * `zeroWrapped`: the counter went round once more at 0:00; `expired`: time is up (round drawn).
 * Native (arena 12 TIME-UP capture, REA x Snes9x): 0:00 at counter 0, a whole second more
 * (0..64), the wrap back to 0, and on the next frame (counter 1) everyone left is out and the
 * clock stays still.
 */
export interface Sb2BattleClock { minutes: number; seconds: number; frame: number; zeroWrapped?: true; expired?: true }
export interface Sb2ClosureClock {
  flags: number;
  timer: number;
  index: number;
  animation: number;
  cell: number;
  extended: boolean;
}

export function startSb2ClosureClock(extended = false): Sb2ClosureClock {
  return { flags: 0, timer: 0, index: 0, animation: 0, cell: 0, extended };
}

/** C0D5BB: quatro desenhos e terminador,um despacho a cada3passadas PAL. */
function advanceClosure(s: MatchState, clock: Sb2ClosureClock): void {
  if (clock.timer > 1) { clock.timer--; return; }
  clock.timer = 3;
  if (!(clock.flags & 4)) {
    clock.flags |= 4;
    let target: number;
    do {
      target = SB2_CLOSURE_SEQUENCE[clock.index++] ?? 255;
      if (target === 255 || target === 254 && !clock.extended) { clock.flags |= 2; return; }
    } while (target === 254);
    const x = target % 13 + 1, y = Math.floor(target / 13) + 1;
    clock.cell = (y + 3) * 128 + (x + 1) * 2;
  }
  if (SB2_CLOSURE_ANIMATION[clock.animation] === 65535) {
    clock.animation = 0;
    clock.flags &= ~4;
    return;
  }
  const x = (clock.cell % 128) / 2 - 1, y = Math.floor(clock.cell / 128) - 3;
  const activePad = s.stage === "sb2-12" && s.stageState?.sb2?.stage12Pads?.some(p => p.x === x && p.y === y && p.clock.active);
  if (activePad) return;
  setTile(s, x, y, Tile.Wall);
  s.bombs = s.bombs.filter(b => b.air || b.heldBy || b.x !== x || b.y !== y);
  s.items = s.items.filter(item => item.x !== x || item.y !== y);
  s.flames = s.flames.filter(flame => flame.x !== x || flame.y !== y);
  for (const player of s.players) {
    const tile = playerTile(player);
    if (player.alive && !player.thrown && tile.x === x && tile.y === y && getTile(s, x, y) === Tile.Wall) player.alive = false;
  }
  clock.animation++;
}

/** C0D83E/C11C1C: fechamento em0:33,relogio com contador00..40 inclusive. */
export function updateSb2BattleClock(s: MatchState, playing: boolean): void {
  const runtime = s.stageState?.sb2;
  if (!runtime?.battleClock || !playing) return;
  const clock = runtime.battleClock;
  const closure = runtime.closure ??= startSb2ClosureClock();
  if (closure.flags & 1) {
    if (!(closure.flags & 2)) advanceClosure(s, closure);
  } else if (clock.minutes === 0 && clock.seconds === 33) closure.flags |= 1;
  if (clock.expired) return;
  if (clock.frame < 64) {
    clock.frame++;
    if (clock.zeroWrapped) clock.expired = true;
    return;
  }
  clock.frame = 0;
  if (clock.seconds > 0) clock.seconds--;
  else if (clock.minutes > 0) { clock.minutes--; clock.seconds = 59; }
  else clock.zeroWrapped = true;
}
