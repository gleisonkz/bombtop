import { describe, expect, it } from "vitest";
import { C2S, RESULTS_TICKS, RoomCore, WINS_TO_WIN, type LobbyInfo } from "../../src";

function lobby() {
  const broadcast: { type: string; message: unknown }[] = [];
  const core = new RoomCore("CODE", { broadcast: (type, message) => broadcast.push({ type, message }), send: () => {} });
  core.join("host", "Host", "bomb");
  core.join("guest", "Guest", "bomb");
  core.message("guest", C2S.ready, { ready: true });
  return { core, broadcast };
}

function scoreForHost(core: RoomCore) {
  for (const p of core.session.match!.players) if (p.id !== "host") p.alive = false;
  core.update();
  for (let i = 0; i < RESULTS_TICKS; i++) core.update();
}

describe("Battle Mode victory target", () => {
  it("keeps five wins as the existing default", () => {
    const { core } = lobby();
    expect(core.session.lobbyInfo("X").winsToWin).toBe(WINS_TO_WIN);
  });

  it("accepts all five valid win targets from the host before the match", () => {
    const { core } = lobby();
    for (const winsToWin of [1, 2, 3, 4, 5]) {
      core.message("host", C2S.rules, { winsToWin });
      expect(core.session.lobbyInfo("CODE").winsToWin).toBe(winsToWin);
    }
  });

  it("rejects guest changes, invalid values and mid-match changes", () => {
    const { core } = lobby();
    core.message("guest", C2S.rules, { winsToWin: 1 });
    expect(core.session.lobbyInfo("X").winsToWin).toBe(WINS_TO_WIN);
    for (const bad of [-1, 0, 6, 1.5, null, "2", true]) {
      core.message("host", C2S.rules, { winsToWin: bad });
      expect(core.session.lobbyInfo("X").winsToWin).toBe(WINS_TO_WIN);
    }
    core.message("host", C2S.start);
    core.message("host", C2S.rules, { winsToWin: 1 });
    expect(core.session.lobbyInfo("X").winsToWin).toBe(WINS_TO_WIN);
  });

  it("broadcasts the chosen number to everyone in the lobby", () => {
    const { core, broadcast } = lobby();
    core.message("host", C2S.rules, { winsToWin: 3 });
    expect((broadcast.at(-1)!.message as LobbyInfo).winsToWin).toBe(3);
  });

  it("ends a set after the selected number of victories and resets the score on restart", () => {
    const { core } = lobby();
    core.message("host", C2S.rules, { winsToWin: 2 });
    core.message("host", C2S.start);
    scoreForHost(core);
    expect(core.session.phase).toBe("playing");
    expect(core.session.members.find((m) => m.id === "host")!.wins).toBe(1);
    scoreForHost(core);
    expect(core.session.phase).toBe("lobby");
    expect(core.session.members.find((m) => m.id === "host")!.wins).toBe(2);
    core.message("guest", C2S.ready, { ready: true });
    core.message("host", C2S.start);
    expect(core.session.members.find((m) => m.id === "host")!.wins).toBe(0);
    expect(core.session.lobbyInfo("X").winsToWin).toBe(2);
  });
});
