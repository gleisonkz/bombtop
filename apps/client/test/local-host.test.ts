import { describe, expect, it } from "vitest";
import { C2S, S2C, type LobbyInfo } from "@bombtop/shared";
import { LocalHost, PeerLink, type Wire } from "../src/net/local-host";

/** Two connected in-memory wires (what a WebRTC data channel pair does). */
function wires(): [Wire & { cut(): void }, Wire] {
  const make = () => {
    let onMessage: (d: string) => void = () => {};
    let onClose: () => void = () => {};
    return {
      send: (d: string) => void 0 as unknown as void,
      onMessage: (cb: (d: string) => void) => void (onMessage = cb),
      onClose: (cb: () => void) => void (onClose = cb),
      close: () => {},
      deliver: (d: string) => onMessage(d),
      closed: () => onClose(),
    };
  };
  const a = make();
  const b = make();
  a.send = (d) => queueMicrotask(() => b.deliver(d));
  b.send = (d) => queueMicrotask(() => a.deliver(d));
  const cut = () => {
    a.closed();
    b.closed();
  };
  a.close = cut;
  b.close = cut;
  return [Object.assign(a, { cut }), b];
}

const flush = () => new Promise((r) => setTimeout(r, 0));

/** Collects a link's messages of one type. */
function inbox<T>(link: { onMessage(type: string, cb: (m: T) => void): void }, type: string): T[] {
  const got: T[] = [];
  link.onMessage(type, (m) => got.push(m));
  return got;
}

