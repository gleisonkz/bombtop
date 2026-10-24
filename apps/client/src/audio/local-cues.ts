import { bombButton, detonateRemote, punch, useMountAbility, useSpecial, type MatchState, type Player, type PlayerInput, type PublicView } from "@bombtop/shared";
import { soundCues, type Cue, type CueName } from "./cues";

/** Sounds of our own button presses, played before the server confirms them. */
const OWN: ReadonlySet<CueName> = new Set<CueName>([
  "place", "throw", "jump", "dash", "ice", "web", "thunder", "shock", "magnet", "zoom", "dig", "spin", "kiss", "bubble", "kamehameha", "rasengan", "mega",
  "bomb-special", "ninja-special", "captain-special", "thor-special", "spider-special", "pikachu-special", "flash-special", "bugs-special", "lantern-special", "donatello-special", "penelope-special", "panther-special", "harry-special",
]);

/**
 * What our own button press sounds like, worked out with the same rules the
 * server runs, on the latest snapshot with our predicted player in it.
 */
export function actionCues(view: PublicView, me: Player, input: PlayerInput): Cue[] {
  // step thaws first; the other busy states consume even their final tick.
  if (!me.alive || me.frozen > 1 || me.webbed > 1 || me.shield > 0 || me.stun > 0 || me.charge > 0 || me.rasengan > 0) return [];
  if (me.jumpTicks > 0 || me.dashTicks > 0) return [];
  const before: MatchState = { ...structuredClone(view), rng: 0, players: [structuredClone(me)] };
  const after = structuredClone(before);
  const p = after.players[0]!;
  bombButton(after, p, input);
  if (input.action) detonateRemote(after, p.id) || punch(after, p) || useMountAbility(after, p);
  if (input.special) useSpecial(after, p);
  return soundCues(before, after).filter((c) => OWN.has(c.name));
}

/** How long the server has to echo a sound we already played. */
const ECHO_MS = 1500;
/** Tiles between our sound and the server's copy (we may have moved meanwhile). */
const ECHO_TILES = 1.5;

/** Swallows the server's copy of sounds this client played ahead of time. */
export class EchoFilter {
  private pending: { cue: Cue; at: number }[] = [];

  played(cues: Cue[], nowMs: number): void {
    for (const cue of cues) this.pending.push({ cue, at: nowMs });
  }

  filter(cues: Cue[], nowMs: number): Cue[] {
    this.pending = this.pending.filter((p) => nowMs - p.at < ECHO_MS);
    return cues.filter((c) => {
      const i = this.pending.findIndex((p) => p.cue.name === c.name && Math.abs(p.cue.x - c.x) <= ECHO_TILES);
      if (i < 0) return true;
      this.pending.splice(i, 1);
      return false;
    });
  }
}
