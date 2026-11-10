import { TILE } from "./constants";
import { getTile, ItemKind, Tile, type MatchState, type Player } from "./state";
import { SB2_STAGE_CAPTURES } from "./sb2-stage-captures";
import { advanceSb2FloorEffectClock, startSb2FloorEffectClock, type Sb2FloorEffectClock } from "./sb2-floor-effect";
import { advanceSb2ScatteredItem, startSb2ScatteredItem, type Sb2ScatteredItem } from "./sb2-scattered-item";
import { startSb2Stage12Preparation } from "./sb2-stage12-preparation";
import { sb2NativeCounter } from "./sb2-stage";
import { advanceSb2SpringPadClock } from "./sb2-spring-pad";
import { scatterSb2BasicInventory } from "./sb2-scatter-inventory";
import { sb2BasicReturnQueue, sb2ReturnCells, takeSb2ReturnedItem } from "./sb2-item-return";
import { sb2NativeFramesAfterTicks } from "./sb2-native-clock";
import { SB2_GLOVE_PATHS, SB2_GLOVE_PATH_ADDRESSES } from "./sb2-glove-paths";
import { SB2_ITEM_SCATTER_DIRECTIONS } from "./sb2-item-flight-paths";
import { startSb2ItemFlightSegment } from "./sb2-item-flight";

export interface Sb2Stage12Floor { x: number; y: number; ownerId: string; clock: Sb2FloorEffectClock }
export interface Sb2Stage12AirItem { ownerId: string; kind: ItemKind; bornFrame: number; motion: Sb2ScatteredItem }

/** C0EE71: a caveira queimada volta ao ar,usando historico rotativo5C12. */
export function scatterSb2BurningSkull(s: MatchState, x: number, y: number, ownerId: string): void {
  const runtime = s.stageState!.sb2!;
  const cursor = runtime.skullReturnCursor = ((runtime.skullReturnCursor ?? 0) + 2) & 0x1e;
  const word = runtime.randomHistory?.[cursor >> 1] ?? 0;
  const direction = SB2_ITEM_SCATTER_DIRECTIONS[(word & 0x1e) >> 1]!;
  const dir = ({ 2: "right", 4: "left", 8: "down", 16: "up" } as const)[direction];
  (runtime.stage12AirItems ??= []).push({ ownerId, kind: ItemKind.Skull,
    bornFrame: sb2NativeCounter(s), motion: { direction, path: SB2_GLOVE_PATH_ADDRESSES[dir],
      flight: startSb2ItemFlightSegment((x + 1) * 16, (y + 2) * 16 - 14), landed: false } });
}

/** Preserva o efeito comum enquanto o desenho do piso sobrescreve a grade. */
export function recordSb2Stage12PadFlame(s: MatchState, x: number, y: number, ownerId: string, ttl: number): void {
  if (s.stage !== "sb2-12" || ((SB2_STAGE_CAPTURES[11]!.current[y]?.[x] ?? 0) & 63) !== 12) return;
  const flames = s.stageState!.sb2!.stage12PadFlames ??= [];
  if (!flames.some(flame => flame.x === x && flame.y === y))
    flames.push({ x, y, ownerId, expiresAt: sb2NativeCounter(s) + ttl, visible: true });
}

/** C140B9: o braco de bomba tambem consome o piso11 e cria efeito4. */
export function igniteSb2Stage12Floor(s: MatchState, x: number, y: number, ownerId: string): boolean {
  if (s.stage !== "sb2-12" || ((SB2_STAGE_CAPTURES[11]!.current[y]?.[x] ?? 0) & 63) !== 11) return false;
  const floors = s.stageState!.sb2!.stage12Floors ??= [];
  const existing = floors.find(floor => floor.x === x && floor.y === y);
  if (!existing) floors.push({ x, y, ownerId, clock: startSb2FloorEffectClock() });
  return !existing || existing.clock.active;
}

// C20411..04D7: duracoes da animacao de morte,mais espera inicial2.
const DEATH_ANIMATION_FRAMES = 2 + [1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 4, 4, 4,
  5, 6, 7, 16, 2, 32, 4, 16, 8, 5, 8, 5, 8, 5, 8, 16].reduce((sum, duration) => sum + duration, 0);

/** C04623: impacto nao letal,recentragem e primeiro Fire excedente observado. */
export function triggerSb2Stage12Floor(s: MatchState, player: Player, x: number, y: number): boolean {
  const runtime = s.stageState!.sb2!;
  const floors = runtime.stage12Floors ??= [];
  if (floors.some(floor => floor.x === x && floor.y === y)) return false;
  const scale = TILE / 16;
  const center = startSb2Stage12Preparation(player.px / scale + 8, player.py / scale + 24);
  player.px = (center.x - 8) * scale;
  player.py = (center.y - 24) * scale;
  (runtime.stage12![player.id] ??= {}).impacted = true;
  floors.push({ x, y, ownerId: player.id, clock: startSb2FloorEffectClock() });
  const history = runtime.randomHistory;
  const drops = scatterSb2BasicInventory(player, history?.[2] ?? runtime.randomWord ?? 0);
  drops.forEach((kind, index) => {
    (runtime.stage12AirItems ??= []).push({ ownerId: player.id, kind,
      bornFrame: sb2NativeCounter(s), motion: startSb2ScatteredItem(Math.floor(center.x),
        (Math.floor(center.y) - 16 + 256) % 256, history?.[index] ?? runtime.randomWord ?? 0) });
  });
  return true;
}

