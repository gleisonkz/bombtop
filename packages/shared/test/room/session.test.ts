import { describe, expect, it } from "vitest";
import { FLAME_TICKS, MAX_PLAYERS, playerTile, TILE } from "../../src";
import { BattleSession, BOT_NAMES, BOT_PERSONAS, RESULTS_TICKS, WINS_TO_WIN } from "../../src";

function lobby(n: number) {
  const s = new BattleSession({ seed: () => 1, blockDensity: 0 });
  for (let i = 1; i <= n; i++) s.join(`c${i}`, `Player ${i}`);
  return s;
}

/** A lobby whose guests have all said they are ready. */
function readyLobby(n: number) {
  const s = lobby(n);
  for (let i = 2; i <= n; i++) s.setReady(`c${i}`, true);
  return s;
}

function playing(n = 2) {
  const s = readyLobby(n);
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
    const s = readyLobby(2);
    expect(s.start("c2")).toBe(false);
    expect(s.start("c1")).toBe(true);
    expect(s.phase).toBe("playing");
    expect(s.match!.players.map((p) => p.id)).toEqual(["c1", "c2"]);
  });

  it("waits for every human guest to be ready before the host can start", () => {
    const s = lobby(3);
    s.addBot("c1", "easy");
    expect(s.lobbyInfo("R").members.map((m) => m.ready ?? false)).toEqual([false, false, false, false]);
    expect(s.start("c1")).toBe(false);
    expect(s.setReady("c2", true)).toBe(true);
    expect(s.start("c1")).toBe(false);
    expect(s.setReady("c3", true)).toBe(true);
    expect(s.lobbyInfo("R").members.map((m) => m.ready ?? false)).toEqual([false, true, true, false]);
    s.setReady("c3", false);
    expect(s.start("c1")).toBe(false);
    s.setReady("c3", true);
    expect(s.start("c1")).toBe(true);
  });

  it("only guests in the lobby mark themselves ready, and a dropped guest does not hold the start", () => {
    const s = lobby(3);
    expect(s.setReady("c1", true)).toBe(false); // the host starts instead
    expect(s.setReady("nobody", true)).toBe(false);
    s.setReady("c2", true);
    s.setConnected("c3", false);
    expect(s.start("c1")).toBe(true);
    expect(s.setReady("c3", true)).toBe(false);
  });

  it("everyone is unready again when the match is over and the room is back in the lobby", () => {
    const s = lobby(2);
    s.setWinsToWin("c1", 1);
    s.setReady("c2", true);
    s.start("c1");
    const { x, y } = playerTile(s.match!.players[1]!);
    s.match!.revenge = false;
    s.match!.flames.push({ x, y, ttl: FLAME_TICKS });
    s.tick();
    for (let i = 0; i < RESULTS_TICKS; i++) s.tick();
    expect(s.phase).toBe("lobby");
    expect(s.members.find((m) => m.id === "c2")!.ready).toBeFalsy();
    expect(s.start("c1")).toBe(false);
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
      stageRotation: [{ stage: "classic" }, { stage: "conveyor" }, { stage: "warp" }],
      winsToWin: WINS_TO_WIN,
      timeMinutes: null,
      suddenDeath: true,
      battleMode: "single",
      maniac: { items: {}, hitPoints: { c1: 1, c2: 1 } },
      code: "ROOM1",
      members: [
        { id: "c1", name: "Player 1", wins: 0, connected: true, character: "bomb", ownColors: true },
        { id: "c2", name: "Player 2", wins: 0, connected: true, character: "bomb" },
      ],
    });
  });

  it("each player picks a character: the bomb unless chosen on joining, changeable in the lobby", () => {
    const s = lobby(1);
    s.join("c2", "Thor", "thor");
    s.setReady("c2", true);
    expect(s.members.map((m) => m.character)).toEqual(["bomb", "thor"]);
    expect(s.setCharacter("c1", "thor")).toBe(true);
    expect(s.members[0]!.character).toBe("thor");
    expect(s.setCharacter("nobody", "thor")).toBe(false);
    s.start("c1");
    expect(s.setCharacter("c1", "bomb")).toBe(false); // locked mid-match
  });

  it("plays each member as the character they picked", () => {
    const s = readyLobby(2);
    s.setCharacter("c2", "thor");
    s.start("c1");
    expect(s.match!.players.map((p) => p.character)).toEqual(["bomb", "thor"]);
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

  it("passes the fallback direction of a diagonal through", () => {
    const s = playing();
    const p = s.match!.players[0]!;
    const before = p.py;
    s.setInput("c1", { dir: "left", alt: "down", bomb: false }); // left of the spawn is the border wall
    s.tick();
    expect(p.py).toBe(before + p.speed);
  });

  it("acks the last applied input and how many ticks it has run", () => {
    const s = playing();
    s.setInput("c1", { dir: "right", bomb: false }, 7);
    let snap;
    for (let i = 0; i < 4; i++) snap = s.tick().snapshot ?? snap;
    expect(snap!.acks.c1).toEqual({ seq: 7, ticks: 4 });
    s.setInput("c1", { dir: null, bomb: false }, 8);
    s.tick();
    snap = s.tick().snapshot;
    expect(snap!.acks.c1).toEqual({ seq: 8, ticks: 2 });
  });

  it("a player who drops stops walking, and their numbering starts over when they come back", () => {
    const s = playing();
    const p = s.match!.players[0]!;
    for (let i = 0; i < 3; i++) s.tick();
    s.setInput("c1", { dir: "right", bomb: false }, 50, 0);
    for (let i = 0; i < 3; i++) s.tick();
    s.setConnected("c1", false); // the key's release never arrives
    s.tick();
    const stopped = p.px;
    s.tick();
    expect(p.px).toBe(stopped);
    s.setConnected("c1", true); // a reloaded page counts its inputs from 1 again
    s.setInput("c1", { dir: "left", bomb: false }, 1, 0);
    s.tick();
    s.setInput("c1", { dir: null, bomb: false }, 2, 1);
    for (let i = 0; i < 3; i++) s.tick();
    const back = p.px;
    s.tick();
    expect(p.px).toBe(back);
    expect(back).toBeLessThan(stopped); // the new page's inputs are heard
  });

  it("moves a player exactly as far as their client held the key, though messages take different times to arrive", () => {
    const s = playing();
    const p = s.match!.players[0]!;
    const before = p.px;
    for (let i = 0; i < 3; i++) s.tick();
    s.setInput("c1", { dir: "right", bomb: false }, 1, 0); // pressed on client tick 0, took 3 ticks to arrive
    for (let i = 0; i < 3; i++) s.tick();
    s.setInput("c1", { dir: null, bomb: false }, 2, 4); // released on client tick 4, took only 2
    for (let i = 0; i < 6; i++) s.tick();
    expect(p.px - before).toBeCloseTo(4 * p.speed);
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

  it("ends the round when one player is left, then the next round starts by itself", () => {
    const s = playing();
    const first = s.match;
    const { x, y } = playerTile(s.match!.players[1]!);
    s.match!.revenge = false;
    s.match!.flames.push({ x, y, ttl: FLAME_TICKS });
    const out = s.tick();
    expect(out.result).toEqual({ over: true, winnerId: "c1", setOver: false });
    expect(s.phase).toBe("results");
    for (let i = 0; i < RESULTS_TICKS; i++) s.tick();
    expect(s.phase).toBe("playing");
    expect(s.match).not.toBe(first);
    expect(s.match!.players.every((p) => p.alive)).toBe(true);
  });

  it("keeps score across rounds", () => {
    const s = playing();
    winRound(s, "c1");
    winRound(s, "c2");
    winRound(s, "c1");
    expect(s.members.map((m) => m.wins)).toEqual([2, 1]);
  });

  it(`whoever wins ${WINS_TO_WIN} rounds wins the match, and the room goes back to the lobby`, () => {
    const s = playing();
    for (let i = 1; i < WINS_TO_WIN; i++) expect(winRound(s, "c2")).toMatchObject({ setOver: false });
    expect(winRound(s, "c2")).toEqual({ over: true, winnerId: "c2", setOver: true });
    expect(s.phase).toBe("lobby");
    expect(s.match).toBeNull();
    expect(s.lobbyInfo("X").members.find((m) => m.id === "c2")!.wins).toBe(WINS_TO_WIN); // the final score stays up in the lobby
  });

  it("a draw scores nobody, and play goes on", () => {
    const s = playing();
    s.match!.revenge = false;
    for (const p of s.match!.players) p.alive = false;
    expect(s.tick().result).toEqual({ over: true, winnerId: null, setOver: false });
    for (let i = 0; i < RESULTS_TICKS; i++) s.tick();
    expect(s.phase).toBe("playing");
    expect(s.members.map((m) => m.wins)).toEqual([0, 0]);
  });

  it("a new match from the lobby starts the score from zero", () => {
    const s = playing();
    for (let i = 0; i < WINS_TO_WIN; i++) winRound(s, "c1");
    s.setReady("c2", true);
    s.start("c1");
    expect(s.members.map((m) => m.wins)).toEqual([0, 0]);
  });

  it("with fewer than two players left, the room goes back to the lobby instead of another round", () => {
    const s = playing(3);
    s.leave("c3");
    winRound(s, "c1");
    expect(s.phase).toBe("playing");
    s.leave("c2");
    s.tick(); // c1 is the last one standing
    for (let i = 0; i < RESULTS_TICKS; i++) s.tick();
    expect(s.phase).toBe("lobby");
  });
});

/** Everyone but `winner` drops dead; the round's result, after its results screen has run out. */
function winRound(s: BattleSession, winner: string) {
  s.match!.revenge = false;
  for (const p of s.match!.players) if (p.id !== winner) p.alive = false;
  const { result } = s.tick();
  for (let i = 0; i < RESULTS_TICKS; i++) s.tick();
  return result;
}

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
  it("the lobby announces the stage of the next match", () => {
    const s = readyLobby(2);
    expect(s.lobbyInfo("X").stage).toBe("classic");
    s.start("c1");
    expect(s.lobbyInfo("X").stage).toBe("classic");
    s.match!.players[1]!.alive = false;
    s.match!.revenge = false;
    s.tick();
    for (let i = 0; i < RESULTS_TICKS; i++) s.tick();
    expect(s.lobbyInfo("X").stage).toBe("conveyor");
  });

  it("rotate through classic, conveyor and warp in successive rounds", () => {
    const s = readyLobby(2);
    const stages: string[] = [];
    for (let r = 0; r < 4; r++) {
      s.start("c1");
      stages.push(s.stage);
      s.match!.players[1]!.alive = false;
      s.match!.revenge = false;
      s.tick();
      for (let i = 0; i < RESULTS_TICKS; i++) s.tick();
    }
    expect(stages).toEqual(["classic", "conveyor", "warp", "classic"]);
  });
});

