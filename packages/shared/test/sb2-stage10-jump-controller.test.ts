import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { advanceSb2Stage10Jump, startSb2Stage10Jump } from "../src/sb2-stage10-jump";
import type { Facing } from "../src/state";

interface Sample {
  index: number;
  phase: number;
  players: { x: number; y: number; mode_word: number; jump_target_y: number }[];
}
const cases = ["CONTROLS", "DIRECTIONS"].flatMap(group => {
  const replay: { cases: Record<string, Sample[]> } = JSON.parse(readFileSync(
    new URL(`../../../docs/sb2/SB2-STAGE10-JUMP-${group}-VERIFIED-REPLAY.json`, import.meta.url), "utf8"));
  return Object.entries(replay.cases);
});

it.each(cases)("confronta alvo, voo e instante de aterrissagem nativos: %s", (name, samples) => {
  const direction: Facing | null = name === "pulse-neutral" ? null
    : name === "pulse-left" ? "left" : name === "pulse-up" ? "up" : name === "pulse-down" ? "down" : "right";
  const origin = samples[0]!.players[0]!;
  let jump = startSb2Stage10Jump(origin.x, origin.y, direction);
  for (const sample of samples.slice(1)) {
    jump = advanceSb2Stage10Jump(jump, sample.phase);
    jump = JSON.parse(JSON.stringify(jump));
    const native = sample.players[0]!;
    expect(jump.targetY, `alvo ${sample.index}`).toBe(native.jump_target_y);
    expect(jump.landed, `aterrissagem ${sample.index}`).toBe(native.mode_word === 0);
    expect(jump.x, `X ${sample.index}`).toBe(native.x);
    // O casoUP já executa a primeira passada automática da borda após limpar voo.
    // Esta rotina termina na escrita+C0 de C0669F, anterior a esse alinhamento.
    expect(jump.y, `Y antes da borda ${sample.index}`).toBe(native.y + (jump.landed && direction === "up" ? 1 : 0));
    if (jump.landed) break;
  }
  expect(jump.landed).toBe(true);
});
