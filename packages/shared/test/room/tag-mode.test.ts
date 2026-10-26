import { describe, expect, it } from "vitest";
import { BattleSession, C2S, RESULTS_TICKS, RoomCore } from "../../src";

function session(count = 3) {
  const s = new BattleSession({ seed: () => 64, blockDensity: 0, winsToWin: 2 });
  for (let i = 0; i < count; i++) s.join(`player-${i}`, `Jogador ${i + 1}`);
  for (let i = 1; i < count; i++) s.setReady(`player-${i}`, true);
  return s;
}

describe("Super Bomberman 4 TAG", () => {
  it("forma duas equipes alternadas de 2 a 5 jogadores e expõe a composição no lobby", () => {
    for (let count = 2; count <= 5; count++) {
      const s = session(count);
      expect(s.setRules("player-0", { battleMode: "tag" })).toBe(true);
      expect(s.lobbyInfo("TAG").members.map(member => member.team)).toEqual(
        Array.from({ length: count }, (_, index) => index % 2 === 0 ? "red" : "blue"),
      );
      expect(s.start("player-0")).toBe(true);
    }
  });

  it("transmite trocas de equipe, rejeita alterações indevidas e exige duas equipes", () => {
    const broadcasts: unknown[] = [];
    const core = new RoomCore("TAG", {
      send: () => {},
      broadcast: (type, value) => { if (type === "lobby") broadcasts.push(value); },
    });
    core.join("host", "Anfitrião", "bomb");
    core.join("guest", "Convidado", "bomb");
    core.message("guest", C2S.ready, { ready: true });
    core.message("host", C2S.rules, { battleMode: "tag" });
    core.message("guest", C2S.team, { id: "host", team: "blue" });
    expect(core.session.members[0]?.team).toBe("red");
    core.message("guest", C2S.team, { id: "guest", team: "red" });
    expect(core.session.members[1]?.team).toBe("red");
    expect(core.session.start("host")).toBe(false);
    core.message("host", C2S.team, { id: "guest", team: "blue" });
    expect(core.session.members[1]?.team).toBe("blue");
    expect(broadcasts.at(-1)).toMatchObject({ battleMode: "tag", members: [
      { id: "host", team: "red" }, { id: "guest", team: "blue" },
    ] });
    expect(core.session.start("host")).toBe(true);
    core.message("host", C2S.team, { id: "guest", team: "red" });
    expect(core.session.members[1]?.team).toBe("blue");
  });

  it("encerra o round quando só uma equipe sobrevive e pontua todos os aliados", () => {
    const s = session();
    expect(s.setRules("player-0", { battleMode: "tag" })).toBe(true);
    expect(s.start("player-0")).toBe(true);
    s.match!.players.find(player => player.id === "player-1")!.alive = false;
    expect(s.tick().result).toEqual({ over: true, winnerId: "player-0", winnerTeam: "red", setOver: false });
    expect(s.members.map(member => member.wins)).toEqual([1, 0, 1]);
    for (let i = 0; i < RESULTS_TICKS; i++) s.tick();
    expect(s.phase).toBe("playing");
    s.match!.players.find(player => player.id === "player-1")!.alive = false;
    expect(s.tick().result).toMatchObject({ winnerTeam: "red", setOver: true });
    expect(s.members.map(member => member.wins)).toEqual([2, 0, 2]);
  });

  it("empata se ambos os times caírem no mesmo tick", () => {
    const s = session(2);
    s.setRules("player-0", { battleMode: "tag", timeMinutes: 3 });
    s.start("player-0");
    for (const player of s.match!.players) player.alive = false;
    expect(s.tick().result).toMatchObject({ winnerId: null, winnerTeam: null, setOver: false });
    expect(s.members.every(member => member.wins === 0)).toBe(true);
  });

  it("empata pelo tempo quando as duas equipes continuam vivas", () => {
    const s = session(2);
    s.setRules("player-0", { battleMode: "tag", timeMinutes: 3 });
    s.start("player-0");
    expect(s.match!.players.map(player => player.alive)).toEqual([true, true]);
    s.match!.roundEndsAt = s.match!.tick + 1;
    expect(s.tick().result).toMatchObject({ winnerId: null, winnerTeam: null, setOver: false });
    expect(s.members.every(member => member.wins === 0)).toBe(true);
  });

  it("mantém a vitória individual no modo Single ao sair de TAG", () => {
    const s = session();
    expect(s.setRules("player-0", { battleMode: "tag" })).toBe(true);
    expect(s.setRules("player-0", { battleMode: "single" })).toBe(true);
    expect(s.start("player-0")).toBe(true);
    for (const player of s.match!.players) if (player.id !== "player-0") player.alive = false;
    expect(s.tick().result).toMatchObject({ winnerId: "player-0", setOver: false });
    expect(s.members.map(member => member.wins)).toEqual([1, 0, 0]);
  });
});
