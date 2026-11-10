import { bombButton, punch, updateHeldBombs, sb2GloveRecovering } from "./air";
import { playerElevated, updateCarriedPlayers, updateThrownPlayers, wriggleFree } from "./player-carry";
import { detonateRemote, placeBomb, updateBombs } from "./bombs";
import { cursedDirection, updateCurses } from "./curse";
import { applyFloor } from "./floor";
import { collectItems, dropItems, scatterCurseItem } from "./items";
import { stopKickedBombs, tryKick } from "./kick";
import { tryPush, updatePushMotions } from "./push";
import { hurt, updateMountMove, useMountAbility } from "./mount";
import { steer } from "./movement";
import { advanceStageTempo } from "./stage";
import { carriesStageFlag, resolveStageHazards, stageInput, updateStageMechanics } from "./stage-mechanics";
import { landedOffSeesaw } from "./stage-transport";
import { moveSurprisePlayer } from "./stage-surprise";
import { updatePressure } from "./pressure";
import { driveCart, giveCart, revengeSwap } from "./revenge";
import { kamehameha, updateBlasts, updateRasengan, updateTruck, useSpecial } from "./special";
import { getTile, playerTile, Tile, type MatchState, type PlayerInput } from "./state";
import { isSb2Stage, sb2TickInputs, sb2NativeCounter } from "./sb2-stage";
import { advanceSb2ItemRandom } from "./sb2-items";
import { advanceSb2Stage7Controller, createSb2Stage7Controller } from "./sb2-stage7-controller";
import { TILE } from "./constants";
import { prepareSb2Stage8, transportSb2Stage8Players } from "./sb2-stage8-controller";
import { prepareSb2Stage6 } from "./sb2-stage6-controller";
import { updateSb2Stage4Channel } from "./sb2-stage4-controller";
import { prepareSb2Stage3, prepareSb2Stage3Contacts } from "./sb2-stage3-controller";
import { prepareSb2Stage9 } from "./sb2-stage9-controller";
import { advanceSb2Stage10Player } from "./sb2-stage10-controller";
import { advanceSb2Stage11Player } from "./sb2-stage11-controller";
import { advanceSb2Stage12Player } from "./sb2-stage12-controller";
import { updateSb2Stage12Floor } from "./sb2-stage12-floor";
import { updateSb2BattleClock } from "./sb2-battle-clock";
import { sb2NativeFramesAfterTicks } from "./sb2-native-clock";

