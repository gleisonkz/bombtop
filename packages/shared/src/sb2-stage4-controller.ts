import { advanceSb2ChannelClock, requestSb2Channel, SB2_CHANNEL_CELLS } from "./sb2-channel";
import { SB2_FLAME_FRAMES, sb2NativeCounter } from "./sb2-stage";
import type { MatchState } from "./state";

/** Contato de uma explosão comum com o piso nativo da canaleta. */
export function igniteSb2Stage4Channel(s: MatchState, x: number, y: number, ownerId: string): void {
  if (s.stage !== "sb2-04") return;
  if (!SB2_CHANNEL_CELLS.some(cell => cell.x === x && cell.y === y)) return;
  const channel = s.stageState!.sb2!.channel ??= { clock: { index: -1, timer: 0 }, ownerId };
  if (channel.clock.index >= 0) return;
  channel.ownerId = ownerId;
  requestSb2Channel(channel.clock);
}

/** A chama comum continua animando atrás do efeito coletivo e pode reacendê-lo. */
export function recordSb2Stage4CommonFlame(s: MatchState, x: number, y: number, ownerId: string): void {
  if (s.stage !== "sb2-04" || !SB2_CHANNEL_CELLS.some(cell => cell.x === x && cell.y === y)) return;
  const frames = s.stageState!.sb2!.channelCommonFlames ??= [];
  const bornFrame = sb2NativeCounter(s);
  if (!frames.some(frame => frame.x === x && frame.y === y && frame.ownerId === ownerId && frame.bornFrame === bornFrame)) {
    frames.push({ x, y, ownerId, bornFrame });
  }
}

/** C0E0AB/C0E0F0: animações de chamas comuns são atualizadas nos frames pares. */
export function updateSb2Stage4CommonFlames(s: MatchState): void {
  const runtime = s.stageState!.sb2!;
  const frame = sb2NativeCounter(s);
  if (!runtime.channelCommonFlames || (frame & 1)) return;
  for (const common of runtime.channelCommonFlames) {
    const elapsed = frame - common.bornFrame;
    if (elapsed >= SB2_FLAME_FRAMES) {
      s.flames = s.flames.filter(flame => flame.x !== common.x || flame.y !== common.y);
    } else if (elapsed > 0) {
      igniteSb2Stage4Channel(s, common.x, common.y, common.ownerId);
      if (!s.flames.some(flame => flame.x === common.x && flame.y === common.y)) {
        s.flames.push({ x: common.x, y: common.y, ownerId: common.ownerId, ttl: SB2_FLAME_FRAMES - elapsed });
      }
    }
  }
  runtime.channelCommonFlames = runtime.channelCommonFlames.filter(common => frame - common.bornFrame < SB2_FLAME_FRAMES);
}

/**
 * Relógio C03A92: primeiro acionamento no frame seguinte; reutiliza timer ao reiniciar.
 * Avança antes dos contatos: o primeiro frame aceso já causa dano.
 * A reposição a cada três frames conserva a lacuna da chama comum sobreposta.
 * As chamas comuns são reescritas depois, na varredura par de bombas.
 */
export function updateSb2Stage4Channel(s: MatchState): void {
  const runtime = s.stageState!.sb2!;
  const channel = runtime.channel;
  if (!channel) return;
  for (const flame of s.flames) if (flame.sb2Channel) flame.ttl--;
  s.flames = s.flames.filter(flame => !flame.sb2Channel || flame.ttl > 0);
  const drawn = advanceSb2ChannelClock(channel.clock);
  if (drawn === null || drawn === 10) return;
  for (const cell of SB2_CHANNEL_CELLS) {
    if (s.flames.some(flame => flame.x === cell.x && flame.y === cell.y)) continue;
    s.flames.push({ ...cell, ttl: (10 - drawn) * 3, ownerId: channel.ownerId, sb2Channel: true });
  }
}
