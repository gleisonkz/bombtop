import { FLAME_TICKS, SB4_NORMAL_FUSE_TICKS, TILE } from "./constants";
import { updateAir } from "./air";
import { playerElevated } from "./player-carry";
import { effectiveCapacity, effectiveFuse, effectiveRange } from "./curse";
import { updateSlides } from "./kick";
import { stageFuseTicks } from "./stage";
import { stageFlame } from "./stage-mechanics";
import { stageSolid } from "./stage-obstacles";
import { stopStageStickyBombs } from "./stage-surprise";
import { beginSurpriseBurst, startSurpriseCenter, updateSurpriseCenters } from "./stage-surprise-flames";
import type { StageSurpriseSamples } from "./stage-state";
import { shieldAt } from "./special";
import { revealSb2Item } from "./sb2-items";
import { sb2Stage5BombRange } from "./sb2-stage5-floor";
import { transportSb2Stage9Bombs } from "./sb2-stage9-controller";
import { beginSb2Stage8Bomb, transportSb2Stage8Bombs } from "./sb2-stage8-controller";
import { isSb2Stage, sb2NativeCounter, SB2_BLOCK_BURN_FRAMES, SB2_FLAME_FRAMES } from "./sb2-stage";
import { sb2Stage6WarpDestination } from "./sb2-warp";
import { igniteSb2Stage4Channel, recordSb2Stage4CommonFlame, updateSb2Stage4CommonFlames } from "./sb2-stage4-controller";
import { igniteSb2Stage12Floor, recordSb2Stage12PadFlame, scatterSb2BurningSkull, sb2Stage12NativeCode } from "./sb2-stage12-floor";
import { bombAt, Floor, getFloor, getTile, hasFlame, playerTile, setTile, Tile, ItemKind, type Bomb, type MatchState } from "./state";

const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const SB4_SURPRISE_DIRECTIONS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
const SB2_DIRECTIONS = [[0, -1], [0, 1], [1, 0], [-1, 0]] as const;

interface BurnRay {
  dx: number;
  dy: number;
  from: number;
  to: number;
  ownerId: string;
  queue: Bomb[];
  samples: StageSurpriseSamples | undefined;
}

export function placeBomb(s: MatchState, playerId: string): boolean {
  const p = s.players.find((p) => p.id === playerId);
  if (!p || !p.alive || playerElevated(p) || p.curse?.kind === "constipation") return false;
  if (s.stage === "sb2-02" && s.stageState?.sb2?.stage2Transport?.[playerId]) return false;
  if (s.stage === "sb2-03" && (s.stageState?.sb2?.stage3?.tunnels[playerId]
    || s.stageState?.sb2?.stage3?.releaseDirections?.[playerId])) return false;
  const { x, y } = playerTile(p);
  if (s.stage === "sb2-06" && sb2Stage6WarpDestination({ x, y })) return false;
  if (stageSolid(s, x, y) || getFloor(s, x, y) === Floor.Slot || s.stageState?.trolley?.riderId === p.id || s.stageState?.flights?.[p.id]) return false;
  if (bombAt(s, x, y)) return false;
  // C0319A: a entidade móvel ocupa sua célula e reserva a seguinte.
  if (isSb2Stage(s.stage) && s.bombs.some(b => b.sb2Motion && !b.air && !b.heldBy
    && (() => {
      const column = b.sb2Motion.occupied?.x ?? Math.floor(b.sb2Motion.px / TILE), row = b.sb2Motion.occupied?.y ?? Math.floor((b.sb2Motion.py - TILE / 16) / TILE);
      return column === x && row === y || b.sb2Motion.reservation?.x === x && b.sb2Motion.reservation?.y === y;
    })())) return false;
  // No SB2 a capacidade volta na transição anterior ao fogo, com dois frames restantes.
  const active = s.bombs.filter((b) => b.ownerId === playerId && !b.mega
    && !(isSb2Stage(s.stage) && b.type === "normal" && b.fuse <= 2)).length;
  if (active >= effectiveCapacity(p)) return false;

  const fuse = effectiveFuse(p, s.stage, isSb2Stage(s.stage) ? sb2NativeCounter(s) : 0);
  const range = s.stage === "sb2-05" ? sb2Stage5BombRange(x, y, effectiveRange(p)) : effectiveRange(p);
  s.bombs.push({ ownerId: playerId, x, y, fuse, ...((fuse === SB4_NORMAL_FUSE_TICKS || isSb2Stage(s.stage)) && { bornAt: s.tick }), range, type: p.bombType, ...(p.curse?.sb4Status === 37 && active === 0 ? { sb4SlotVariant: 10 as const } : {}), slide: null, offset: 0, air: null, heldBy: null });
  if (isSb2Stage(s.stage)) {
    const used = new Set([...s.bombs.slice(0, -1).map(b => b.sb2Slot), ...s.flames.map(f => f.sb2BombSlot)]);
    const slot = Array.from({ length: 40 }, (_, i) => i).find(i => !used.has(i));
    if (slot !== undefined) s.bombs[s.bombs.length - 1]!.sb2Slot = slot;
  }
  if (s.stage === "sb2-08" && (sb2NativeCounter(s) & 1) === 0) beginSb2Stage8Bomb(s.bombs[s.bombs.length - 1]!, s.tick);
  return true;
}