/** Advances the simulation by one tick, applying each player's input for this tick. */
export function step(s: MatchState, inputs: Record<string, PlayerInput> = {}): void {
  s.tick++;
  const stopped = s.stageState?.sb2?.stoppedNativeCounter;
  if (stopped !== undefined) {
    const runtime = s.stageState!.sb2!;
    if (!runtime.itemReturn || sb2NativeFramesAfterTicks(s.tick) < runtime.itemReturn.resumeNativeFrame) return;
    runtime.counterOffset = stopped - sb2NativeFramesAfterTicks(s.tick);
    delete runtime.stoppedNativeCounter;
  }
  const sb2 = isSb2Stage(s.stage);
  const plantAfterMovement = s.stage === "sb2-02" || s.stage === "sb2-06" || s.stage === "sb2-09";
  if (sb2) {
    const nativeInputs = sb2TickInputs(s, inputs);
    if (!nativeInputs) return;
    inputs = nativeInputs;
  }
  const stage7 = s.stage === "sb2-07" ? s.stageState!.sb2! : null;
  const stage7Controls = stage7 ? advanceSb2Stage7Controller(
    stage7.stage7 ??= createSb2Stage7Controller(), s.players, inputs,
    () => stage7.randomWord ?? 0, { tick: s.tick, nativeFrame: sb2NativeCounter(s) },
  ) : null;
  if (s.stage === "sb2-08") prepareSb2Stage8(s);
  if (s.stage === "sb2-09") prepareSb2Stage9(s, inputs);
  if (s.stage === "sb2-06") prepareSb2Stage6(s);
  if (s.stage === "sb2-04") updateSb2Stage4Channel(s);
  if (s.stage === "sb2-03") { prepareSb2Stage3(s); prepareSb2Stage3Contacts(s, inputs); }
  // No SB2, o contato é amostrado antes do movimento e resolvido depois dele.
  const nativeContacts = sb2 ? new Map(s.players.map(p => {
    const { x, y } = playerTile(p);
    // A saida forcada sobre obstaculos protege inclusive sua passada final.
    const escaping = s.stage === "sb2-10" && s.stageState?.sb2?.stage10?.[p.id]?.escape;
    return [p.id, escaping ? undefined : s.flames.find(f => f.x === x && f.y === y)] as const;
  })) : null;
  advanceStageTempo(s);
  const living = s.players.filter((p) => p.alive);
  wriggleFree(s, inputs);
  updateCarriedPlayers(s);
  for (const p of living) {
    if (p.curse?.sb2Status === 1) p.curse.elapsed = (p.curse.elapsed ?? 0) + 1;
    if (p.curse?.kind !== "hiccups") continue;
    if (p.curse.sb4Status === 43) {
      if (s.tick % 32 === 0) scatterCurseItem(s, p);
      continue;
    }
    p.curse.elapsed = (p.curse.elapsed ?? 0) + 1;
    if (p.curse.elapsed >= 30) {
      p.curse.elapsed = 0;
      scatterCurseItem(s, p);
    }
  }
  // Worn off before anyone acts, so a web or charm lasts the same whoever moved first.
  for (const p of s.players) {
    if (p.webbed > 0) p.webbed--;
    if (p.charmed > 0) p.charmed--;
  }

  for (const p of s.players) {
    let input = inputs[p.id];
    // No transporte da arena2, +6E fica zero até terminar a aterrissagem.
    if (s.stage === "sb2-02" && s.stageState?.sb2?.stage2Transport?.[p.id]) input = undefined;
    if (!p.alive) {
      driveCart(s, p, input?.dir ?? null, input?.bomb ?? false);
      continue;
    }
    if (p.invuln > 0) p.invuln--;
    if (playerElevated(p)) continue;
    if (s.stage === "sb2-10" && advanceSb2Stage10Player(s, p, input)) continue;
    if (s.stage === "sb2-11" && advanceSb2Stage11Player(s, p, input)) continue;
    if (s.stage === "sb2-12" && advanceSb2Stage12Player(s, p, input)) continue;
    if (stage7Controls) {
      const control = stage7Controls[p.id]!;
      if (!control.input) continue;
      p.speed = control.nativeSpeed * TILE / 16;
      input = { ...input, ...control.input };
    }
    if (stageInput(s, p, input)) continue;
    if (p.fireSuitTicks && p.fireSuitTicks > 0) p.fireSuitTicks--;
    if (p.bubble > 0) p.bubble--;
    if (p.sneak > 0) p.sneak--;
    if (p.specialCooldown > 0) p.specialCooldown--;
    // Planted behind the shield: it wears off on time even if he gets stunned.
    if (p.shield > 0) {
      p.shield--;
      continue;
    }
    if (p.stun > 0) {
      p.stun--;
      p.charge = p.rasengan = p.truck = 0;
      continue;
    }
    if (p.webbed > 0) {
      p.charge = p.rasengan = p.truck = 0;
      continue;
    }
    if (sb2 && sb2GloveRecovering(s, p.id)) continue;
    if (p.rasengan > 0) {
      updateRasengan(s, p);
      continue;
    }
    if (p.truck > 0) {
      updateTruck(s, p);
      continue;
    }
    if (p.charge > 0) {
      if (--p.charge === 0) kamehameha(s, p.id, playerTile(p), p.facing, true);
      continue;
    }
    if (updateMountMove(s, p)) continue;
    if (input?.stopKick) stopKickedBombs(s, p);
    if (p.shove || input?.brace) continue;
    if (p.curse?.kind === "diarrhea") {
      if (p.curse.sb2Status !== 2 || ((p.curse.elapsed = (p.curse.elapsed ?? 0) + 1) & 1) === 0) placeBomb(s, p.id);
    }
    const stage3 = s.stage === "sb2-03" ? s.stageState?.sb2?.stage3 : null;
    const stage3Moving = stage3?.contacts?.[p.id] || stage3?.tunnels[p.id] || stage3?.releaseDirections?.[p.id];
    if (!input && p.curse?.kind !== "cannotStop" && s.stage !== "sb2-02" && !stage3Moving) {
      moveSurprisePlayer(s, p);
      continue;
    }
    const entryFacing = p.facing;
    const dir = cursedDirection(p, input?.dir ?? null);
    if (dir && p.alive) p.facing = dir;
    if (input && p.curse?.sb2Status !== 2 && !plantAfterMovement) bombButton(s, p, input, inputs);
    if (s.stage !== "sb2-10" && input?.action && !detonateRemote(s, p.id)) {
      const punched = punch(s, p);
      const pushed = tryPush(s, p, inputs);
      if (!punched && !pushed) useMountAbility(s, p);
    }
    if (input?.special && !p.mount && !carriesStageFlag(s, p.id)) useSpecial(s, p);
    if (p.stun > 0 || p.shove) continue;
    const forced = p.curse?.kind === "cannotStop" ? p.curse : null;
    const intended = dir ?? forced?.momentum ?? null;
    const [px, py] = [p.px, p.py];
    const moved = moveSurprisePlayer(s, p, input, entryFacing) ? p.facing : steer(s, p, intended, cursedDirection(p, input?.alt ?? null));
    if (s.stage === "sb2-10") {
      s.stageState!.sb2!.stage10![p.id]!.verticalFraction = Math.abs((p.py - py) / (TILE / 16)) % 1;
    }
    // Ensaios de gelo e portais situam o plantio após o movimento nessas arenas.
    if (plantAfterMovement && input && p.curse?.sb2Status !== 2) bombButton(s, p, input, inputs);
    if (moved && moved !== dir) p.facing = moved;
    if (forced) {
      if (p.px !== px || p.py !== py) {
        if (moved) forced.momentum = moved;
      } else if (intended) delete forced.momentum;
    }
    if (!input?.stopKick) tryKick(s, p, moved);
  }

  updatePushMotions(s);
  updateThrownPlayers(s);
  updateCarriedPlayers(s);
  updateBlasts(s);
  // O contato nativo já amostrado mata antes do transporte passivo da correia.
  if (nativeContacts) resolveFlameContacts(s, nativeContacts);
  if (s.stage === "sb2-08") transportSb2Stage8Players(s);
  applyFloor(s);
  updateHeldBombs(s);
  collectItems(s);
  updateCurses(s);
  updateStageMechanics(s, inputs);

  updateBombs(s);
  if (s.stage === "sb2-12") updateSb2Stage12Floor(s);
  if (s.stageState?.sb2?.stoppedNativeCounter !== undefined) return;
  if (sb2) updateSb2BattleClock(s, living.length > 1);
  else updatePressure(s);
  resolveStageHazards(s);

  if (!nativeContacts) resolveFlameContacts(s);
  // Na arena9 capturada, a morte conserva inventário/FF e não usa o
  // espalhamento genérico que reinicia atributos e sorteia novas posições.
  for (const p of living) if (!p.alive && s.stage !== "sb2-09" && s.stage !== "sb2-11" && s.stage !== "sb2-12") dropItems(s, p);

  updateHeldBombs(s);
  updateCarriedPlayers(s);
  // Arena10: as bombas restantes continuam apos a primeira morte (captura dual).
  if (sb2 && s.stage !== "sb2-10" && s.stage !== "sb2-12" && living.length > 1 && s.players.filter(p => p.alive).length <= 1) s.stageState!.sb2!.freezeBombFuses = true;
  if (sb2) advanceSb2ItemRandom(s);
}

