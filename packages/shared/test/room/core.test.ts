import { describe, expect, it } from "vitest";
import { C2S, MAX_WATCHERS, RoomCore, S2C, type LobbyInfo, type RoomPhase } from "../../src";

/** A room whose messages land in lists instead of a network. */
function room() {
  const sent: { to: string; type: string; message?: unknown }[] = [];
  const broadcast: { type: string; message?: unknown }[] = [];
  const phases: RoomPhase[] = [];
  const seats: boolean[] = [];
  const core = new RoomCore("CODE", {
    send: (to, type, message) => sent.push({ to, type, message }),
    broadcast: (type, message) => broadcast.push({ type, message }),
    phaseChanged: (p) => phases.push(p),
    seatsChanged: (full) => seats.push(full),
  });
  const lastLobby = () => broadcast.filter((b) => b.type === S2C.lobby).at(-1)?.message as LobbyInfo;
  return { core, sent, broadcast, phases, seats, lastLobby };
}

describe("RoomCore", () => {
  it("seats whoever joins and tells everyone", () => {
    const r = room();
    expect(r.core.join("a", "Ana", "ninja")).toBe(true);
    expect(r.lastLobby().members.map((m) => [m.name, m.character])).toEqual([["Ana", "ninja"]]);
    expect(r.lastLobby().code).toBe("CODE");
  });

  it("a screen can watch without a seat: it gets the lobby and the match, and is counted", () => {
    const r = room();
    r.core.join("a", "Ana", "bomb");
    expect(r.core.watch("tv")).toBe(true);
    expect(r.lastLobby().members.map((m) => m.id)).toEqual(["a"]);
    expect(r.lastLobby().watchers).toBe(1);
    r.core.message("tv", C2S.sync);
    expect(r.sent.filter((s) => s.to === "tv").map((s) => s.type)).toEqual([S2C.lobby]);
  });

  it("a watcher cannot play: its inputs, bots, characters and starts are ignored", () => {
    const r = room();
    r.core.join("a", "Ana", "bomb");
    r.core.watch("tv");
    r.core.message("tv", C2S.addBot, { level: "easy" });
    r.core.message("tv", C2S.character, { character: "ninja" });
    r.core.message("tv", C2S.start);
    expect(r.lastLobby().members).toHaveLength(1);
    expect(r.lastLobby().phase).toBe("lobby");
  });

  it(`watches mid-match too, up to ${MAX_WATCHERS} screens, and leaving frees the spot`, () => {
    const r = room();
    r.core.join("a", "Ana", "bomb");
    r.core.message("a", C2S.addBot, { level: "easy" });
    r.core.message("a", C2S.start);
    for (let i = 0; i < MAX_WATCHERS; i++) expect(r.core.watch(`tv${i}`)).toBe(true);
    expect(r.core.watch("one-too-many")).toBe(false);
    r.core.leave("tv0");
    expect(r.lastLobby().watchers).toBe(MAX_WATCHERS - 1);
    expect(r.core.watch("tv-again")).toBe(true);
    expect(r.lastLobby().members).toHaveLength(2);
  });

  it("answers a sync with the lobby, to that client only", () => {
    const r = room();
    r.core.join("a", "Ana", "bomb");
    r.core.message("a", C2S.sync);
    expect(r.sent.map((s) => [s.to, s.type])).toEqual([["a", S2C.lobby]]);
  });

  it("takes a beat (a phone keeping its Wi-Fi awake) without doing or answering anything", () => {
    const r = room();
    r.core.join("a", "Ana", "bomb");
    const before = r.broadcast.length;
    r.core.message("a", C2S.beat);
    expect(r.sent).toEqual([]);
    expect(r.broadcast).toHaveLength(before);
  });

  it("runs the lobby messages: bots, characters, start", () => {
    const r = room();
    r.core.join("a", "Ana", "bomb");
    r.core.message("a", C2S.addBot, { level: "easy" });
    r.core.message("a", C2S.character, { character: "captain" });
    expect(r.lastLobby().members).toHaveLength(2);
    expect(r.lastLobby().members[0]!.character).toBe("captain");
    r.core.message("a", C2S.start);
    expect(r.phases).toEqual(["playing"]);
    expect(r.lastLobby().phase).toBe("playing");
  });

  it("broadcasts the match as a whole snapshot, then differences", () => {
    const r = room();
    r.core.join("a", "Ana", "bomb");
    r.core.message("a", C2S.addBot, { level: "easy" });
    r.core.message("a", C2S.start);
    for (let i = 0; i < 6; i++) r.core.update();
    const types = r.broadcast.map((b) => b.type).filter((t) => t !== S2C.lobby);
    expect(types[0]).toBe(S2C.snapshot);
    expect(types.slice(1)).toContain(S2C.delta);
  });

  it("a sync mid-match also gets the last snapshot, the base for the next difference", () => {
    const r = room();
    r.core.join("a", "Ana", "bomb");
    r.core.join("b", "Bia", "bomb");
    r.core.message("a", C2S.start);
    for (let i = 0; i < 4; i++) r.core.update();
    r.core.message("b", C2S.sync);
    expect(r.sent.filter((s) => s.to === "b").map((s) => s.type)).toEqual([S2C.lobby, S2C.snapshot]);
  });

  it("reports when bots fill the room, and when a seat frees up", () => {
    const r = room();
    r.core.join("a", "Ana", "bomb");
    for (let i = 0; i < 4; i++) r.core.message("a", C2S.addBot, { level: "easy" });
    expect(r.seats.at(-1)).toBe(true);
    const bot = r.lastLobby().members[1]!.id;
    r.core.message("a", C2S.removeBot, { id: bot });
    expect(r.seats.at(-1)).toBe(false);
  });

  it("the host changes a bot's character and everyone sees it; junk is ignored", () => {
    const r = room();
    r.core.join("a", "Ana", "bomb");
    r.core.message("a", C2S.addBot, { level: "easy" });
    const bot = r.lastLobby().members[1]!.id;
    r.core.message("a", C2S.botCharacter, { id: bot, character: "goku" });
    expect(r.lastLobby().members[1]!.character).toBe("goku");
    const before = r.broadcast.length;
    r.core.message("a", C2S.botCharacter, { id: bot, character: "godzilla" });
    r.core.message("a", C2S.botCharacter, { id: 7, character: "thor" });
    r.core.message("a", C2S.botCharacter, null);
    expect(r.broadcast.length).toBe(before);
  });

  it("ignores junk", () => {
    const r = room();
    r.core.join("a", "Ana", "bomb");
    const before = r.broadcast.length;
    r.core.message("a", C2S.addBot, { level: "godlike" });
    r.core.message("a", C2S.character, "x");
    r.core.message("a", "nope", 1);
    r.core.message("zz", C2S.start);
    expect(r.broadcast.length).toBe(before);
  });

  it("a dropped player shows as reconnecting, and leaving frees the seat", () => {
    const r = room();
    r.core.join("a", "Ana", "bomb");
    r.core.join("b", "Bia", "bomb");
    r.core.setConnected("b", false);
    expect(r.lastLobby().members[1]!.connected).toBe(false);
    r.core.leave("b");
    expect(r.lastLobby().members).toHaveLength(1);
  });
});
