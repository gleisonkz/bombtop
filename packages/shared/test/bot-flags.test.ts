import { describe, expect, it } from "vitest";
import { Bot, carriesStageFlag, createMatch, step, TICK_RATE, type BotLevel } from "../src";

describe("bots on Flag Tag", () => {
  it.each(["easy", "medium", "hard"] as BotLevel[])("%s bots carrying their own flag still bomb", (level) => {
    const s = createMatch({ stage: "sb4-12", seed: 7, playerIds: ["a", "b"] });
    const bots = s.players.map((p) => new Bot(p.id, level));
    const seen = new WeakSet<object>();
    let placed = 0;
    let carried = false;
    for (let t = 0; t < 20 * TICK_RATE; t++) {
      step(s, Object.fromEntries(bots.map((b) => [b.id, b.input(s)])));
      carried ||= s.players.some((p) => carriesStageFlag(s, p.id));
      for (const b of s.bombs) {
        if (seen.has(b)) continue;
        seen.add(b);
        placed++;
      }
    }
    expect(carried).toBe(true);
    expect(placed).toBeGreaterThan(5);
  });
});
