import { describe, expect, it } from "vitest";
import { BattleSession, C2S, matchResult, RoomCore, ROUND_TICKS, TICK_RATE, type LobbyInfo } from "../../src";

function room() {
  const lobbies: LobbyInfo[] = [];
  const core = new RoomCore("TIMER", {
    broadcast: (type, message) => { if (type === "lobby") lobbies.push(message as LobbyInfo); },
    send: () => {},
  });
  core.join("host", "Host", "bomb");
  core.join("guest", "Guest", "bomb");
  core.message("guest", C2S.ready, { ready: true });
  return { core, lobbies };
}

describe("Battle Mode TIME", () => {
  it("keeps the existing Bombtop match unbounded until a finite time is selected", () => {
    const { core } = room();
    expect(core.session.lobbyInfo("TIMER").timeMinutes).toBeNull();
    core.message("host", C2S.start);
    expect(core.session.match!.roundEndsAt).toBeUndefined();
    expect(core.session.match!.pressureAt).toBe(ROUND_TICKS);
  });

  it("accepts 1, 2, 3, 5 minutes and infinite, then shares the selection", () => {
    const { core, lobbies } = room();
    for (const timeMinutes of [1, 2, 3, 5, null]) {
      core.message("host", C2S.rules, { timeMinutes });
      expect(lobbies.at(-1)!.timeMinutes).toBe(timeMinutes);
    }
  });

  it("rejects invalid values and guest or mid-match edits", () => {
    const { core } = room();
    core.message("host", C2S.rules, { timeMinutes: 2 });
    for (const bad of [-1, 0, 4, 6, 1.5, "3", true, undefined]) {
      core.message("host", C2S.rules, { timeMinutes: bad });
      expect(core.session.lobbyInfo("TIMER").timeMinutes).toBe(2);
    }
    core.message("guest", C2S.rules, { timeMinutes: 1 });
    expect(core.session.lobbyInfo("TIMER").timeMinutes).toBe(2);
    core.message("host", C2S.start);
    core.message("host", C2S.rules, { timeMinutes: 5 });
    expect(core.session.lobbyInfo("TIMER").timeMinutes).toBe(2);
  });

  it("validates time, wins and arena sequence atomically in a combined rules message", () => {
    const { core } = room();
    const rotation = core.session.lobbyInfo("TIMER").stageRotation;
    core.message("host", C2S.rules, { timeMinutes: 2, winsToWin: 3 });
    expect(core.session.lobbyInfo("TIMER")).toMatchObject({ timeMinutes: 2, winsToWin: 3, stageRotation: rotation });
    core.message("host", C2S.rules, { timeMinutes: 4, winsToWin: 1 });
    expect(core.session.lobbyInfo("TIMER")).toMatchObject({ timeMinutes: 2, winsToWin: 3, stageRotation: rotation });
  });

  it.each([1, 2, 3, 5])("separates the %i minute round deadline from sudden death", (minutes) => {
    const { core } = room();
    core.message("host", C2S.rules, { timeMinutes: minutes });
    core.message("host", C2S.start);
    expect(core.session.match!.roundEndsAt).toBe(minutes * 60 * TICK_RATE);
    expect(core.session.match!.pressureAt).toBe(Math.max(0, (minutes - 1) * 60 * TICK_RATE));
  });

  it("ends a timed round in a draw at zero without awarding a victory", () => {
    const { core } = room();
    core.message("host", C2S.rules, { timeMinutes: 1 });
    core.message("host", C2S.start);
    const match = core.session.match!;
    match.pressureAt = Number.MAX_SAFE_INTEGER;
    match.tick = 60 * TICK_RATE - 2;
    core.update();
    expect(core.session.phase).toBe("playing");
    core.update();
    expect(core.session.phase).toBe("results");
    expect(core.session.members.every((m) => m.wins === 0)).toBe(true);
  });

  it("keeps a last-survivor victory when elimination happens on the deadline", () => {
    const session = new BattleSession();
    session.join("a", "A");
    session.join("b", "B");
    session.setReady("b", true);
    session.setTimeMinutes("a", 1);
    session.start("a");
    session.match!.pressureAt = Number.MAX_SAFE_INTEGER;
    session.match!.tick = 60 * TICK_RATE - 1;
    session.match!.players[1]!.alive = false;
    expect(session.tick().result).toEqual({ over: true, winnerId: "a", setOver: false });
  });

  it("returns the correct result for a timed snapshot independently of pressure", () => {
    const { core } = room();
    core.message("host", C2S.rules, { timeMinutes: 1 });
    core.message("host", C2S.start);
    const match = core.session.match!;
    match.pressureAt = Number.MAX_SAFE_INTEGER;
    match.tick = match.roundEndsAt!;
    expect(matchResult(match)).toEqual({ over: true, winnerId: null });
  });
});
