import { describe, expect, it } from "vitest";
import {
  BattleSession,
  C2S,
  DEFAULT_STAGE_ROTATION,
  RESULTS_TICKS,
  RoomCore,
  S2C,
  STAGES,
  WINS_TO_WIN,
  type LobbyInfo,
  type StageRotationEntry,
} from "../../src";

function lobby() {
  const session = new BattleSession({ seed: () => 1, blockDensity: 0 });
  session.join("host", "Host");
  session.join("guest", "Guest");
  return session;
}

function finishRound(session: BattleSession, winnerId?: string) {
  for (const player of session.match!.players) player.alive = player.id === winnerId;
  const result = session.tick().result;
  expect(session.phase).toBe("results");
  expect(result).toMatchObject({ over: true, winnerId: winnerId ?? null });
  return result;
}

function advanceResults(session: BattleSession) {
  for (let i = 0; i < RESULTS_TICKS; i++) session.tick();
}

function tieRound(session: BattleSession) {
  expect(finishRound(session)?.setOver).toBe(false);
  advanceResults(session);
  expect(session.phase).toBe("playing");
}

function room() {
  const broadcasts: { type: string; message?: unknown }[] = [];
  const core = new RoomCore("CODE", {
    send: () => {},
    broadcast: (type, message) => broadcasts.push({ type, message }),
  });
  core.join("host", "Host", "bomb");
  core.join("guest", "Guest", "bomb");
  broadcasts.length = 0;
  return { core, broadcasts };
}