/** Ticks fuses and flames, resolving explosions and chain reactions. */
export function updateBombs(s: MatchState): void {
  const rate = stageFuseTicks(s);
  for (const f of s.flames) {
    if (f.sb2Channel || f.sb2Floor) continue;
    if ((f.ttl -= rate) <= 0 && f.block) {
      setTile(s, f.x, f.y, Tile.Empty);
      if (isSb2Stage(s.stage)) revealSb2Item(s, f.x, f.y);
    }
  }
  s.flames = s.flames.filter((f) => f.ttl > 0);
  updateSurpriseCenters(s);

  stopStageStickyBombs(s);
  updateSlides(s);
  updateAir(s);
  s.bombs = s.bombs.filter(b => b.air || b.heldBy || getFloor(s, b.x, b.y) !== Floor.Pit);

  // SB4 pausa o fusivel no ar e nas maos. O arremesso SB2 conta ate o minimo,
  // sem armar em voo; o pouso aplica o minimo nativo antes de voltar ao chao.
  let deferFollowingSb2Static = false;
  for (const b of s.bombs) {
    // A remote stays armed while its owner can trigger it; abandoned bombs use their normal fuse.
    const remoteArmed = b.type === "remote" && s.players.some((p) => p.id === b.ownerId && p.alive);
    const nativeThrowTick = !!b.sb2Throw;
    if (!remoteArmed && (!b.air || nativeThrowTick) && !b.heldBy && b.bornAt !== s.tick && !s.stageState?.sb2?.freezeBombFuses) {
      const nativeStatic = isSb2Stage(s.stage) && b.type === "normal" && !b.sb2Motion;
      // C0E0AB encerra a varredura quando a entrada anterior acaba de armar.
      if (nativeStatic && deferFollowingSb2Static && b.fuse > 2) b.fuse += 2;
      const previousFuse = b.fuse;
      b.fuse -= rate;
      // Em9000 o temporizador nativo para em01 ate o pouso; nao arma em voo.
      if (nativeThrowTick) b.fuse = Math.max(3, b.fuse);
      if (nativeStatic && previousFuse === 3 && b.fuse === 2) {
        deferFollowingSb2Static = true;
        if (s.stage === "sb2-12" && b.sb2Slot !== undefined)
          for (const flame of s.flames) if (flame.sb2BombSlot !== undefined && flame.sb2BombSlot > b.sb2Slot) flame.ttl += 2;
      }
    }
  }
  if (s.stage === "sb2-09" || s.stage === "sb2-12") igniteSb2ExposedItems(s);
  if (s.stage === "sb2-08") transportSb2Stage8Bombs(s);
  if (s.stage === "sb2-09" || s.stage === "sb2-11") transportSb2Stage9Bombs(s);
  const queue = s.bombs.filter((b) => b.fuse <= 0 || (!b.air && !b.heldBy && hasFlame(s, b.x, b.y)));
  const pending = s.stageState?.sb2?.pendingChainArms;
  if (pending) {
    for (const burst of pending) if (--burst.frames === 0) burnBombArms(s, burst.bomb, queue, undefined);
    s.stageState!.sb2!.pendingChainArms = pending.filter(burst => burst.frames > 0);
  }
  while (queue.length > 0) {
    explode(s, queue.shift()!, queue);
  }
  if (s.stage === "sb2-04") updateSb2Stage4CommonFlames(s);
}

