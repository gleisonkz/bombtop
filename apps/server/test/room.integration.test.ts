import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { defineRoom, defineServer, type Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { Client } from "@colyseus/sdk";
import { C2S, ROOM_NAME, S2C, type LobbyInfo, type PublicView } from "@bombtop/shared";
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

describe("BattleRoom over the network", () => {
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
    expect(sb.grid.width).toBe(13);
    expect("rng" in sa).toBe(false);

    // Input travels to the simulation.
    const startX = sa.players[0]!.px;
    a.send(C2S.input, { dir: "right", bomb: false });
    const moved = await next<PublicView>(b, S2C.snapshot, (s) => s.players[0]!.px > startX);
    expect(moved.players[0]!.px).toBeGreaterThan(startX);

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

  it("sanitizes names", async () => {
    const r = await client().create(ROOM_NAME, { name: "  \u0000Zé  " });
    const pending = next<LobbyInfo>(r, S2C.lobby);
    r.send(C2S.sync);
    const lobby = await pending;
    expect(lobby.members[0]!.name).toBe("Zé");
    await r.leave();
  });

  it("takes the character picked on joining and lets the player change it", async () => {
    const r = await client().create(ROOM_NAME, { name: "N", character: "ninja" });
    const joined = next<LobbyInfo>(r, S2C.lobby);
    r.send(C2S.sync);
    expect((await joined).members[0]!.character).toBe("ninja");
    const changed = next<LobbyInfo>(r, S2C.lobby, (l) => l.members[0]!.character === "bomb");
    r.send(C2S.character, { character: "bomb" });
    await changed;
    await r.leave();
  });
});