function resolveFlameContacts(s: MatchState, nativeContacts?: Map<string, MatchState["flames"][number] | undefined>): void {
  for (const p of s.players) {
    // Arena10: o salto evita a chama inclusive quando inicia no frame de
    // contato; ao terminar o voo, o contato volta a valer no mesmo frame.
    if (s.stage === "sb2-10" && s.stageState?.sb2?.stage10?.[p.id]?.jump) continue;
    // Arena11: preparacao e vulneravel; projecao ativa do lancamento nao e.
    if (s.stage === "sb2-11" && s.stageState?.sb2?.stage11?.[p.id]?.flight) continue;
    if (s.stage === "sb2-12") {
      const control = s.stageState?.sb2?.stage12?.[p.id];
      if (control?.preparation || control?.horizontal || control?.vertical || control?.neutral) continue;
    }
    const { x, y } = playerTile(p);
    const flame = nativeContacts ? nativeContacts.get(p.id) : s.flames.find((f) => f.x === x && f.y === y);
    if (!flame || playerElevated(p) || s.stageState?.trolley?.riderId === p.id || s.stageState?.flights?.[p.id] || landedOffSeesaw(s, p) || p.bubble > 0 || (p.canBlockPass && getTile(s, x, y) === Tile.Block) || !hurt(p)) continue;
    if (s.revenge) giveCart(s, p);
    revengeSwap(s, p, flame.ownerId);
  }
}
