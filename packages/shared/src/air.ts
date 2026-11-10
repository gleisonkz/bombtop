import { AIR_DISTANCE, AIR_TICKS_PER_TILE, STUN_TICKS } from "./constants";
import { placeBomb } from "./bombs";
import { loseHitPowerUps } from "./items";
import { TILE } from "./constants";
import { isSb2Stage, sb2NativeCounter } from "./sb2-stage";
import { startSb2ItemFlightSegment } from "./sb2-item-flight";
import { SB2_GLOVE_PATHS, SB2_GLOVE_PATH_ADDRESSES } from "./sb2-glove-paths";
import { advanceSb2ScatteredItem } from "./sb2-scattered-item";
import { sb2Stage12NativeCode } from "./sb2-stage12-floor";
import { playerCarryButton, playerElevated } from "./player-carry";
import { bombAt, DIR_VECTORS, getTile, playerTile, Tile, type Bomb, type Facing, type MatchState, type Player, type PlayerInput } from "./state";
import { bombLandedOnSeesaw, SEESAW_BOUNCE_TICKS, seesawHop } from "./stage-transport";

/** Launches a grounded bomb into the air from its current tile. */
export function launch(b: Bomb, dir: Facing): void {
  b.air = { dir, span: AIR_DISTANCE, tilesLeft: AIR_DISTANCE, progress: 0 };
  b.slide = null;
  b.offset = 0;
  delete b.conveyor;
  delete b.kickedBy;
  delete b.sb2Motion;
  delete b.sb2Throw;
}

/** Punches the grounded bomb on the tile the player is facing. Returns false if there was none. */
export function punch(s: MatchState, p: Player): boolean {
  if (!p.alive || !p.canPunch || p.mount || playerElevated(p)) return false;
  const { x, y } = playerTile(p);
  const [dx, dy] = DIR_VECTORS[p.facing];
  const bomb = bombAt(s, x + dx, y + dy);
  if (bomb) launch(bomb, p.facing);
  return !!bomb;
}

/**
 * The bomb button, glove included: a carried bomb is thrown once the button
 * is let go; a press on your own bomb lifts it; any other press places one.
 */
export function bombButton(s: MatchState, p: Player, input: PlayerInput, inputs: Record<string, PlayerInput> = {}): void {
  if (!p.alive || playerElevated(p)) return;
  const held = s.bombs.find((b) => b.heldBy === p.id);
  if (held) {
    if (held.sb2LiftReadyAt !== undefined && sb2NativeCounter(s) < held.sb2LiftReadyAt) return;
    if (input.hold) return;
    delete held.sb2LiftReadyAt;
    held.heldBy = null;
    launch(held, p.facing);
    if (isSb2Stage(s.stage)) {
      held.sb2Throw = { dir: p.facing, path: SB2_GLOVE_PATH_ADDRESSES[p.facing], throwerId: p.id, bornFrame: sb2NativeCounter(s),
        flight: startSb2ItemFlightSegment(p.px * 16 / TILE + 8, p.py * 16 / TILE + 8) };
    }
    return;
  }
  if (playerCarryButton(s, p, input, inputs)) return;
  if (!input.bomb) return;
  if (!lift(s, p)) placeBomb(s, p.id);
}

/** Lifts the bomb the player stands on, if they have the glove. */
function lift(s: MatchState, p: Player): boolean {
  if (!p.alive || !p.canGlove) return false;
  const { x, y } = playerTile(p);
  const bomb = bombAt(s, x, y);
  if (!bomb) return false;
  // C02F6E exige pelo menos04 no temporizador de meia velocidade.
  if (isSb2Stage(s.stage) && bomb.fuse < 9) return false;
  bomb.heldBy = p.id;
  if (isSb2Stage(s.stage)) bomb.sb2LiftReadyAt = sb2NativeCounter(s) + 16;
  return true;
}

/** Carried bombs follow their holder; a dead holder drops them on the spot. */
export function updateHeldBombs(s: MatchState): void {
  for (const b of s.bombs) {
    if (!b.heldBy) continue;
    const holder = s.players.find((p) => p.id === b.heldBy);
    if (!holder) continue;
    const { x, y } = playerTile(holder);
    b.x = x;
    b.y = y;
    if (!holder.alive) b.heldBy = null;
  }
}

/** As quatro capturas de direcao mostram12passadas de trava de soltura. */
export function sb2GloveRecovering(s: MatchState, playerId: string): boolean {
  return s.bombs.some(b => b.heldBy === playerId && b.sb2LiftReadyAt !== undefined
    && sb2NativeCounter(s) < b.sb2LiftReadyAt
    || b.sb2Throw?.throwerId === playerId
      && b.sb2Throw.bornFrame < sb2NativeCounter(s)
      && sb2NativeCounter(s) <= b.sb2Throw.bornFrame + 12);
}

