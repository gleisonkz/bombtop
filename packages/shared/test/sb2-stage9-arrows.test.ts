import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sb2Stage9ArrowEntry } from "../src/sb2-stage9-arrows";
import { SB2_STAGE_CAPTURES } from "../src/sb2-stage-captures";

interface MotionSample { index: number; mobile: { x: number; y: number; raw_hex: string }[] }
const motion: { cases: Record<string, MotionSample[]> } = JSON.parse(
  readFileSync(new URL("../../../docs/sb2/SB2-STAGE9-INTERIOR-MOTION.json", import.meta.url), "utf8"));
const sideMotion: { cases: Record<string, MotionSample[]> } = JSON.parse(
  readFileSync(new URL("../../../docs/sb2/SB2-STAGE9-SIDE-MOTION.json", import.meta.url), "utf8"));

describe("entrada de bombas nas setas SB2", () => {
  for (const [name, samples] of Object.entries({ ...motion.cases, ...sideMotion.cases })) {
    it(`confronta posições e trava durante todo o movimento observado: ${name}`, () => {
      let checked = 0;
      for (let index = 1; index < samples.length; index++) {
        const before = samples[index - 1]!.mobile[0], after = samples[index]!.mobile[0];
        if (!before || !after) continue; // Criação/remoção pertence ao controlador ainda não portado.
        const raw = Buffer.from(before.raw_hex, "hex"), nextRaw = Buffer.from(after.raw_hex, "hex");
        const delta = raw.readInt16LE(0x46);
        const candidate = { x: before.x + (Math.abs(delta) === 2 ? Math.sign(delta) * 2 : 0),
          y: before.y + (Math.abs(delta) === 128 ? Math.sign(delta) * 2 : 0) };
        const cell = { x: Math.floor((candidate.x - 8) / 16), y: Math.floor((candidate.y - 25) / 16) };
        const code = SB2_STAGE_CAPTURES[8]!.background[cell.y]![cell.x]!;
        const latch = raw.readUInt16LE(0xc0);
        const result = sb2Stage9ArrowEntry(candidate, cell, code, (latch & 1) !== 0, (latch & 0x8000) !== 0);
        expect({ x: result.x, y: result.y }, `frame ${samples[index]!.index}`).toEqual({ x: after.x, y: after.y });
        expect(result.locked, `trava frame ${samples[index]!.index}`).toBe((nextRaw.readUInt16LE(0xc0) & 1) !== 0);
        checked++;
      }
      expect(checked).toBeGreaterThan(0);
    });
  }

  it("reproduz o recentramento e a curva capturados na entrada por cima", () => {
    const samples = motion.cases["enter-down"]!;
    const before = samples.find(s => s.index === 32)!.mobile[0]!;
    const after = samples.find(s => s.index === 33)!.mobile[0]!;
    expect(sb2Stage9ArrowEntry({ x: before.x, y: before.y + 2 }, { x: 3, y: 3 }, 62, false, false))
      .toEqual({ x: after.x, y: after.y, locked: true, direction: "right" });
    const earlier = samples.find(s => s.index === 31)!.mobile[0]!;
    expect(sb2Stage9ArrowEntry({ x: earlier.x, y: earlier.y + 2 }, { x: 3, y: 3 }, 62, false, false).direction).toBeNull();
  });

  it("não reaplica o recentramento enquanto a trava de entrada está ativa", () => {
    expect(sb2Stage9ArrowEntry({ x: 66, y: 80 }, { x: 3, y: 3 }, 62, true, false))
      .toEqual({ x: 66, y: 80, locked: true, direction: null });
    expect(sb2Stage9ArrowEntry({ x: 80, y: 80 }, { x: 4, y: 3 }, 0, true, false).locked).toBe(false);
  });

  it("preserva o bloqueio de uma bomba parada até fora da seta", () => {
    expect(sb2Stage9ArrowEntry({ x: 64, y: 80 }, { x: 3, y: 3 }, 62, false, true).direction).toBeNull();
  });
});
