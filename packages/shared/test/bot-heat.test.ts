import { describe, expect, it } from "vitest";
import { BattleSession, botHeat, BOT_HEAT_MAX, BOTS_ONLY_HURRY, TICK_RATE, type BotLevel } from "../src";

/**
 * A match where the human watches from a corner, never moving, and is taken out at 45 s, the bots left to it: how long it
 * lasted, in seconds, and whether it ended before the walls came down.
 */
function leftToBots(level: BotLevel, seed: number, bots: number): { seconds: number; beforeWalls: boolean } {
  let n = seed * 7;
  const s = new BattleSession({ seed: () => seed, random: () => (n++ % 13) / 13 });
  s.join("human", "Human");
  for (let i = 0; i < bots; i++) s.addBot("human", level);
  s.start("human");
  const m = s.match!;
  const human = m.players.find((p) => p.id === "human")!;
  human.px = human.py = 0; // out of reach
  let t = 0;
  while (t < 45 * TICK_RATE && s.phase === "playing") {
    human.stun = 99;
    s.tick();
    t++;
  }
  human.alive = false;
  const pressure = m.pressure;
  while (t < 4 * 60 * TICK_RATE && s.phase === "playing") {
    s.tick();
    t++;
  }
  return { seconds: t / TICK_RATE, beforeWalls: m.pressure === pressure };
}

describe("bot heat", () => {
  it("warms up as the match goes on, a step at a time, and is at its hottest once no human is left", () => {
    expect(botHeat(0, true)).toBe(0);
    expect(botHeat(30 * TICK_RATE, true)).toBe(0);
    const steps = [60, 80, 100, 120].map((sec) => botHeat(sec * TICK_RATE, true));
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
    expect(botHeat(150 * TICK_RATE, true)).toBe(BOT_HEAT_MAX);
    expect(botHeat(0, false)).toBe(BOT_HEAT_MAX);
  });

  it("bots left on their own (the humans out) finish each other off, at least half the time before the walls fall in, never long after", () => {
    let before = 0;
    let all = 0;
    for (const level of ["easy", "medium", "hard"] as BotLevel[]) {
      for (const bots of [2, 4]) {
        for (let seed = 1; seed <= 6; seed++) {
          const r = leftToBots(level, seed, bots);
          expect(r.seconds, `${level} ${bots} bots, seed ${seed}`).toBeLessThan(45 + BOTS_ONLY_HURRY / TICK_RATE + 35);
          all++;
          if (r.beforeWalls) before++;
        }
      }
    }
    expect(before / all).toBeGreaterThanOrEqual(0.5);
  }, 120_000);
});

describe("sudden death once only bots are left", () => {
  it("the walls start falling when the match says (pressureAt), not only at the round's end", async () => {
    const { createMatch, step, PRESSURE_INTERVAL } = await import("../src");
    const s = createMatch({ seed: 1, playerIds: ["a", "b"], blockDensity: 0 });
    s.pressureAt = 30;
    for (let i = 0; i < 30 + 1 + PRESSURE_INTERVAL; i++) step(s, {});
    expect(s.pressure).toBeGreaterThan(0);
  });

  it(`comes ${BOTS_ONLY_HURRY / TICK_RATE} s after the last human is out, never later than the round's end`, async () => {
    const { ROUND_TICKS } = await import("../src");
    const s = new BattleSession({ seed: () => 3 });
    s.join("human", "Human");
    s.addBot("human", "easy");
    s.addBot("human", "easy");
    s.start("human");
    for (let i = 0; i < 60; i++) s.tick();
    expect(s.match!.pressureAt).toBe(ROUND_TICKS);
    s.match!.players.find((p) => p.id === "human")!.alive = false;
    s.tick();
    const at = s.match!.pressureAt;
    expect(at).toBe(s.match!.tick - 1 + BOTS_ONLY_HURRY);
    for (let i = 0; i < 30; i++) s.tick();
    expect(s.match!.pressureAt).toBe(at); // set once
  });
});