/** Codigo de ocupacao da simulacao,sem consultar grades do replay. */
export function sb2Stage12NativeCode(s: MatchState, x: number, y: number): number {
  const tile = getTile(s, x, y);
  if (tile === Tile.Wall) return 0xc5;
  if (tile === Tile.Block) return 0xc2;
  if (s.flames.some(flame => flame.x === x && flame.y === y)) return 0x41;
  if (s.bombs.some(bomb => !bomb.air && !bomb.heldBy && bomb.x === x && bomb.y === y)) return 0xc3;
  if (s.items.some(item => item.x === x && item.y === y)) return 0x44;
  if (s.stageState!.sb2!.stage12Floors?.some(floor => floor.x === x && floor.y === y)) return 0;
  const code = (SB2_STAGE_CAPTURES[11]!.current[y]?.[x] ?? 0x46) & 63;
  return code === 11 || code === 12 ? code | 0x40 : 0;
}

/** C0468F e C093F6: anima efeito e auxiliares depois dos contatos amostrados. */
export function updateSb2Stage12Floor(s: MatchState): void {
  const runtime = s.stageState!.sb2!;
  const frame = sb2NativeCounter(s);
  if (runtime.itemReturn && sb2NativeFramesAfterTicks(s.tick) >= runtime.itemReturn.resumeNativeFrame) {
    const item = takeSb2ReturnedItem(runtime.itemReturn, runtime.randomHistory?.[0] ?? runtime.randomWord ?? 0,
      (x, y) => sb2Stage12NativeCode(s, x, y));
    if (item) s.items.push(item);
  }
  for (const pad of runtime.stage12Pads ?? []) {
    const result = advanceSb2SpringPadClock(pad.clock, frame);
    pad.clock = result.clock;
    if (result.draw) for (const flame of runtime.stage12PadFlames ?? [])
      if (flame.x === pad.x && flame.y === pad.y) flame.visible = false;
  }
  for (const flame of runtime.stage12PadFlames ?? []) {
    if (frame >= flame.expiresAt) flame.visible = false;
    else if (!(frame & 1)) flame.visible = true;
    s.flames = s.flames.filter(value => value.x !== flame.x || value.y !== flame.y || value.sb2Floor);
    if (flame.visible) s.flames.push({ x: flame.x, y: flame.y, ownerId: flame.ownerId, ttl: flame.expiresAt - frame });
  }
  if (runtime.stage12PadFlames) runtime.stage12PadFlames = runtime.stage12PadFlames.filter(flame => frame < flame.expiresAt);
  for (const floor of runtime.stage12Floors ?? []) {
    floor.clock = advanceSb2FloorEffectClock(floor.clock, frame);
    s.flames = s.flames.filter(flame => !flame.sb2Floor || flame.x !== floor.x || flame.y !== floor.y);
    if (floor.clock.active && floor.clock.animation > 0) {
      const updatesLeft = (16 - floor.clock.animation) / 2 * floor.clock.interval
        - (floor.clock.interval - floor.clock.timer);
      s.flames.push({ x: floor.x, y: floor.y, ownerId: floor.ownerId,
        ttl: updatesLeft * 2 - ((frame & 1) ? 0 : 1), sb2Floor: true });
    }
  }
  for (const item of runtime.stage12AirItems ?? []) {
    if (item.bornFrame === frame) continue;
    const dir = ({ 2: "right", 4: "left", 8: "down", 16: "up" } as const)[item.motion.direction];
    item.motion = advanceSb2ScatteredItem(item.motion, (x, y) => sb2Stage12NativeCode(s, x, y),
      item.motion.path === SB2_GLOVE_PATH_ADDRESSES[dir] ? SB2_GLOVE_PATHS[dir] : undefined);
    if (item.motion.landed) {
      const { x, y } = item.motion.flight;
      s.items.push({ x: Math.floor((x + 8) / 16) - 1, y: Math.floor((y + 23) / 16) - 3, kind: item.kind });
    }
  }
  if (runtime.stage12AirItems) runtime.stage12AirItems = runtime.stage12AirItems.filter(item => !item.motion.landed);
  for (const player of s.players) {
    const control = runtime.stage12?.[player.id];
    if (!control?.impacted || player.alive) continue;
    control.deathFrame ??= frame;
    if (!control.bodyRemoved && frame - control.deathFrame >= DEATH_ANIMATION_FRAMES) {
      const scale = TILE / 16;
      // A retirada escreve as partes inteiras,sem apagar as fracoes nativas.
      player.px = ((player.px / scale + 8) % 1 - 8) * scale;
      player.py = (240 - 24 + (player.py / scale + 24) % 1) * scale;
      control.bodyRemoved = true;
      if (s.players.filter(other => other.alive).length <= 1) {
        runtime.stoppedNativeCounter = frame;
        runtime.itemReturn = { available: sb2ReturnCells((x, y) => sb2Stage12NativeCode(s, x, y)),
          queue: sb2BasicReturnQueue(player), cursor: 0,
          // Duas passadas PAL de suspensao observadas durante o censo128.
          resumeNativeFrame: sb2NativeFramesAfterTicks(s.tick) + 2 };
      }
    }
  }
}
