import { bombButton, punch, updateHeldBombs } from "./air";
import { detonateRemote, placeBomb, updateBombs } from "./bombs";
import { cursedDirection, updateCurses } from "./curse";
import { applyFloor } from "./floor";
import { collectItems, dropItems } from "./items";
import { tryKick } from "./kick";
import { hurt, updateMountMove, useMountAbility } from "./mount";
import { steer } from "./movement";
import { updatePressure } from "./pressure";
import { driveCart, giveCart, revengeSwap } from "./revenge";
import { kamehameha, updateBlasts, updateRasengan, useSpecial } from "./special";
import { playerTile, type MatchState, type PlayerInput } from "./state";

/** Advances the simulation by one tick, applying each player's input for this tick. */
export function step(s: MatchState, inputs: Record<string, PlayerInput> = {}): void {
  s.tick++;
  const living = s.players.filter((p) => p.alive);
  // Thawed before anyone acts, so a freeze lasts the same whoever moved first.
  for (const p of s.players) {
    if (p.frozen > 0) p.frozen--;
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
    if (p.bubble > 0) p.bubble--;
    if (p.specialCooldown > 0) p.specialCooldown--;
    // Planted behind the shield: it wears off on time even if he gets stunned or frozen.
    if (p.shield > 0) {
      p.shield--;
      continue;
    }
    if (p.stun > 0) {
      p.stun--;
      p.charge = p.rasengan = 0;
      continue;
    }
    if (p.frozen > 0 || p.webbed > 0) {
      p.charge = p.rasengan = 0;
      continue;
    }
    if (p.rasengan > 0) {
      updateRasengan(s, p);
      continue;
    }
    if (p.charge > 0) {
      if (--p.charge === 0) kamehameha(s, p.id, playerTile(p), p.facing, true);
      continue;
    }
    if (updateMountMove(s, p)) continue;
    if (p.curse?.kind === "diarrhea") placeBomb(s, p.id);
    if (!input) continue;
    const dir = cursedDirection(p, input.dir);
    if (dir && p.alive) p.facing = dir;
    bombButton(s, p, input);
    if (input.action) detonateRemote(s, p.id) || punch(s, p) || useMountAbility(s, p);
    if (input.special) useSpecial(s, p);
    const moved = steer(s, p, dir, cursedDirection(p, input.alt ?? null));
    if (moved !== dir) p.facing = moved!;
    tryKick(s, p, moved);
  }

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
    if (!flame || p.bubble > 0 || !hurt(p)) continue;
    if (s.revenge) giveCart(s, p);
    revengeSwap(s, p, flame.ownerId);
  }
  for (const p of living) if (!p.alive) dropItems(s, p);

  updateHeldBombs(s);
}
