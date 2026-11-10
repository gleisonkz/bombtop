import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createMatch } from "../src/arena";
import { TILE } from "../src/constants";
import { updateSb2BattleClock } from "../src/sb2-battle-clock";

interface Read {
  read: number;
  clock: [number, number, number];
  closure: [number, number, number, number, number];
  extended: number;
  players: { x: number; y: number; alive: boolean }[];
}
const capture: { walls: { read: number; cell: number }[]; reads: Read[]; step_frames: number } = JSON.parse(
  readFileSync(new URL("../../../docs/sb2/SB2-CLOSURE-EXTENDED-5656.json", import.meta.url), "utf8"));

// Senha 5656 no Snes9x (REA x MCP, 734 amostras iguais): CC1869 grava 1C68=FFFF e o fechamento
// passa do marcador FE (índice 80) direto ao 82, seguindo a tabela C5E1C9 até esmagar P2 em (10,7).
describe("SB2: fechamento estendido (senha 5656)", () => {
  it("reproduz relógio, registradores do fechamento e a morte de P2, leitura a leitura", () => {
    const first = capture.reads[0]!;
    const s = createMatch({ stage: "sb2-01", seed: 1, playerIds: ["p1", "p2"], maniacItems: {}, suddenDeath: false });
    const runtime = s.stageState!.sb2!;
    runtime.battleClock = { minutes: first.clock[0], seconds: first.clock[1], frame: first.clock[2] };
    const [flags, timer, index, animation, cell] = first.closure;
    runtime.closure = { flags, timer, index, animation, cell, extended: first.extended !== 0 };
    s.players.forEach((p, seat) => {
      p.px = (first.players[seat]!.x - 8) * TILE / 16;
      p.py = (first.players[seat]!.y - 24) * TILE / 16;
    });
    const death = capture.reads.findIndex(r => !r.players[1]!.alive);
    expect(death).toBe(649);
    for (const native of capture.reads.slice(1, death + 1)) {
      for (let frame = 0; frame < capture.step_frames; frame++) updateSb2BattleClock(s, true);
      const c = runtime.closure!, clock = runtime.battleClock!;
      expect([clock.minutes, clock.seconds, clock.frame], `relógio ${native.read}`).toEqual(native.clock);
      expect([c.flags, c.timer, c.index, c.animation, c.cell], `fechamento ${native.read}`).toEqual(native.closure);
      expect(s.players.map(p => p.alive), `vida ${native.read}`).toEqual(native.players.map(p => p.alive));
    }
    expect(capture.walls.length).toBe(118);
  });
});