/** C0DCDA: o efeito próprio do item escreve fogo antes dos braços comuns.
 * Sete quadros em C5F405, três atualizações pares por quadro:42 frames PAL.
 * Confrontado nas arenas9 e12; a caveira12 usa o relancamento C0EE71.
 */
function igniteSb2ExposedItems(s: MatchState): void {
  for (const bomb of s.bombs) {
    const earlySkull = s.stage === "sb2-12" && bomb.fuse === 2 && (sb2NativeCounter(s) & 1) === 0;
    if ((bomb.fuse !== 1 && !earlySkull) || bomb.air || bomb.heldBy || bomb.sb2Motion) continue;
    for (const [dx, dy] of SB2_DIRECTIONS) {
      for (let distance = 1; distance <= bomb.range; distance++) {
        const x = bomb.x + dx * distance, y = bomb.y + dy * distance;
        if (getTile(s, x, y) !== Tile.Empty || bombAt(s, x, y)) break;
        if (earlySkull && sb2Stage12NativeCode(s, x, y) === 0x4b) break;
        if (bomb.fuse === 1 && s.stage === "sb2-12" && igniteSb2Stage12Floor(s, x, y, bomb.ownerId)) break;
        const item = s.items.find(value => value.x === x && value.y === y);
        if (!item) continue;
        if (earlySkull && item.kind !== ItemKind.Skull) break;
        s.items = s.items.filter(value => value !== item);
        if (s.stage === "sb2-12" && item.kind === ItemKind.Skull) {
          scatterSb2BurningSkull(s, x, y, bomb.ownerId);
          break;
        }
        addFlame(s, x, y, bomb.ownerId, false, { surpriseSample: null });
        const flame = s.flames.find(value => value.x === x && value.y === y)!;
        flame.ttl = 7 * 3 * 2;
        flame.sb2ItemBurn = true;
        break;
      }
    }
  }
}

/**
 * Arms the player's oldest grounded remote bomb to explode on this tick's
 * bomb update. Returns false when there was none.
 */
export function detonateRemote(s: MatchState, playerId: string): boolean {
  const bomb = s.bombs.find((b) => b.ownerId === playerId && b.type === "remote" && b.fuse > 0 && !b.air);
  if (bomb) bomb.fuse = 0;
  return !!bomb;
}

function explode(s: MatchState, bomb: Bomb, queue: Bomb[]): void {
  if (!s.bombs.includes(bomb)) return;
  s.bombs = s.bombs.filter((b) => b !== bomb);
  const samples = beginSurpriseBurst(s);
  addFlame(s, bomb.x, bomb.y, bomb.ownerId, false, { surpriseSample: null, sb2BombSlot: bomb.sb2Slot });
  if (bomb.sb2MovingChain) {
    (s.stageState!.sb2!.pendingChainArms ??= []).push({ bomb, frames: 2 });
    return;
  }
  burnBombArms(s, bomb, queue, samples);
}

function burnBombArms(s: MatchState, bomb: Bomb, queue: Bomb[], samples: ReturnType<typeof beginSurpriseBurst>): void {
  if (bomb.sb2MovingChain) {
    const center = s.flames.find(f => f.x === bomb.x && f.y === bomb.y);
    if (center) center.ttl = Math.max(center.ttl, SB2_FLAME_FRAMES);
  }
  const reachedEnd = new Map<string, boolean>();
  const reflected: { dx: number; dy: number; by: string }[] = [];
  for (const [dx, dy] of samples ? SB4_SURPRISE_DIRECTIONS : isSb2Stage(s.stage) ? SB2_DIRECTIONS : DIRECTIONS) {
    const end = burnRay(s, bomb, { dx, dy, from: 1, to: bomb.range, ownerId: bomb.ownerId, queue, samples });
    reachedEnd.set(`${dx},${dy}`, end === true);
    if (typeof end === "string") reflected.push({ dx, dy, by: end });
  }
  // A shield sends its arm back: the far arm burns on for another `range` tiles, as the captain's fire.
  for (const { dx, dy, by } of reflected) {
    if (reachedEnd.get(`${-dx},${-dy}`)) burnRay(s, bomb, { dx: -dx, dy: -dy, from: bomb.range + 1, to: bomb.range * 2, ownerId: by, queue, samples });
  }
  startSurpriseCenter(s, bomb.x, bomb.y);
}

