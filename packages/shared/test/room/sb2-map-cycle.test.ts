import { describe, expect, it } from "vitest";
import { BattleSession, createMatch, DeltaReceiver, diff, getTile, publicView, RESULTS_TICKS, SB2_STAGES, SELECTABLE_STAGES, step, Tile, TILE } from "../../src";
import { SB2_FIFTH_SPAWN } from "../../src/sb2-native-motion";
import { SB2_STAGE_CAPTURES } from "../../src/sb2-stage-captures";

function session(players: number) {
  const s = new BattleSession({ seed: () => 14 });
  s.join("p0", "Host");
  for (let i = 1; i < players; i++) {
    s.join(`p${i}`, `P${i}`);
    s.setReady(`p${i}`, true);
  }
  return s;
}

function finishRound(s: BattleSession) {
  for (const player of s.match!.players) player.alive = false;
  s.tick();
  for (let tick = 0; tick < RESULTS_TICKS; tick++) s.tick();
}

describe("SB2 arenas in rooms", () => {
  it("are selectable", () => {
    expect(SB2_STAGES).toHaveLength(12);
    for (const stage of SB2_STAGES) expect(SELECTABLE_STAGES).toContain(stage);
  });

  it.each(SB2_STAGES)("seats a fifth player near the middle of %s, on plain floor with a way out", stage => {
    const ids = ["a", "b", "c", "d", "e"];
    const s = createMatch({ seed: 5, stage, playerIds: ids });
    const fifth = s.players[4]!;
    const x = Math.floor(fifth.px / TILE), y = Math.floor(fifth.py / TILE);
    expect(Math.abs(x - 7) + Math.abs(y - 6)).toBeLessThanOrEqual(2);
    expect(getTile(s, x, y)).toBe(Tile.Empty);
    const arena = SB2_STAGES.indexOf(stage);
    expect([0, 7, 192]).toContain(SB2_STAGE_CAPTURES[arena]!.background[y]![x]);
    expect(s.items.some(item => item.x === x && item.y === y)).toBe(false);
    const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => getTile(s, x + dx!, y + dy!) === Tile.Empty);
    expect(open.length).toBeGreaterThanOrEqual(1);
    expect(SB2_FIFTH_SPAWN[(arena + 1) as keyof typeof SB2_FIFTH_SPAWN]).toEqual(expect.objectContaining({ x, y }));
  });

  it.each(SB2_STAGES)("keeps %s exactly as the original with four players", stage => {
    const four = createMatch({ seed: 5, stage, playerIds: ["a", "b", "c", "d"] });
    const two = createMatch({ seed: 5, stage, playerIds: ["a", "b"] });
    expect(four.grid.tiles).toEqual(two.grid.tiles);
  });

  it("runs the twelve SB2 arenas in a rotation", () => {
    const s = session(2);
    expect(s.setRules("p0", { stageRotation: SB2_STAGES.map(stage => ({ stage })) })).toBe(true);
    expect(s.start("p0")).toBe(true);
    for (const stage of SB2_STAGES) {
      expect(s.match!.stage).toBe(stage);
      finishRound(s);
    }
    expect(s.match!.stage).toBe("sb2-01");
  });

  it("plays an SB2 arena with five in the room", () => {
    const s = session(5);
    expect(s.setRules("p0", { stageRotation: [{ stage: "sb2-01" }, { stage: "sb4-03" }] })).toBe(true);
    expect(s.start("p0")).toBe(true);
    expect(s.match!.stage).toBe("sb2-01");
    expect(s.match!.players).toHaveLength(5);
  });

  it.each(SB2_STAGES)("round-trips full and delta snapshots for %s", stage => {
    const match = createMatch({ stage, seed: 42, playerIds: ["a", "b"] });
    const stream = new DeltaReceiver<ReturnType<typeof publicView>>();
    stream.full(JSON.parse(JSON.stringify(publicView(match))));
    for (let tick = 0; tick < 40; tick++) {
      const previous = publicView(match);
      step(match, { a: { dir: "right", bomb: tick === 0 }, b: { dir: "left", bomb: false } });
      const next = publicView(match);
      expect(stream.delta(JSON.parse(JSON.stringify(diff(previous, next))))).toEqual(next);
    }
  });
});
