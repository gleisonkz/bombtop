import { describe, expect, it } from "vitest";
import { BattleSession, C2S, ItemKind, RESULTS_TICKS, RoomCore } from "../../src";

function session() {
  const s = new BattleSession({ seed: () => 64, blockDensity: 1 });
  s.join("host", "Host");
  s.join("guest", "Guest");
  return s;
}

describe("Super Bomberman 4 Maniac match mode", () => {
  it("starts in classic Single with no restricted inventory and allows selecting Maniac", () => {
    const s = session();
    expect(s.lobbyInfo("X").battleMode).toBe("single");
    expect(s.setRules("host", { battleMode: "maniac" })).toBe(true);
    expect(s.lobbyInfo("X")).toMatchObject({
      battleMode: "maniac", stage: "classic", winsToWin: 3, timeMinutes: 3, suddenDeath: false,
      stageRotation: [{ stage: "classic" }],
    });
  });

  it("accepts a host-edited Maniac inventory and independent player HP through the room protocol", () => {
    const broadcasts: unknown[] = [];
    const core = new RoomCore("X", { broadcast: (type, message) => { if (type === "lobby") broadcasts.push(message); }, send: () => {} });
    core.join("host", "Host", "bomb");
    core.join("guest", "Guest", "bomb");
    const items = { [ItemKind.Bomb]: 9, [ItemKind.Heart]: 9, [ItemKind.BombPass]: 9, [ItemKind.BlockPass]: 9, [ItemKind.FireSuit]: 9, [ItemKind.Speed]: 9, [ItemKind.Fire]: 6 };
    core.message("host", C2S.rules, { battleMode: "maniac", maniac: { items, hitPoints: { host: 5, guest: 3 } } });
    expect(broadcasts.at(-1)).toMatchObject({ battleMode: "maniac", maniac: { items, hitPoints: { host: 5, guest: 3 } } });
    core.message("host", C2S.start);
    const match = core.session.match!;
    expect(match.players.map((player) => player.hitPoints)).toEqual([5, 3]);
    expect(match.items).toHaveLength(60);
    expect(match.grid.floor).toHaveLength(match.grid.width * match.grid.height);
    expect(core.session.stage).toBe("classic");
    expect(match.roundEndsAt).toBe(3 * 60 * 60);
    expect(match.revenge).toBe(true);
  });

  it("rejects malformed, guest and mid-round edits atomically", () => {
    const s = session();
    const before = s.lobbyInfo("X");
    for (const bad of [
      { battleMode: "champion" },
      { battleMode: "maniac", maniac: { items: { [ItemKind.Bomb]: 10 } } },
      { battleMode: "maniac", winsToWin: 1 },
      { battleMode: "maniac", timeMinutes: null },
      { battleMode: "maniac", suddenDeath: true },
      { maniac: { items: { [ItemKind.Remote]: 1 } } },
    ]) {
      expect(s.setRules("host", bad), JSON.stringify(bad)).toBe(false);
      expect(s.lobbyInfo("X")).toEqual(before);
    }
    expect(s.setRules("guest", { battleMode: "maniac" })).toBe(false);
    expect(s.setRules("host", { battleMode: "maniac" })).toBe(true);
    expect(s.start("host")).toBe(true);
    expect(s.setRules("host", { battleMode: "single" })).toBe(false);
  });

  it("forces three victories in Maniac, retains a Classic arena across rounds and restores Single settings", () => {
    const s = session();
    expect(s.setRules("host", { winsToWin: 2, timeMinutes: 5, suddenDeath: true, stageRotation: [{ stage: "warp" }] })).toBe(true);
    expect(s.setRules("host", { battleMode: "maniac" })).toBe(true);
    expect(s.start("host")).toBe(true);
    for (let round = 1; round <= 3; round++) {
      expect(s.stage).toBe("classic");
      for (const p of s.match!.players) if (p.id !== "host") p.alive = false;
      const result = s.tick().result!;
      expect(result.setOver).toBe(round === 3);
      for (let i = 0; i < RESULTS_TICKS; i++) s.tick();
      expect(s.phase).toBe(round === 3 ? "lobby" : "playing");
    }
    expect(s.setRules("host", { battleMode: "single" })).toBe(true);
    expect(s.lobbyInfo("X")).toMatchObject({
      battleMode: "single", winsToWin: 2, timeMinutes: 5, suddenDeath: true,
      stageRotation: [{ stage: "warp" }],
    });
  });
});