describe("stage rotation rules", () => {
  it("accepts a host rotation and exposes it in the lobby", () => {
    const session = new BattleSession({ seed: () => 1, blockDensity: 0 });
    session.join("host", "Host");
    const stageRotation = [{ stage: "warp" }];
    expect(session.setRules("host", { stageRotation })).toBe(true);
    expect(session.lobbyInfo("CODE").stageRotation).toEqual(stageRotation);
    expect(session.lobbyInfo("CODE").stage).toBe("warp");
  });

  it("defaults to one round per stage and wraps the complete default cycle", () => {
    const session = lobby();
    expect(session.lobbyInfo("CODE")).toMatchObject({
      stage: STAGES[0],
      stageRotation: STAGES.map((stage) => ({ stage })),
      winsToWin: WINS_TO_WIN,
    });
    expect(session.lobbyInfo("CODE").stageRotation).toEqual(DEFAULT_STAGE_ROTATION);
    expect(session.start("host")).toBe(true);
    for (const stage of [...STAGES, ...STAGES]) {
      expect(session.stage).toBe(stage);
      expect(session.lobbyInfo("CODE").stage).toBe(stage);
      tieRound(session);
    }
    expect(session.stage).toBe(STAGES[0]);
    expect(session.members.map((member) => member.wins)).toEqual([0, 0]);
  });

  it("accepts either optional field while preserving the omitted field", () => {
    const session = lobby();
    const stageRotation: StageRotationEntry[] = [{ stage: "warp" }];
    expect(session.setRules("host", { winsToWin: 2, stageRotation })).toBe(true);
    expect(session.setRules("host", { winsToWin: 4 })).toBe(true);
    expect(session.lobbyInfo("CODE")).toMatchObject({ winsToWin: 4, stageRotation });
    const replacement: StageRotationEntry[] = [{ stage: "conveyor" }];
    expect(session.setRules("host", { stageRotation: replacement })).toBe(true);
    expect(session.lobbyInfo("CODE")).toMatchObject({ winsToWin: 4, stageRotation: replacement });
  });

  it.each([
    null, undefined, false, 3, "rules", [], {}, { unrelated: true },
    { winsToWin: undefined }, { stageRotation: undefined },
    { winsToWin: 2, stageRotation: undefined },
    { winsToWin: undefined, stageRotation: [{ stage: "warp" }] },
    { winsToWin: 2, stageRotation: [] },
    { winsToWin: 2, stageRotation: [{ stage: "missing" }] },
    { winsToWin: 2, stageRotation: [{}] },
    { winsToWin: 6, stageRotation: [{ stage: "warp" }] },
  ])("rejects invalid rules atomically: %j", (raw: unknown) => {
    const session = lobby();
    const before = session.lobbyInfo("CODE");
    expect(session.setRules("host", raw)).toBe(false);
    expect(session.lobbyInfo("CODE")).toEqual(before);
  });

  it("uses own provided fields and ignores inherited fields", () => {
    const session = lobby();
    const before = session.lobbyInfo("CODE");
    expect(session.setRules("host", Object.create({ winsToWin: 2 }))).toBe(false);
    expect(session.lobbyInfo("CODE")).toEqual(before);
    const rules = Object.assign(Object.create({ stageRotation: undefined }), { winsToWin: 2 });
    expect(session.setRules("host", rules)).toBe(true);
    expect(session.lobbyInfo("CODE")).toMatchObject({ winsToWin: 2, stageRotation: DEFAULT_STAGE_ROTATION });
    const rotation = [{ stage: "warp" }];
    expect(session.setRules("host", Object.assign(Object.create({ winsToWin: undefined }), { stageRotation: rotation }))).toBe(true);
    expect(session.lobbyInfo("CODE")).toMatchObject({ winsToWin: 2, stageRotation: rotation });
  });

  it("allows only the current host to change rules in the lobby", () => {
    const session = lobby();
    const before = session.lobbyInfo("CODE");
    for (const id of ["guest", "missing"]) {
      expect(session.setRules(id, { winsToWin: 1 })).toBe(false);
      expect(session.lobbyInfo("CODE")).toEqual(before);
    }
    session.leave("host");
    expect(session.setRules("host", { winsToWin: 1 })).toBe(false);
    expect(session.setRules("guest", { winsToWin: 1 })).toBe(true);
  });

  it("rejects changes during playing and results without mutating either field", () => {
    const session = lobby();
    session.start("host");
    for (const phase of ["playing", "results"]) {
      expect(session.phase).toBe(phase);
      const before = session.lobbyInfo("CODE");
      expect(session.setRules("host", { winsToWin: 1, stageRotation: [{ stage: "warp" }] })).toBe(false);
      expect(session.setWinsToWin("host", 1)).toBe(false);
      expect(session.lobbyInfo("CODE")).toEqual(before);
      if (phase === "playing") finishRound(session);
    }
  });

  it("preserves setWinsToWin validation and the selected rotation", () => {
    const session = lobby();
    const stageRotation = [{ stage: "warp" }];
    session.setRules("host", { stageRotation });
    for (const wins of [1, 2, 3, 4, 5]) {
      expect(session.setWinsToWin("host", wins)).toBe(true);
      expect(session.lobbyInfo("CODE")).toMatchObject({ winsToWin: wins, stageRotation });
    }
    for (const bad of [undefined, null, "2", true, 0, 6, 1.5, NaN, Infinity]) {
      expect(session.setWinsToWin("host", bad)).toBe(false);
      expect(session.lobbyInfo("CODE")).toMatchObject({ winsToWin: 5, stageRotation });
    }
    expect(session.setWinsToWin("guest", 1)).toBe(false);
  });

  it("clones input arrays, input entries and every lobby snapshot", () => {
    const session = lobby();
    const stageRotation: StageRotationEntry[] = [{ stage: "warp" }];
    expect(session.setRules("host", { stageRotation })).toBe(true);
    const snapshot = session.lobbyInfo("CODE");
    expect(snapshot.stageRotation).not.toBe(stageRotation);
    expect(snapshot.stageRotation![0]).not.toBe(stageRotation[0]);
    stageRotation[0]!.stage = "classic";
    stageRotation.push({ stage: "classic" });
    snapshot.stageRotation![0]!.stage = "conveyor";
    snapshot.stageRotation!.push({ stage: "classic" });
    const fresh = session.lobbyInfo("CODE");
    expect(fresh.stageRotation).toEqual([{ stage: "warp" }]);
    expect(fresh.stageRotation).not.toBe(snapshot.stageRotation);
    expect(fresh.stageRotation![0]).not.toBe(snapshot.stageRotation![0]);
    session.start("host");
    expect(session.stage).toBe("warp");
    tieRound(session);
    expect(session.stage).toBe("warp");
  });

  it("isolates default rotations between sessions and lobby snapshots", () => {
    const first = lobby();
    const second = lobby();
    const snapshot = first.lobbyInfo("CODE");
    snapshot.stageRotation![0]!.stage = "warp";
    snapshot.stageRotation!.push({ stage: "classic" });
    expect(first.lobbyInfo("CODE").stageRotation).toEqual(DEFAULT_STAGE_ROTATION);
    expect(second.lobbyInfo("CODE").stageRotation).toEqual(DEFAULT_STAGE_ROTATION);
    expect(DEFAULT_STAGE_ROTATION).toEqual(STAGES.map((stage) => ({ stage })));
  });

  it("advances one slot per round, preserves slot order and wraps through ties", () => {
    const session = lobby();
    const stageRotation: StageRotationEntry[] = [
      { stage: "warp" },
      { stage: "warp" },
      { stage: "classic" },
      { stage: "warp" },
      { stage: "conveyor" },
      { stage: "conveyor" },
      { stage: "conveyor" },
    ];
    session.setRules("host", { stageRotation });
    session.start("host");
    const cycle = ["warp", "warp", "classic", "warp", "conveyor", "conveyor", "conveyor"];
    for (const stage of [...cycle, ...cycle, "warp"]) {
      expect(session.stage).toBe(stage);
      expect(session.lobbyInfo("CODE").stage).toBe(stage);
      tieRound(session);
    }
    expect(session.members.map((member) => member.wins)).toEqual([0, 0]);
  });

  it("keeps duplicate slots as separate rounds", () => {
    const session = lobby();
    const stageRotation: StageRotationEntry[] = [
      { stage: "warp" },
      { stage: "warp" },
      { stage: "classic" },
    ];
    expect(session.setRules("host", { stageRotation })).toBe(true);
    expect(session.lobbyInfo("CODE").stageRotation).toEqual(stageRotation);
    expect(session.start("host")).toBe(true);
    for (const stage of ["warp", "warp", "classic", "warp"]) {
      expect(session.stage).toBe(stage);
      tieRound(session);
    }
  });

  it("keeps the current stage throughout results until the last results tick", () => {
    const session = lobby();
    session.start("host");
    finishRound(session);
    for (let i = 0; i < RESULTS_TICKS - 1; i++) session.tick();
    expect(session.phase).toBe("results");
    expect(session.lobbyInfo("CODE").stage).toBe("classic");
    session.tick();
    expect(session.phase).toBe("playing");
    expect(session.lobbyInfo("CODE").stage).toBe("conveyor");
  });

  it("restarts each new set at the first stage and keeps rules while clearing wins", () => {
    const session = lobby();
    const stageRotation: StageRotationEntry[] = [{ stage: "warp" }, { stage: "classic" }];
    session.setRules("host", { winsToWin: 1, stageRotation });
    session.start("host");
    tieRound(session);
    expect(session.stage).toBe("classic");
    expect(finishRound(session, "host")?.setOver).toBe(true);
    advanceResults(session);
    expect(session.phase).toBe("lobby");
    expect(session.match).toBeNull();
    expect(session.members[0]!.wins).toBe(1);
    expect(session.start("host")).toBe(true);
    expect(session.stage).toBe("warp");
    expect(session.members.map((member) => member.wins)).toEqual([0, 0]);
    expect(session.lobbyInfo("CODE")).toMatchObject({ winsToWin: 1, stageRotation });
  });

  it("plays both selected SB4 stages when two wins are required", () => {
    const session = lobby();
    const stageRotation: StageRotationEntry[] = [{ stage: "sb4-01" }, { stage: "sb4-02" }];
    expect(session.setRules("host", { winsToWin: 2, stageRotation })).toBe(true);
    session.start("host");
    expect(session.match!.stage).toBe("sb4-01");
    expect(finishRound(session, "host")?.setOver).toBe(false);
    advanceResults(session);
    expect(session.match!.stage).toBe("sb4-02");
    expect(finishRound(session, "host")?.setOver).toBe(true);
    advanceResults(session);
    expect(session.lobbyInfo("CODE")).toMatchObject({ phase: "lobby", stage: "sb4-01", stageRotation });
  });

  it("announces the first configured stage when returning to the lobby after a set", () => {
    const session = lobby();
    const stageRotation: StageRotationEntry[] = [{ stage: "sb4-01" }, { stage: "sb4-02" }];
    session.setRules("host", { winsToWin: 1, stageRotation });
    session.start("host");
    finishRound(session, "host");
    advanceResults(session);
    expect(session.lobbyInfo("CODE")).toMatchObject({ phase: "lobby", stage: "sb4-01", stageRotation });
    session.start("host");
    expect(session.stage).toBe("sb4-01");
    expect(session.match!.stage).toBe("sb4-01");
  });

  it.each(["wins", "rotation"])("keeps the first stage announced when accepting %s configuration", (field) => {
    const session = lobby();
    session.setWinsToWin("host", 1);
    session.start("host");
    finishRound(session, "host");
    advanceResults(session);
    expect(session.lobbyInfo("CODE").stage).toBe("classic");
    const rules = field === "wins" ? { winsToWin: 2 } : { stageRotation: DEFAULT_STAGE_ROTATION };
    expect(session.setRules("host", rules)).toBe(true);
    expect(session.lobbyInfo("CODE").stage).toBe("classic");
  });

  it("preserves the round cursor when rejecting configuration", () => {
    const session = lobby();
    session.setWinsToWin("host", 1);
    session.start("host");
    finishRound(session, "host");
    advanceResults(session);
    const before = session.lobbyInfo("CODE");
    expect(before.stage).toBe("classic");
    expect(session.setRules("host", { winsToWin: 2, stageRotation: [] })).toBe(false);
    expect(session.lobbyInfo("CODE")).toEqual(before);
  });
});