/** Moves one tile, wrapping around the border walls to the opposite side. Returns true if it wrapped. */
function hop(s: MatchState, b: Bomb, dir: Facing): boolean {
  const [dx, dy] = DIR_VECTORS[dir];
  const { width, height } = s.grid;
  const [x, y] = [b.x + dx, b.y + dy];
  b.x = x <= 0 ? width - 2 : x >= width - 1 ? 1 : x;
  b.y = y <= 0 ? height - 2 : y >= height - 1 ? 1 : y;
  return b.x !== x || b.y !== y;
}

/**
 * Advances airborne bombs. On reaching their target they land on a free
 * tile; solid tiles, grounded bombs and players make them bounce one tile
 * further (stunning the player hit, unless they carry a bomb).
 */
export function updateAir(s: MatchState): void {
  for (const b of s.bombs) {
    const air = b.air;
    if (!air) continue;
    if (b.sb2Throw) {
      const motion = b.sb2Throw;
      if (motion.bornFrame === sb2NativeCounter(s)) {
        const thrower = s.players.find(p => p.id === motion.throwerId);
        if (thrower) {
          motion.flight.x = Math.floor(thrower.px * 16 / TILE + 8);
          motion.flight.y = Math.floor(thrower.py * 16 / TILE + 8);
        }
        continue;
      }
      const direction = { right: 2, left: 4, down: 8, up: 16 } as const;
      const next = advanceSb2ScatteredItem({ path: motion.path, direction: direction[motion.dir],
        flight: motion.flight, landed: false }, (x, y) => {
        const code = s.stage === "sb2-12" ? sb2Stage12NativeCode(s, x, y) : null;
        if (code !== null && (code & 0x40)) return code;
        const hit = s.players.find(p => p.alive && !playerElevated(p)
          && playerTile(p).x === x && playerTile(p).y === y);
        if (hit) {
          // Captura contact-player: flag0081 do34 ao61;livre no62.
          if (!s.bombs.some(held => held.heldBy === hit.id)) hit.stun = 28;
          return 0x40;
        }
        if (code !== null) return code;
        const tile = getTile(s, x, y);
        return tile === Tile.Wall ? 0xc5 : tile === Tile.Block ? 0xc2 : bombAt(s, x, y) ? 0xc3 : 0;
      }, motion.path === SB2_GLOVE_PATH_ADDRESSES[motion.dir] ? SB2_GLOVE_PATHS[motion.dir] : undefined);
      motion.path = next.path;
      motion.flight = next.flight;
      if (!next.landed) continue;
      b.x = Math.floor((motion.flight.x + 8) / 16) - 1;
      b.y = Math.floor((motion.flight.y + 23) / 16) - 3;
      delete b.sb2Throw;
      // C10757 eleva o temporizador restante a38 antes da passada estatica.
      b.fuse = Math.max(b.fuse, 113 + (sb2NativeCounter(s) & 1));
      b.air = null;
      continue;
    }
    if (++air.progress < (air.ticksPerTile ?? AIR_TICKS_PER_TILE)) continue;
    air.progress = 0;
    if (air.seesaw) seesawHop(s, b, air.dir);
    // Coming in from across the arena, it comes down on the first tile (as in Super Bomberman 4).
    else if (hop(s, b, air.dir)) air.span = air.tilesLeft = 1;
    if (--air.tilesLeft > 0) continue;

    const hit = s.players.find((p) => {
      const t = playerTile(p);
      return p.alive && !playerElevated(p) && t.x === b.x && t.y === b.y;
    });
    // Someone carrying a bomb overhead takes the hit on it: it bounces on, nobody is stunned. Anyone else is
    // stunned and loses some of their power-ups.
    if (hit && !s.bombs.some((o) => o.heldBy === hit.id)) {
      hit.stun = STUN_TICKS;
      loseHitPowerUps(s, hit);
    }
    const outside = b.x <= 0 || b.y <= 0 || b.x >= s.grid.width - 1 || b.y >= s.grid.height - 1;
    if (hit || outside || getTile(s, b.x, b.y) !== Tile.Empty || bombAt(s, b.x, b.y)) {
      air.span = air.tilesLeft = 1;
      if (air.seesaw) air.ticksPerTile = SEESAW_BOUNCE_TICKS;
      continue;
    }
    b.air = null;
    bombLandedOnSeesaw(s, b);
  }
}