describe("bots", () => {
  it("the host fills empty seats with bots of a chosen level", () => {
    const s = lobby(1);
    expect(s.addBot("c1", "hard")).toBe(true);
    expect(s.members[1]).toMatchObject({ bot: "hard", connected: true, wins: 0 });
    expect(s.members[1]!.name).not.toBe("");
    expect(s.addBot("c2", "easy")).toBe(false); // not the host
  });

  it("never adds past the player limit or mid-match", () => {
    const s = lobby(1);
    for (let i = 1; i < MAX_PLAYERS; i++) expect(s.addBot("c1", "easy")).toBe(true);
    expect(s.addBot("c1", "easy")).toBe(false);
    const p = playing(2);
    expect(p.addBot("c1", "easy")).toBe(false);
  });

  it("mixes characters among bots, which nobody can repick", () => {
    const s = lobby(1);
    s.addBot("c1", "easy");
    s.addBot("c1", "easy");
    expect(new Set(s.members.slice(1).map((m) => m.character)).size).toBe(2);
    expect(s.setCharacter(s.members[1]!.id, "bomb")).toBe(false);
  });

  it("gives the bots in a room different personalities", () => {
    const s = lobby(1);
    for (let i = 1; i < MAX_PLAYERS; i++) s.addBot("c1", "medium");
    const personas = s.members.slice(1).map((m) => m.persona);
    expect(personas.every((p) => p && BOT_PERSONAS.includes(p))).toBe(true);
    expect(new Set(personas).size).toBe(personas.length);
  });

  it("gives each bot its own name", () => {
    const s = lobby(1);
    for (let i = 1; i < MAX_PLAYERS; i++) s.addBot("c1", "medium");
    expect(new Set(s.members.map((m) => m.name)).size).toBe(MAX_PLAYERS);
  });

  it("names each bot after its character: Capitão something, a Norse name for thor, a Dragon Ball name for goku, a fuse word for the mascot", () => {
    const s = lobby(1);
    for (let i = 1; i < MAX_PLAYERS; i++) s.addBot("c1", "easy");
    for (const m of s.members.slice(1)) {
      if (m.character === "captain") expect(m.name).toMatch(/^Capitão \S/);
      if (m.character === "thor") expect(BOT_NAMES.thor).toContain(m.name);
      if (m.character === "goku") expect(BOT_NAMES.goku).toContain(m.name);
      if (m.character === "bomb") expect(BOT_NAMES.bomb).toContain(m.name);
    }
    expect(new Set(s.members.slice(1).map((m) => m.character)).size).toBe(4);
  });

  it("a bot plays a character drawn at random, none already in the room", () => {
    const first = (r: number) => {
      const s = new BattleSession({ seed: () => 1, random: () => r });
      s.join("c1", "P1", "bomb");
      s.addBot("c1", "easy");
      return s.members[1]!.character;
    };
    expect(first(0)).not.toBe("bomb");
    expect(first(0)).not.toBe(first(0.99));
    const s = new BattleSession({ seed: () => 1, random: () => 0.5 });
    s.join("c1", "P1");
    for (let i = 1; i < MAX_PLAYERS; i++) s.addBot("c1", "easy");
    expect(new Set(s.members.map((m) => m.character)).size).toBe(MAX_PLAYERS);
  });

  it("picks the bot names at random", () => {
    const names = (r: number) => {
      const s = new BattleSession({ seed: () => 1, random: () => r });
      s.join("c1", "P1");
      s.addBot("c1", "easy");
      return s.members[1]!.name;
    };
    expect(names(0)).not.toBe(names(0.99));
  });

  it("the host can take a bot out, but not a person", () => {
    const s = lobby(2);
    s.addBot("c1", "easy");
    const bot = s.members[2]!.id;
    expect(s.removeBot("c2", bot)).toBe(false);
    expect(s.removeBot("c1", "c2")).toBe(false);
    expect(s.removeBot("c1", bot)).toBe(true);
    expect(s.members).toHaveLength(2);
  });

  it("the host changes a bot's character in the lobby, and the bot takes a name of its new character", () => {
    const s = readyLobby(2);
    s.addBot("c1", "easy");
    const bot = s.members[2]!;
    const persona = bot.persona;
    expect(s.setBotCharacter("c1", bot.id, "naruto")).toBe(true);
    expect(bot.character).toBe("naruto");
    expect(BOT_NAMES.naruto).toContain(bot.name);
    expect(bot.persona).toBe(persona);
    expect(s.setBotCharacter("c2", bot.id, "thor")).toBe(false); // not the host
    expect(s.setBotCharacter("c1", "c2", "thor")).toBe(false); // not a bot
    expect(s.setBotCharacter("c1", "nobody", "thor")).toBe(false);
    s.start("c1");
    expect(s.setBotCharacter("c1", bot.id, "thor")).toBe(false); // locked mid-match
  });

  it("one person and a bot are enough to start", () => {
    const s = lobby(1);
    s.addBot("c1", "medium");
    expect(s.start("c1")).toBe(true);
    expect(s.match!.players).toHaveLength(2);
  });

  it("bots never host", () => {
    const s = lobby(1);
    s.addBot("c1", "easy");
    s.join("c2", "Late");
    s.leave("c1");
    expect(s.hostId).toBe("c2");
    s.leave("c2");
    expect(s.hostId).toBeUndefined();
  });

  it("bots play on their own once the match starts", () => {
    const s = lobby(1);
    s.addBot("c1", "hard");
    s.start("c1");
    const bot = s.match!.players[1]!;
    const start = { px: bot.px, py: bot.py };
    for (let i = 0; i < 120 && s.phase === "playing"; i++) s.tick();
    const moved = bot.px !== start.px || bot.py !== start.py || s.match!.bombs.some((b) => b.ownerId === bot.id);
    expect(moved).toBe(true);
  });

  it("ignores input sent in a bot's name", () => {
    const s = lobby(1);
    s.addBot("c1", "easy");
    s.start("c1");
    const bot = s.members[1]!.id;
    s.setInput(bot, { dir: "down", bomb: true });
    s.tick();
    expect(s.match!.bombs.filter((b) => b.ownerId === bot)).toHaveLength(0);
  });
});
