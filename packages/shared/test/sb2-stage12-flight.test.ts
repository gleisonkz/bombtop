import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { advanceSb2Stage12HorizontalFlight, startSb2Stage12HorizontalFlight,
  sb2Stage12VerticalFlightY, startSb2Stage12VerticalFlight,
  advanceSb2Stage12VerticalFlight } from "../src/sb2-stage12-flight";

interface Sample { index: number; phase: number; players: { x: number; y: number; latches: number }[] }
function load(file: string): Record<string, Sample[]> {
  return JSON.parse(readFileSync(new URL(`../../../docs/sb2/${file}`, import.meta.url), "utf8")).cases;
}
const directions = load("SB2-STAGE12-LAUNCH-DIRECTIONS-CLASSIFIED-REPLAY.json");
const controls = load("SB2-STAGE12-SPRING-CONTROLS-CLASSIFIED-REPLAY.json");

it.each([
  ["launch-up", "up", -1, 61, 41],
  ["launch-down", "down", 1, 63, 151],
] as const)("acompanha o alvo vertical e o instante de pouso: %s", (name, direction, input, landing, target) => {
  const samples = directions[name]!;
  let flight = startSb2Stage12VerticalFlight(samples[25]!.players[0]!.y, direction);
  for (let frame = 26; frame <= landing; frame++) {
    flight = advanceSb2Stage12VerticalFlight(flight, samples[frame]!.phase, frame <= 40 ? input : 0);
    expect(flight.landed, `pouso ${frame}`).toBe(frame === landing);
    if (frame < landing || direction === "down")
      expect(flight.y, `Y ${frame}`).toBe(samples[frame]!.players[0]!.y);
    flight = JSON.parse(JSON.stringify(flight));
  }
  expect(flight.targetY).toBe(target);
  // UP resolve terreno e escape no mesmo frame; sua posicao final nao e voo livre.
  expect(samples[landing]!.players[0]!.latches).toBe(direction === "up" ? 0x809 : 0);
});

it.each([
  ["launch-up", "up", 60],
  ["launch-down", "down", 62],
] as const)("reproduz arco vertical12 antes da resolucao de alvo: %s", (name, direction, finalFrame) => {
  const samples = directions[name]!;
  const origin = samples[25]!.players[0]!;
  for (let frame = 26; frame <= finalFrame; frame++) {
    expect(samples[frame]!.players[0], `frame ${frame}`).toMatchObject({
      x: origin.x, y: sb2Stage12VerticalFlightY(origin.y, frame - 25, direction), latches: 0x1801,
    });
  }
});

it.each([
  ["launch-left", directions["launch-left"]!, "left", 40],
  ["launch-right-pulse", directions["launch-right-pulse"]!, "right", 26],
  ["launch-right", controls["launch-right"]!, "right", 40],
] as const)("reproduz impulso e soltura do voo horizontal12: %s", (_name, samples, direction, release) => {
  const origin = samples[25]!.players[0]!;
  let flight = startSb2Stage12HorizontalFlight(origin.x, origin.y, direction);
  for (let frame = 26; frame <= 65; frame++) {
    flight = advanceSb2Stage12HorizontalFlight(flight,
      frame <= release ? direction === "right" ? 1 : -1 : 0);
    const native = samples[frame]!.players[0]!;
    expect({ x: flight.x, y: flight.y }, `frame ${frame}`).toEqual({ x: native.x, y: native.y });
    expect(native.latches).toBe(0x1801);
    flight = JSON.parse(JSON.stringify(flight));
  }
});
