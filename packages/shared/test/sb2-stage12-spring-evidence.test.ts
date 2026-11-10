import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { sb2NativeJumpFlightY } from "../src/sb2-native-motion";

interface Sample {
  index: number;
  players: { x: number; y: number; latches: number }[];
}
const replay: { cases: Record<string, Sample[]> } = JSON.parse(readFileSync(
  new URL("../../../docs/sb2/SB2-STAGE12-FLOOR-REGISTERS-160-CLASSIFIED-REPLAY.json", import.meta.url), "utf8"));
const controls: { cases: Record<string, Sample[]> } = JSON.parse(readFileSync(
  new URL("../../../docs/sb2/SB2-STAGE12-SPRING-CONTROLS-CLASSIFIED-REPLAY.json", import.meta.url), "utf8"));

it.each(["prep-right", "prep-left"])("comandos no preparo preservam a trajetoria neutra: %s", name => {
  const reference = replay.cases["upper-pulse"]!;
  for (const sample of controls.cases[name]!) {
    const player = sample.players[0]!;
    const neutral = reference[sample.index]!.players[0]!;
    expect({ x: player.x, y: player.y, latches: player.latches }, `frame ${sample.index}`)
      .toEqual({ x: neutral.x, y: neutral.y, latches: neutral.latches });
  }
});

it("comando iniciado apos a partida aplica somente deriva lateral enquanto mantido", () => {
  const samples = controls.cases["flight-right"]!;
  for (let frame = 26; frame <= 65; frame++) {
    const driftFrames = Math.min(14, Math.max(0, frame - 26));
    expect(samples[frame]!.players[0], `frame ${frame}`).toMatchObject({
      x: 128 + driftFrames * 0.5,
      y: sb2NativeJumpFlightY(96.5, frame - 25, 5), latches: 0x1801,
    });
  }
  expect(samples[66]!.players[0]).toMatchObject({ x: 135, y: 96.5, latches: 0 });
  expect(samples[67]!.players[0]).toMatchObject({ x: 128, y: 96.5, latches: 0x801 });
});

it("reproduz os tres arcos neutros do piso12 observados pelo REA/MCP", () => {
  const samples = replay.cases["upper-pulse"]!;
  let observations = 0;
  for (const launch of [26, 86, 146]) {
    const origin = samples[launch - 1]!.players[0]!;
    expect(origin).toMatchObject({ x: 128, y: 96.5, latches: 0x801 });
    for (let frame = launch; frame <= Math.min(launch + 39, 160); frame++) {
      expect(samples[frame]!.players[0], `voo ${frame}`).toMatchObject({
        x: origin.x, y: sb2NativeJumpFlightY(origin.y, frame - launch + 1, 5), latches: 0x1801,
      });
      observations++;
    }
    if (launch + 40 <= 160) {
      expect(samples[launch + 40]!.players[0]).toMatchObject({ x: 128, y: 96.5, latches: 0 });
      expect(samples[launch + 41]!.players[0]).toMatchObject({ x: 128, y: 96.5, latches: 0x801 });
    }
  }
  expect(observations).toBe(95);
});
