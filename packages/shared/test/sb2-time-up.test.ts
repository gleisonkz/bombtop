import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createMatch } from "../src/arena";
import { matchResult } from "../src/pressure";
import { updateSb2BattleClock } from "../src/sb2-battle-clock";

interface Row { frame: number; clock: { minutes: number; seconds: number; frame: number }; playersOut: boolean }
const fixture = JSON.parse(readFileSync(new URL("../../../docs/sb2/SB2-STAGE12-TIME-UP-CLOCK.json", import.meta.url), "utf8")) as { samples: Row[] };

describe("SB2 time up (arena 12, REA x Snes9x capture)", () => {
  it("plays one more full second at 0:00, then ends the round as a draw and freezes the clock", () => {
    const s = createMatch({ seed: 1, stage: "sb2-12", playerIds: ["a", "b"] });
    const runtime = s.stageState!.sb2!;
    const [first, ...rest] = fixture.samples;
    runtime.battleClock = { ...first!.clock };
    runtime.closure = { ...runtime.closure!, flags: 7, index: 81 };
    for (const row of rest) {
      updateSb2BattleClock(s, true);
      const { minutes, seconds, frame } = runtime.battleClock!;
      expect({ frame: row.frame, clock: { minutes, seconds, frame } }).toEqual({ frame: row.frame, clock: row.clock });
      expect({ frame: row.frame, over: matchResult(s).over }).toEqual({ frame: row.frame, over: row.playersOut });
    }
    expect(matchResult(s)).toEqual({ over: true, winnerId: null });
  });

  it("still lets a kill decide the round during that last second", () => {
    const s = createMatch({ seed: 1, stage: "sb2-12", playerIds: ["a", "b"] });
    s.stageState!.sb2!.battleClock = { minutes: 0, seconds: 0, frame: 10 };
    expect(matchResult(s).over).toBe(false);
    s.players[1]!.alive = false;
    expect(matchResult(s)).toEqual({ over: true, winnerId: "a" });
  });
});