describe("LocalHost", () => {
  it("the host plays through a link of its own", async () => {
    const host = new LocalHost();
    const me = host.hostLink("Ana", "thor");
    const lobbies = inbox<LobbyInfo>(me, S2C.lobby);
    me.send(C2S.sync);
    await flush();
    expect(lobbies.at(-1)!.members.map((m) => [m.id, m.name, m.character])).toEqual([[me.sessionId, "Ana", "thor"]]);
    expect(lobbies.at(-1)!.hostId).toBe(me.sessionId);
  });

  it("seats more players on the same screen (one per controller), who play and leave on their own", async () => {
    const host = new LocalHost();
    const me = host.hostLink("Ana", "bomb");
    const pad = host.seat("Controle 2", "thor")!;
    const lobbies = inbox<LobbyInfo>(me, S2C.lobby);
    me.send(C2S.sync);
    await flush();
    expect(lobbies.at(-1)!.members.map((m) => [m.name, m.character])).toEqual([["Ana", "bomb"], ["Controle 2", "thor"]]);
    me.send(C2S.start);
    await flush();
    pad.send(C2S.input, { dir: "left", bomb: false, seq: 1 });
    await flush();
    const start = host.core.session.match!.players.find((p) => p.id === pad.sessionId)!.px;
    for (let i = 0; i < 20; i++) host.tick();
    expect(host.core.session.match!.players.find((p) => p.id === pad.sessionId)!.px).toBeLessThan(start);
    await pad.leave();
    await flush();
    expect(lobbies.at(-1)!.members.map((m) => m.name)).toEqual(["Ana"]);
  });

  it("does not seat a controller when the room is full", () => {
    const host = new LocalHost();
    host.hostLink("Ana", "bomb");
    const seats = [2, 3, 4, 5, 6].map((n) => host.seat(`Controle ${n}`, "bomb"));
    expect(seats.slice(0, 4).every(Boolean)).toBe(true);
    expect(seats[4]).toBeNull();
  });

  it("a friend joins over a wire and both see the same lobby", async () => {
    const host = new LocalHost();
    const me = host.hostLink("Ana", "bomb");
    const [hostEnd, guestEnd] = wires();
    host.addPeer(hostEnd);
    const friend = await PeerLink.join(guestEnd, "Bia", "captain");
    const hostSees = inbox<LobbyInfo>(me, S2C.lobby);
    const friendSees = inbox<LobbyInfo>(friend, S2C.lobby);
    friend.send(C2S.sync);
    me.send(C2S.sync);
    await flush();
    expect(friend.sessionId).not.toBe(me.sessionId);
    expect(friendSees.at(-1)!.members.map((m) => m.name)).toEqual(["Ana", "Bia"]);
    expect(hostSees.at(-1)!.members.map((m) => m.name)).toEqual(["Ana", "Bia"]);
  });

  it("shares the host's Battle Mode win target and time limit with an offline Wi-Fi guest", async () => {
    const host = new LocalHost();
    const me = host.hostLink("Ana", "bomb");
    const [hostEnd, guestEnd] = wires();
    host.addPeer(hostEnd);
    const friend = await PeerLink.join(guestEnd, "Bia", "bomb");
    const guestLobbies = inbox<LobbyInfo>(friend, S2C.lobby);
    me.send(C2S.rules, { winsToWin: 3, timeMinutes: 2, suddenDeath: false });
    await flush();
    expect(guestLobbies.at(-1)!.winsToWin).toBe(3);
    expect(guestLobbies.at(-1)!.timeMinutes).toBe(2);
    expect(guestLobbies.at(-1)!.suddenDeath).toBe(false);
    friend.send(C2S.rules, { winsToWin: 1, timeMinutes: 1, suddenDeath: true });
    await flush();
    expect(host.core.session.lobbyInfo("X").winsToWin).toBe(3);
    expect(host.core.session.lobbyInfo("X").timeMinutes).toBe(2);
    expect(host.core.session.lobbyInfo("X").suddenDeath).toBe(false);
    await me.leave();
  });

  it("transmits Maniac inventory, health and forced rules over the offline Wi-Fi wire", async () => {
    const host = new LocalHost();
    const me = host.hostLink("Ana", "bomb");
    const [hostEnd, guestEnd] = wires();
    host.addPeer(hostEnd);
    const friend = await PeerLink.join(guestEnd, "Bia", "bomb");
    const guestLobbies = inbox<LobbyInfo>(friend, S2C.lobby);
    me.send(C2S.rules, { battleMode: "maniac", maniac: {
      items: { heart: 3, bombPass: 2 }, hitPoints: { [me.sessionId]: 4, [friend.sessionId]: 3 },
    } });
    await flush();
    expect(guestLobbies.at(-1)).toMatchObject({
      battleMode: "maniac", stage: "classic", winsToWin: 3, timeMinutes: 3, suddenDeath: false,
      maniac: { items: { heart: 3, bombPass: 2 }, hitPoints: { [me.sessionId]: 4, [friend.sessionId]: 3 } },
    });
    friend.send(C2S.rules, { battleMode: "single" });
    await flush();
    expect(host.core.session.lobbyInfo("X").battleMode).toBe("maniac");
    me.send(C2S.start);
    await flush();
    expect(host.core.session.match!.items).toHaveLength(5);
    expect(host.core.session.match!.players.map((p) => p.hitPoints)).toEqual([4, 3]);
    await me.leave();
  });

  it("runs the match: the friend gets snapshots and steers its own player", async () => {
    const host = new LocalHost();
    const me = host.hostLink("Ana", "bomb");
    const [hostEnd, guestEnd] = wires();
    host.addPeer(hostEnd);
    const friend = await PeerLink.join(guestEnd, "Bia", "bomb");
    const snaps = inbox(friend, S2C.snapshot);
    me.send(C2S.start);
    await flush();
    friend.send(C2S.input, { dir: "left", bomb: false, seq: 1 });
    await flush();
    const start = host.core.session.match!.players.find((p) => p.id === friend.sessionId)!.px;
    for (let i = 0; i < 20; i++) host.tick();
    await flush();
    expect(snaps.length).toBeGreaterThan(0);
    expect(host.core.session.match!.players.find((p) => p.id === friend.sessionId)!.px).toBeLessThan(start);
  });

  it("a friend whose wire drops shows as gone", async () => {
    const host = new LocalHost();
    const me = host.hostLink("Ana", "bomb");
    const [hostEnd, guestEnd] = wires();
    host.addPeer(hostEnd);
    const friend = await PeerLink.join(guestEnd, "Bia", "bomb");
    const left: number[] = [];
    friend.onLeave((code) => left.push(code));
    const lobbies = inbox<LobbyInfo>(me, S2C.lobby);
    hostEnd.cut();
    await flush();
    expect(lobbies.at(-1)!.members.map((m) => m.name)).toEqual(["Ana"]);
    expect(left).toHaveLength(1);
  });

  it("the host leaving closes the room for everyone", async () => {
    const host = new LocalHost();
    const me = host.hostLink("Ana", "bomb");
    const [hostEnd, guestEnd] = wires();
    host.addPeer(hostEnd);
    const friend = await PeerLink.join(guestEnd, "Bia", "bomb");
    const left: number[] = [];
    friend.onLeave((code) => left.push(code));
    await me.leave();
    await flush();
    expect(left).toHaveLength(1);
  });

  it("tells whoever listens when the room closes, and what it holds meanwhile", async () => {
    const host = new LocalHost();
    const me = host.hostLink("Ana", "bomb");
    const closed: number[] = [];
    host.onClose(() => closed.push(1));
    expect(host.listing("Ana")).toEqual({ name: "Ana", players: 1, max: 5, playing: false });
    await me.leave();
    expect(closed).toEqual([1]);
  });

  it("tells which way each connection runs: a friend reads its own wire's, the host the worst of its friends'", async () => {
    const host = new LocalHost();
    const me = host.hostLink("Ana", "bomb");
    const [hostA, guestA] = wires();
    const [hostB, guestB] = wires();
    Object.assign(hostA, { route: async () => ({ via: "wifi", rtt: 5 }) });
    Object.assign(hostB, { route: async () => ({ via: "internet", rtt: 180 }) });
    Object.assign(guestA, { route: async () => ({ via: "wifi", rtt: 5 }) });
    host.addPeer(hostA);
    host.addPeer(hostB);
    const bia = await PeerLink.join(guestA, "Bia", "bomb");
    await PeerLink.join(guestB, "Caio", "bomb");
    expect(await bia.route()).toEqual({ via: "wifi", rtt: 5 });
    expect(await me.route!()).toEqual({ via: "internet", rtt: 180 });
  });

  it("pings answer over the wire", async () => {
    const host = new LocalHost();
    host.hostLink("Ana", "bomb");
    const [hostEnd, guestEnd] = wires();
    host.addPeer(hostEnd);
    const friend = await PeerLink.join(guestEnd, "Bia", "bomb");
    const ms = await new Promise<number>((r) => friend.ping(r));
    expect(ms).toBeGreaterThanOrEqual(0);
  });
});
