import { bombButton, punch, updateHeldBombs } from "./air";
import { detonateRemote, placeBomb, updateBombs } from "./bombs";
import { cursedDirection, updateCurses } from "./curse";
import { applyFloor } from "./floor";
import { collectItems, dropItems, scatterCurseItem } from "./items";
import { stopKickedBombs, tryKick } from "./kick";
import { tryPush, updatePushMotions } from "./push";
import { hurt, updateMountMove, useMountAbility } from "./mount";
import { steer } from "./movement";
import { advanceStageTempo } from "./stage";
import { updatePressure } from "./pressure";
import { driveCart, giveCart, revengeSwap } from "./revenge";
import { kamehameha, updateBlasts, updateRasengan, updateTruck, useSpecial } from "./special";
import { getTile, playerTile, Tile, type MatchState, type PlayerInput } from "./state";

/** Advances the simulation by one tick, applying each player's input for this tick. */
export function step(s: MatchState, inputs: Record<string, PlayerInput> = {}): void {
  s.tick++;
  advanceStageTempo(s);
  const living = s.players.filter((p) => p.alive);
  for (const p of living) {
    if (p.curse?.kind !== "hiccups") continue;
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
    const input = inputs[p.id];
    if (!p.alive) {
      driveCart(s, p, input?.dir ?? null, input?.bomb ?? false);
      continue;
    }
    if (p.invuln > 0) p.invuln--;
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
    if (p.curse?.kind === "diarrhea") placeBomb(s, p.id);
    if (!input && p.curse?.kind !== "cannotStop") continue;
    const dir = cursedDirection(p, input?.dir ?? null);
    if (dir && p.alive) p.facing = dir;
    if (input) bombButton(s, p, input);
    if (input?.action && !detonateRemote(s, p.id)) {
      const punched = punch(s, p);
      const pushed = tryPush(s, p, inputs);
      if (!punched && !pushed) useMountAbility(s, p);
    }
    if (input?.special) useSpecial(s, p);
    if (p.stun > 0 || p.shove) continue;
    const forced = p.curse?.kind === "cannotStop" ? p.curse : null;
    const intended = dir ?? forced?.momentum ?? null;
    const [px, py] = [p.px, p.py];
    const moved = steer(s, p, intended, cursedDirection(p, input?.alt ?? null));
    if (moved && moved !== dir) p.facing = moved;
    if (forced) {
      if (p.px !== px || p.py !== py) {
        if (moved) forced.momentum = moved;
      } else if (intended) delete forced.momentum;
    }
    if (!input?.stopKick) tryKick(s, p, moved);
  }

  updatePushMotions(s);
  updateBlasts(s);
  applyFloor(s);
  updateHeldBombs(s);
  collectItems(s);
  updateCurses(s);

  updateBombs(s);
  updatePressure(s);

  for (const p of s.players) {
    const { x, y } = playerTile(p);
    const flame = s.flames.find((f) => f.x === x && f.y === y);
    if (!flame || p.bubble > 0 || (p.canBlockPass && getTile(s, x, y) === Tile.Block) || !hurt(p)) continue;
    if (s.revenge) giveCart(s, p);
    revengeSwap(s, p, flame.ownerId);
  }
  for (const p of living) if (!p.alive) dropItems(s, p);

  updateHeldBombs(s);
}
