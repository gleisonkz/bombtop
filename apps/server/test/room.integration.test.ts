import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { defineRoom, defineServer, type Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { Client, type Room } from "@colyseus/sdk";
import { C2S, DeltaReceiver, ROOM_NAME, S2C, type LobbyInfo, type Patch, type PublicView } from "@bombtop/shared";
import { BattleRoom } from "../src/room";

const PORT = 25670 + Math.floor(Math.random() * 1000);
let server: Server;

beforeAll(async () => {
  server = defineServer({
    transport: new WebSocketTransport(),
    greet: false,
    rooms: { [ROOM_NAME]: defineRoom(BattleRoom) },
  });
  await server.listen(PORT);
});

afterAll(async () => {
  await server.gracefullyShutdown(false);
});

const client = () => new Client(`http://localhost:${PORT}`);

/** Resolves with the first message of `type` matching `pred`. */
function next<T>(room: { onMessage: (t: string, cb: (m: T) => void) => () => void }, type: string, pred: (m: T) => boolean = () => true) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${type}`)), 4000);
    const off = room.onMessage(type, (m: T) => {
      if (!pred(m)) return;
      clearTimeout(timer);
      off();
      resolve(m);
    });
  });
}

/** Resolves with the first view, rebuilt from whole snapshots and differences, matching `pred`; counts the differences. */
function view(room: Room, base: PublicView, pred: (v: PublicView) => boolean) {
  const r = new DeltaReceiver<PublicView>();
  r.full(base);
  let deltas = 0;
  return new Promise<{ view: PublicView; deltas: number }>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout waiting for a view")), 4000);
    const check = (v: PublicView | null) => {
      if (!v || !pred(v)) return;
      clearTimeout(timer);
      offFull();
      offDelta();
      resolve({ view: v, deltas });
    };
    const offFull = room.onMessage(S2C.snapshot, (s: PublicView) => check(r.full(s)));
    const offDelta = room.onMessage(S2C.delta, (p: Patch) => {
      deltas++;
      check(r.delta(p));
    });
  });
}

describe("BattleRoom over the network", () => {
  it("synchronizes TAG teams and only starts while both teams have a player", async () => {
    const host = await client().create(ROOM_NAME, { private: true, name: "Host" });
    const guest = await client().joinById(host.roomId, { name: "Guest" });
    const chosen = next<LobbyInfo>(guest, S2C.lobby, lobby => lobby.battleMode === "tag");
    host.send(C2S.rules, { battleMode: "tag", winsToWin: 2 });
    const first = await chosen.catch(() => { throw new Error("TAG mode not broadcast"); });
    expect(first.members.map(member => member.team)).toEqual(["red", "blue"]);
    const bothBlue = next<LobbyInfo>(guest, S2C.lobby, lobby => lobby.members.every(member => member.team === "blue"));
    host.send(C2S.team, { id: host.sessionId, team: "blue" });
    expect((await bothBlue.catch(() => { throw new Error("TAG same-team change not broadcast"); })).members).toHaveLength(2);
    host.send(C2S.start);
    const blocked = next<LobbyInfo>(host, S2C.lobby);
    host.send(C2S.sync);
    expect((await blocked.catch(() => { throw new Error("TAG blocked start lobby sync timed out"); })).phase).toBe("lobby");
    const separated = next<LobbyInfo>(host, S2C.lobby, lobby => lobby.members[1]?.team === "red");
    guest.send(C2S.team, { id: guest.sessionId, team: "red" });
    expect((await separated.catch(() => { throw new Error("TAG guest team change not broadcast"); })).members.map(member => member.team)).toEqual(["blue", "red"]);
    const playing = next<LobbyInfo>(guest, S2C.lobby, lobby => lobby.phase === "playing");
    host.send(C2S.start);
    expect((await playing.catch(() => { throw new Error("TAG game did not start after team change"); })).battleMode).toBe("tag");
    await Promise.all([host.leave(), guest.leave()]);
  });

  it("shares Maniac item/HP settings and fixed rules over Colyseus", async () => {
    const host = await client().create(ROOM_NAME, { private: true, name: "Host" });
    const guest = await client().joinById(host.roomId, { name: "Guest" });
    const chosen = next<LobbyInfo>(guest, S2C.lobby, (l) => l.battleMode === "maniac");
    host.send(C2S.rules, { battleMode: "maniac", maniac: { items: { heart: 2 }, hitPoints: { [host.sessionId]: 5, [guest.sessionId]: 2 } } });
    expect(await chosen).toMatchObject({ battleMode: "maniac", winsToWin: 3, timeMinutes: 3, suddenDeath: false,
      maniac: { items: { heart: 2 }, hitPoints: { [host.sessionId]: 5, [guest.sessionId]: 2 } } });
    const started = next<LobbyInfo>(host, S2C.lobby, (l) => l.phase === "playing");
    host.send(C2S.start);
    expect((await started).battleMode).toBe("maniac");
    await Promise.all([host.leave(), guest.leave()]);
  });
  it("broadcasts host-only Battle Mode victories and time through Colyseus", async () => {
    const host = await client().create(ROOM_NAME, { private: true, name: "Host" });
    const guest = await client().joinById(host.roomId, { name: "Guest" });
    const chosen = next<LobbyInfo>(guest, S2C.lobby, (l) => l.winsToWin === 2 && l.timeMinutes === 2 && l.suddenDeath === false);
    host.send(C2S.rules, { winsToWin: 2, timeMinutes: 2, suddenDeath: false });
    expect(await chosen).toMatchObject({ winsToWin: 2, timeMinutes: 2, suddenDeath: false });
    guest.send(C2S.rules, { winsToWin: 1, timeMinutes: 1, suddenDeath: true });
    const current = next<LobbyInfo>(host, S2C.lobby);
    host.send(C2S.sync);
    expect(await current).toMatchObject({ winsToWin: 2, timeMinutes: 2, suddenDeath: false });
    await Promise.all([host.leave(), guest.leave()]);
  });
  it("two players join a public room, the host starts, both receive snapshots", async () => {
    const a = await client().joinOrCreate(ROOM_NAME, { name: "Ana" });
    const lobbyWithTwo = next<LobbyInfo>(a, S2C.lobby, (l) => l.members.length === 2);
    const b = await client().joinOrCreate(ROOM_NAME, { name: "Bia" });
    expect(b.roomId).toBe(a.roomId);

    const lobby = await lobbyWithTwo;
    expect(lobby.members.map((m) => m.name)).toEqual(["Ana", "Bia"]);
    expect(lobby.hostId).toBe(a.sessionId);

    const snapA = next<PublicView>(a, S2C.snapshot);
    const snapB = next<PublicView>(b, S2C.snapshot);
    a.send(C2S.start);
    const [sa, sb] = await Promise.all([snapA, snapB]);
    expect(sa.players.map((p) => p.id)).toEqual([a.sessionId, b.sessionId]);
    expect(sb.grid.width).toBe(15);
    expect("rng" in sa).toBe(false);

    // Input travels to the simulation.
    const startX = sa.players[0]!.px;
    // Input travels to the simulation; the move arrives as small differences, not whole snapshots.
    const moved = view(b, sb, (v) => v.players[0]!.px > startX);
    a.send(C2S.input, { dir: "right", bomb: false });
    const { view: seen, deltas } = await moved;
    expect(seen.players[0]!.px).toBeGreaterThan(startX);
    expect(deltas).toBeGreaterThan(0);

    await a.leave();
    await b.leave();
  });

  it("private rooms are joinable by code but not matched publicly", async () => {
    const host = await client().create(ROOM_NAME, { private: true, name: "Host" });
    const lobby = next<LobbyInfo>(host, S2C.lobby);
    host.send(C2S.sync);
    const code = (await lobby).code;
    expect(code).toBe(host.roomId);

    const friend = await client().joinById(code, { name: "Amigo" });
    expect(friend.roomId).toBe(host.roomId);

    const stranger = await client().joinOrCreate(ROOM_NAME, { name: "Estranho" });
    expect(stranger.roomId).not.toBe(host.roomId);

    await Promise.all([host.leave(), friend.leave(), stranger.leave()]);
  });

  it("sync replays the current match to a client that just attached its handlers", async () => {
    const a = await client().joinOrCreate(ROOM_NAME, { name: "A" });
    const b = await client().joinOrCreate(ROOM_NAME, { name: "B" });
    const started = next<LobbyInfo>(a, S2C.lobby, (l) => l.phase === "playing");
    a.send(C2S.start);
    await started;

    const lobby = next<LobbyInfo>(b, S2C.lobby, (l) => l.phase === "playing");
    const snap = next<PublicView>(b, S2C.snapshot);
    b.send(C2S.sync);
    await Promise.all([lobby, snap]);
    await Promise.all([a.leave(), b.leave()]);
  });

  it("a TV joins by code mid-match to watch: it gets the match without taking a seat", async () => {
    const a = await client().create(ROOM_NAME, { private: true, name: "Ana" });
    const b = await client().joinById(a.roomId, { name: "Bia" });
    const started = next<LobbyInfo>(a, S2C.lobby, (l) => l.phase === "playing");
    a.send(C2S.start);
    await started;

    const tv = await client().joinById(a.roomId, { watch: true });
    const lobby = next<LobbyInfo>(tv, S2C.lobby, (l) => l.phase === "playing");
    const snap = next<PublicView>(tv, S2C.snapshot);
    tv.send(C2S.sync);
    const [l, s] = await Promise.all([lobby, snap]);
    expect(l.members.map((m) => m.name)).toEqual(["Ana", "Bia"]);
    expect(l.watchers).toBe(1);
    expect(s.players).toHaveLength(2);

    // It cannot play.
    tv.send(C2S.input, { dir: "left", bomb: true, seq: 1 });
    await expect(client().joinById(a.roomId, { name: "Late" })).rejects.toThrow();
    await Promise.all([a.leave(), b.leave(), tv.leave()]);
  });

  it("a public room in a match is not matched to new players, but stays joinable by code to watch", async () => {
    const a = await client().joinOrCreate(ROOM_NAME, { name: "A" });
    const b = await client().joinOrCreate(ROOM_NAME, { name: "B" });
    expect(b.roomId).toBe(a.roomId);
    const started = next<LobbyInfo>(a, S2C.lobby, (l) => l.phase === "playing");
    a.send(C2S.start);
    await started;
    const c = await client().joinOrCreate(ROOM_NAME, { name: "C" });
    expect(c.roomId).not.toBe(a.roomId);
    const tv = await client().joinById(a.roomId, { watch: true });
    expect(tv.roomId).toBe(a.roomId);
    await Promise.all([a.leave(), b.leave(), c.leave(), tv.leave()]);
  });

  it("sanitizes names", async () => {
    const r = await client().create(ROOM_NAME, { name: "  \u0000Zé  " });
    const pending = next<LobbyInfo>(r, S2C.lobby);
    r.send(C2S.sync);
    const lobby = await pending;
    expect(lobby.members[0]!.name).toBe("Zé");
    await r.leave();
  });

  it("takes the character picked on joining and lets the player change it", async () => {
    const r = await client().create(ROOM_NAME, { name: "N", character: "thor" });
    const joined = next<LobbyInfo>(r, S2C.lobby);
    r.send(C2S.sync);
    expect((await joined).members[0]!.character).toBe("thor");
    const changed = next<LobbyInfo>(r, S2C.lobby, (l) => l.members[0]!.character === "bomb");
    r.send(C2S.character, { character: "bomb" });
    await changed;
    await r.leave();
  });
});
