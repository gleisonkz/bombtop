import { describe, expect, it } from "vitest";
import { BattleSession, createMatch, DeltaReceiver, diff, publicView, RESULTS_TICKS, SB4_STAGES, step } from "../../src";

describe("SB4 full map cycle and snapshots", () => {
  it("runs the twelve-stage host rotation and wraps without losing stage state", () => {
    const session = new BattleSession({ seed: () => 14, blockDensity: 0 });
    session.join("host", "Host");
    session.join("guest", "Guest");
    expect(session.setRules("host", { stageRotation: SB4_STAGES.map(stage => ({ stage })) })).toBe(true);
    expect(session.start("host")).toBe(true);
    for (const stage of SB4_STAGES) {
      expect(session.match!.stage).toBe(stage);
      for (const player of session.match!.players) player.alive = false;
      expect(session.tick().result).toMatchObject({ over: true, winnerId: null });
      for (let tick = 0; tick < RESULTS_TICKS; tick++) session.tick();
    }
    expect(session.match!.stage).toBe("sb4-01");
    expect(session.phase).toBe("playing");
  });

  it.each(SB4_STAGES)("round-trips full and delta snapshots for %s", stage => {
    const match = createMatch({ stage, seed: 42, playerIds: ["a", "b"], blockDensity: 0 });
    const before = publicView(match);
    const stream = new DeltaReceiver<typeof before>();
    stream.full(JSON.parse(JSON.stringify(before)));
    for (let tick = 0; tick < 20; tick++) {
      const previous = publicView(match);
      step(match, { a: { dir: "right", bomb: tick === 0 }, b: { dir: "left", bomb: false } });
      const next = publicView(match);
      expect(stream.delta(JSON.parse(JSON.stringify(diff(previous, next))))).toEqual(next);
    }
  });
});
