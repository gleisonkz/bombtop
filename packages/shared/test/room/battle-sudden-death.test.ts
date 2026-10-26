import { describe, expect, it } from "vitest";
import { C2S, getTile, PRESSURE_INTERVAL, pressureOrder, RoomCore, setTile, step, Tile, type LobbyInfo } from "../../src";

function battleRoom() {
  const lobbies: LobbyInfo[] = [];
  const core = new RoomCore("SUDDEN", {
    broadcast: (type, message) => { if (type === "lobby") lobbies.push(message as LobbyInfo); },
    send: () => {},
  });
  core.join("host", "Host", "bomb");
  core.join("guest", "Guest", "bomb");
  core.message("guest", C2S.ready, { ready: true });
  return { core, lobbies };
}

describe("Battle Mode Sudden Death", () => {
  it("keeps the existing full-pressure behavior enabled by default", () => {
    const { core } = battleRoom();
    expect(core.session.lobbyInfo("SUDDEN").suddenDeath).toBe(true);
    core.message("host", C2S.start);
    expect(core.session.match!.pressureLimit).toBeUndefined();
  });

  it("allows the host to toggle ON/OFF without changing time or victories", () => {
    const { core, lobbies } = battleRoom();
    core.message("host", C2S.rules, { winsToWin: 3, timeMinutes: 3 });
    core.message("host", C2S.rules, { suddenDeath: false });
    expect(lobbies.at(-1)).toMatchObject({ winsToWin: 3, timeMinutes: 3, suddenDeath: false });
    core.message("host", C2S.rules, { suddenDeath: true });
    expect(core.session.lobbyInfo("SUDDEN").suddenDeath).toBe(true);
  });

  it("rejects invalid, guest and mid-round changes", () => {
    const { core } = battleRoom();
    core.message("guest", C2S.rules, { suddenDeath: false });
    for (const suddenDeath of [null, 0, 1, "false", undefined]) {
      core.message("host", C2S.rules, { suddenDeath });
      expect(core.session.lobbyInfo("SUDDEN").suddenDeath).toBe(true);
    }
    core.message("host", C2S.start);
    core.message("host", C2S.rules, { suddenDeath: false });
    expect(core.session.lobbyInfo("SUDDEN").suddenDeath).toBe(true);
  });

  it("still drops outer walls when OFF but stops before closing the arena", () => {
    const { core } = battleRoom();
    core.message("host", C2S.rules, { suddenDeath: false, timeMinutes: 3 });
    core.message("host", C2S.start);
    const state = core.session.match!;
    const order = pressureOrder(state.grid.width, state.grid.height);
    const outerRing = 2 * (state.grid.width - 2 + state.grid.height - 2) - 4;
    expect(state.pressureLimit).toBe(outerRing);
    expect(state.pressureLimit).toBeLessThan(order.length);
    const next = order.slice(outerRing).find(({ x, y }) => getTile(state, x, y) !== Tile.Wall)!;
    setTile(state, next.x, next.y, Tile.Empty);
    state.pressure = outerRing - 1;
    state.tick = state.pressureAt + (outerRing - 1) * PRESSURE_INTERVAL;
    step(state);
    expect(state.pressure).toBe(outerRing);
    for (let i = 0; i < 3 * PRESSURE_INTERVAL; i++) step(state);
    expect(state.pressure).toBe(outerRing);
    expect(getTile(state, next.x, next.y)).toBe(Tile.Empty);
  });
});