describe("RoomCore rotation rules", () => {
  it.each([
    { stageRotation: [{ stage: "warp" }] },
    { winsToWin: 2 },
    { winsToWin: 3, stageRotation: [{ stage: "conveyor" }] },
  ])("broadcasts exactly one updated lobby for accepted rules: %j", (rules) => {
    const { core, broadcasts } = room();
    core.message("host", C2S.rules, rules);
    expect(broadcasts).toHaveLength(1);
    expect(broadcasts[0]!.type).toBe(S2C.lobby);
    expect(broadcasts[0]!.message).toMatchObject({ ...rules, code: "CODE", phase: "lobby" });
    expect(broadcasts[0]!.message).toEqual({ ...core.session.lobbyInfo("CODE"), watchers: 0 });
  });

  it("does not broadcast or mutate rules for invalid messages or unauthorized senders", () => {
    const { core, broadcasts } = room();
    core.watch("watcher");
    broadcasts.length = 0;
    const before = core.session.lobbyInfo("CODE");
    for (const id of ["guest", "missing", "watcher"]) {
      core.message(id, C2S.rules, { winsToWin: 2, stageRotation: [{ stage: "warp" }] });
    }
    for (const raw of [undefined, null, [], {}, { winsToWin: 2, stageRotation: [] }, { winsToWin: undefined }]) {
      core.message("host", C2S.rules, raw);
    }
    expect(broadcasts).toEqual([]);
    expect(core.session.lobbyInfo("CODE")).toEqual(before);
  });

  it("does not broadcast rules changes during playing or results", () => {
    const { core, broadcasts } = room();
    core.message("host", C2S.start);
    for (const phase of ["playing", "results"]) {
      expect(core.session.phase).toBe(phase);
      broadcasts.length = 0;
      const before = core.session.lobbyInfo("CODE");
      core.message("host", C2S.rules, { winsToWin: 1, stageRotation: [{ stage: "warp" }] });
      expect(broadcasts).toEqual([]);
      expect(core.session.lobbyInfo("CODE")).toEqual(before);
      if (phase === "playing") {
        for (const player of core.session.match!.players) player.alive = false;
        core.update();
      }
    }
  });

  it("keeps a broadcast snapshot independent of later accepted rules", () => {
    const { core, broadcasts } = room();
    core.message("host", C2S.rules, { stageRotation: [{ stage: "warp" }] });
    const earlier = broadcasts[0]!.message as LobbyInfo;
    core.message("host", C2S.rules, { stageRotation: [{ stage: "classic" }] });
    expect(earlier.stageRotation).toEqual([{ stage: "warp" }]);
    earlier.stageRotation![0]!.stage = "conveyor";
    earlier.stageRotation!.push({ stage: "warp" });
    expect(core.session.lobbyInfo("CODE").stageRotation).toEqual([{ stage: "classic" }]);
  });
});
