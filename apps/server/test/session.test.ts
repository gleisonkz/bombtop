import { describe, expect, it } from "vitest";
import { FLAME_TICKS, MAX_PLAYERS, playerTile, TILE } from "@bombtopia/shared";
import { BattleSession, RESULTS_TICKS } from "../src/session";

function lobby(n: number) {
  const s = new BattleSession({ seed: () => 1, blockDensity: 0 });
  for (let i = 1; i <= n; i++) s.join(`c${i}`, `Player ${i}`);
  return s;
}

function playing(n = 2) {
  const s = lobby(n);
  s.start("c1");
  return s;
}

describe("lobby", () => {
  it("the first player to join hosts", () => {
    const s = lobby(2);
    expect(s.hostId).toBe("c1");
    expect(s.members.map((m) => m.name)).toEqual(["Player 1", "Player 2"]);
  });

  it(`holds at most ${MAX_PLAYERS} players`, () => {
    const s = lobby(MAX_PLAYERS);
    expect(s.join("extra", "X")).toBe(false);
    expect(s.members).toHaveLength(MAX_PLAYERS);
  });

  it("passes host to the next member when the host leaves", () => {
    const s = lobby(3);
    s.leave("c1");
    expect(s.hostId).toBe("c2");
  });

  it("only the host can start, and only with 2+ players", () => {
    expect(lobby(1).start("c1")).toBe(false);
    const s = lobby(2);
    expect(s.start("c2")).toBe(false);
    expect(s.start("c1")).toBe(true);
    expect(s.phase).toBe("playing");
    expect(s.match!.players.map((p) => p.id)).toEqual(["c1", "c2"]);
  });

  it("tracks temporarily disconnected members", () => {
    const s = lobby(2);
    expect(s.members[1]!.connected).toBe(true);
    s.setConnected("c2", false);
    expect(s.members[1]!.connected).toBe(false);
    s.setConnected("c2", true);
    expect(s.members[1]!.connected).toBe(true);
  });

  it("describes itself for the lobby screen", () => {
    const s = lobby(2);
    expect(s.lobbyInfo("ROOM1")).toEqual({
      phase: "lobby",
      hostId: "c1",
      stage: "classic",
      code: "ROOM1",
      members: [
        { id: "c1", name: "Player 1", wins: 0, connected: true },
        { id: "c2", name: "Player 2", wins: 0, connected: true },
      ],
    });
  });

  it("rejects joins during a match", () => {
    const s = playing();
    expect(s.join("late", "Late")).toBe(false);
  });
});

describe("playing", () => {
  it("applies each player's held direction every tick", () => {
    const s = playing();
    const before = s.match!.players[0]!.px;
    s.setInput("c1", { dir: "right", bomb: false });
    s.tick();
    s.tick();
    expect(s.match!.players[0]!.px).toBe(before + 2 * s.match!.players[0]!.speed);
  });

  it("does not lose a button press released before the tick", () => {
    const s = playing();
    s.setInput("c1", { dir: null, bomb: true });
    s.setInput("c1", { dir: null, bomb: false });
    s.tick();
    expect(s.match!.bombs).toHaveLength(1);
  });

  it("fires a button once, not on every tick", () => {
    const s = playing();
    s.match!.players[0]!.bombCapacity = 3;
    s.setInput("c1", { dir: null, bomb: true });
    s.tick();
    s.match!.players[0]!.px += TILE; // move to another tile
    s.tick();
    expect(s.match!.bombs).toHaveLength(1);
  });

  it("ignores input from unknown clients", () => {
    const s = playing();
    s.setInput("ghost", { dir: "right", bomb: true });
    s.tick();
    expect(s.match!.bombs).toHaveLength(0);
  });

  it("a player who leaves mid-match is eliminated", () => {
    const s = playing(3);
    s.leave("c2");
    expect(s.match!.players[1]!.alive).toBe(false);
  });

  it("ends the round when one player is left, then returns to the lobby", () => {
    const s = playing();
    const { x, y } = playerTile(s.match!.players[1]!);
    s.match!.revenge = false;
    s.match!.flames.push({ x, y, ttl: FLAME_TICKS });
    const out = s.tick();
    expect(out.result).toEqual({ over: true, winnerId: "c1" });
    expect(s.phase).toBe("results");
    for (let i = 0; i < RESULTS_TICKS; i++) s.tick();
    expect(s.phase).toBe("lobby");
    expect(s.match).toBeNull();
  });

  it("keeps score across rounds", () => {
    const s = playing();
    s.match!.revenge = false;
    s.match!.players[1]!.alive = false;
    s.tick();
    expect(s.members.find((m) => m.id === "c1")!.wins).toBe(1);
  });
});

describe("snapshots", () => {
  it("are emitted every other tick while playing", () => {
    const s = playing();
    const emitted = [s.tick(), s.tick(), s.tick(), s.tick()].filter((o) => o.snapshot);
    expect(emitted).toHaveLength(2);
  });

  it("never include the PRNG state", () => {
    const s = playing();
    s.tick();
    const snap = s.tick().snapshot!;
    expect("rng" in snap).toBe(false);
  });

  it("are not emitted in the lobby", () => {
    expect(lobby(2).tick().snapshot).toBeUndefined();
  });
});

describe("stages", () => {
  it("rotate between rounds", () => {
    const s = lobby(2);
    const stages: string[] = [];
    for (let r = 0; r < 3; r++) {
      s.start("c1");
      stages.push(s.stage);
      s.match!.players[1]!.alive = false;
      s.match!.revenge = false;
      s.tick();
      for (let i = 0; i < RESULTS_TICKS; i++) s.tick();
    }
    expect(new Set(stages).size).toBe(3);
  });
});
