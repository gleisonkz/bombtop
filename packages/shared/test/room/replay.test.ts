import { describe, expect, it } from "vitest";
import { BattleSession, C2S, publicView, replayEvents, replayMatch, RoomCore, type MatchState, type Replay } from "../../src";

/** A seeded room with one person and two bots, playing. */
function room(record?: (r: Replay) => void) {
  const s = new BattleSession({ seed: () => 1234, ...(record && { record }) });
  s.join("c1", "Gleison");
  s.join("c2", "Amigo");
  s.setReady("c2", true);
  s.addBot("c1", "hard");
  s.addBot("c1", "medium");
  s.start("c1");
  return s;
}

/** The person walks a little square and drops a bomb now and then; the friend just stands. */
function play(s: BattleSession, ticks: number) {
  const dirs = ["right", "down", "left", "up"] as const;
  for (let t = 0; t < ticks; t++) {
    s.setInput("c1", { dir: dirs[Math.floor(t / 40) % 4]!, bomb: t % 97 === 0, action: false, ...(t % 150 < 10 && { brace: true }) });
    s.tick();
  }
}

const view = (m: MatchState) => JSON.parse(JSON.stringify(publicView(m)));

describe("match replays", () => {
  it("plays a round back tick for tick from its seed and inputs (bots' moves included)", () => {
    const s = room();
    play(s, 900);
    const replay = s.replay()!;
    expect(replay.ticks).toBe(s.match!.tick);
    expect(view(replayMatch(replay))).toEqual(view(s.match!));
  });

  it("stops at any tick, the state as it was then", () => {
    const s = room();
    play(s, 300);
    const at300 = view(s.match!);
    play(s, 300);
    expect(view(replayMatch(s.replay()!, 300))).toEqual(at300);
  });

  it("keeps who left mid-round", () => {
    const s = room();
    play(s, 200);
    s.leave("c2");
    play(s, 200);
    const replay = s.replay()!;
    expect(view(replayMatch(replay))).toEqual(view(s.match!));
    expect(replay.leaves).toEqual([[200, "c2"]]);
  });

  it("is handed over when the round ends, with its players and result", () => {
    const got: Replay[] = [];
    const s = new BattleSession({ seed: () => 7, record: (r) => got.push(r) });
    s.join("c1", "Gleison");
    s.join("c2", "Amigo");
    s.setReady("c2", true);
    s.start("c1");
    play(s, 10);
    s.leave("c2");
    s.tick();
    expect(got).toHaveLength(1);
    expect(got[0]!.players.map((p) => p.name)).toEqual(["Gleison", "Amigo"]);
    expect(got[0]!.result).toMatchObject({ over: true, winnerId: "c1" });
    expect(got[0]!.round).toBe(1);
    expect(view(replayMatch(got[0]!))).toEqual(view(s.match!));
  });

  it("goes out of a RoomCore with each round's end", () => {
    const got: Replay[] = [];
    const core = new RoomCore("ABC", { send: () => {}, broadcast: () => {}, replay: (r) => got.push(r) });
    core.join("c1", "Gleison", "goku");
    core.join("c2", "Amigo", "naruto");
    core.message("c2", C2S.ready, { ready: true });
    core.message("c1", C2S.start, {});
    core.update();
    core.leave("c2");
    core.update();
    expect(got.map((r) => r.result?.winnerId)).toEqual(["c1"]);
  });

  it("tells what happened, tick by tick: bombs, deaths", () => {
    const s = new BattleSession({ seed: () => 7 });
    s.join("c1", "Gleison");
    s.join("c2", "Amigo");
    s.setReady("c2", true);
    s.start("c1");
    s.setInput("c1", { dir: null, bomb: true, action: false });
    s.tick();
    play(s, 5);
    s.leave("c2");
    s.tick();
    const events = replayEvents(s.replay()!);
    expect(events).toContainEqual(expect.objectContaining({ tick: 1, who: "c1", what: "bomba" }));
    expect(events).toContainEqual(expect.objectContaining({ who: "c2", what: "morreu" }));
  });
});
