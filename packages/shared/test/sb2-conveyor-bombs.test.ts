import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sb2NativeConveyorBombStep } from "../src/sb2-conveyor";

interface Sample {
  label: string; control_word: number;
  bomb: { state_word: number; x: number; y: number };
  players: { x: number; y: number; state_word: number }[];
}
interface Case { label: string; samples: Sample[] }
const read = (name: string): Case[] => JSON.parse(readFileSync(new URL(`../../../docs/sb2/${name}`, import.meta.url), "utf8")).cases;
const cases = [...read("SB2-CONVEYOR-BOMBS-NEUTRAL-REPLAY.json"), ...read("SB2-CONVEYOR-PLANTED-REPLAY.json")];

describe("bombas móveis nas correias SB2: transições nativas REA/MCP", () => {
  it.each(cases)("reproduz cada deslocamento observado de $label", test => {
    let position = { x: test.samples[0]!.bomb.x, y: test.samples[0]!.bomb.y };
    for (let index = 1; index < test.samples.length; index++) {
      const before = test.samples[index - 1]!, after = test.samples[index]!;
      // Criação e retorno à tabela estática têm ciclo próprio, fora deste ensaio de transporte.
      if (!before.bomb.state_word || !after.bomb.state_word) {
        position = { x: after.bomb.x, y: after.bomb.y };
        continue;
      }
      const next = sb2NativeConveyorBombStep(position,
        { fast: (after.control_word & 1) !== 0, reversed: (after.control_word & 2) !== 0 },
        after.players.filter(p => (p.state_word & 0xf000) === 0x9000));
      expect(next, after.label).toEqual({ x: after.bomb.x, y: after.bomb.y });
      position = next;
    }
  });
});