/**
 * Burns tiles `from`..`to` steps away from the bomb toward (dx,dy). Returns true
 * when the ray ran its full length, false when something stopped it, or the id of
 * the shielded captain it hit.
 */
function burnRay(s: MatchState, bomb: Bomb, ray: BurnRay): boolean | string {
  const { dx, dy, from, to, ownerId, queue, samples } = ray;
  // Pierce flames run through blocks, items and bombs; only walls (and shields) stop them.
  const pierce = bomb.type === "pierce";
  for (let i = from; i <= to; i++) {
    const x = bomb.x + dx * i;
    const y = bomb.y + dy * i;
    // Arena11: a faixa externa de lancamento nao recebe bracos de fogo.
    if (s.stage === "sb2-11" && (x <= 0 || x >= s.grid.width - 1 || y <= 0 || y >= s.grid.height - 1)) return false;
    const tile = getTile(s, x, y);
    if (tile === Tile.Wall) return false;
    // Na cadeia12,a chama ja existente encerra o braco sem estender seu alcance.
    if (s.stage === "sb2-12" && hasFlame(s, x, y)) return false;
    if (igniteSb2Stage12Floor(s, x, y, ownerId)) return false;
    const direction = dx > 0 ? "right" : dx < 0 ? "left" : dy > 0 ? "down" : "up";
    if (stageFlame(s, x, y, ownerId, direction, samples?.[direction])) return false;
    const shield = shieldAt(s, x, y, dx, dy);
    if (shield) return shield.id;
    if (isSb2Stage(s.stage) && bomb.type === "normal") {
      const hit = bombAt(s, x, y);
      if (hit?.type === "normal") {
        // A bomba atingida continua sólida e sem fogo por mais quatro frames nativos.
        hit.fuse = Math.min(hit.fuse, 4);
        return false;
      }
    }
    addFlame(s, x, y, ownerId, tile === Tile.Block, { surpriseSample: null, refreshSb2: !!bomb.sb2MovingChain, sb2BombSlot: bomb.sb2Slot });
    if (s.flames.some(flame => flame.x === x && flame.y === y && flame.sb2ItemBurn)) return false;
    if (tile === Tile.Block) {
      if (pierce) continue;
      return false;
    }
    const item = s.items.find((it) => it.x === x && it.y === y);
    if (item) {
      s.items = s.items.filter((it) => it !== item);
      if (!pierce) return false;
    }
    const hit = bombAt(s, x, y);
    if (hit) {
      queue.push(hit);
      if (!pierce) return false;
    }
  }
  return true;
}

/** Sets (x,y) on fire; `block` when it is a block burning away, which clears when the flame dies. */
export function addFlame(s: MatchState, x: number, y: number, ownerId: string, block = false, options?: { surpriseSample?: number | null; refreshSb2?: boolean; sb2BombSlot?: number | undefined }): void {
  if (!block) recordSb2Stage4CommonFlame(s, x, y, ownerId);
  igniteSb2Stage4Channel(s, x, y, ownerId);
  stageFlame(s, x, y, ownerId, undefined, options?.surpriseSample);
  const existing = s.flames.find((f) => f.x === x && f.y === y);
  // O segundo braço não reinicia a duração da chama ou do bloco já atingido.
  if (isSb2Stage(s.stage) && existing && !options?.refreshSb2) return;
  const ttl = isSb2Stage(s.stage)
    ? (block || existing?.block ? SB2_BLOCK_BURN_FRAMES : SB2_FLAME_FRAMES)
    : FLAME_TICKS;
  if (!block) recordSb2Stage12PadFlame(s, x, y, ownerId, ttl);
  if (existing) {
    existing.ttl = ttl;
    existing.ownerId = ownerId;
    if (block) existing.block = true;
  } else {
    s.flames.push(block ? { x, y, ttl, ownerId, block } : { x, y, ttl, ownerId });
  }
  if (!block && options?.sb2BombSlot !== undefined)
    s.flames.find(f => f.x === x && f.y === y)!.sb2BombSlot = options.sb2BombSlot;
}
