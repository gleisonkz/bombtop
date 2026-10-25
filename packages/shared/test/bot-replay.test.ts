import { describe, expect, it } from "vitest";
import { BattleSession, type BotLevel } from "../src";

/**
 * Seeded bot matches, fingerprinted tick by tick. Speeding up the bots or the
 * simulation must not change a single decision: these fingerprints only move
 * when the game's behavior is meant to change (then update them on purpose).
 */
function replay(level: BotLevel, loaded: boolean, ticks: number): string {
  let n = 0;
  const s = new BattleSession({ seed: () => 99, random: () => (n++ % 7) / 7 });
  s.join("human", "Human");
  for (let i = 0; i < 4; i++) s.addBot("human", level);
  s.start("human");
  if (loaded) {
    for (const p of s.match!.players) {
      p.bombCapacity = 8;
      p.fireRange = 8;
    }
  }
  let h = 2166136261;
  const mix = (v: number) => {
    h = Math.imul(h ^ v, 16777619) >>> 0;
  };
  for (let t = 0; t < ticks && s.phase === "playing"; t++) {
    s.tick();
    const m = s.match;
    if (!m) break;
    for (const p of m.players) {
      mix(p.px);
      mix(p.py);
      mix(p.alive ? 1 : 0);
    }
    for (const b of m.bombs) {
      mix(b.x);
      mix(b.y);
      mix(b.fuse);
    }
    mix(m.flames.length);
  }
  return `${s.match?.tick ?? "over"}:${h.toString(16)}`;
}

describe("bot replays", () => {
  it("medium bots play the same seeded match", () => {
    expect(replay("medium", false, 4000)).toMatchInlineSnapshot(`"2403:51f14e86"`);
  });

  it("hard bots play the same seeded match", () => {
    expect(replay("hard", false, 4000)).toMatchInlineSnapshot(`"2634:c2a63ed0"`);
  });

  it("hard bots with every power-up (bombs everywhere, chains) play the same seeded match", () => {
    expect(replay("hard", true, 4000)).toMatchInlineSnapshot(`"1949:c8d39c02"`);
  });
});
