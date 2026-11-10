import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { advanceSb2Stage12Preparation, startSb2Stage12Preparation } from "../src/sb2-stage12-preparation";
import { advanceSb2Stage12HorizontalFlight, startSb2Stage12HorizontalFlight,
  advanceSb2Stage12VerticalFlight, startSb2Stage12VerticalFlight } from "../src/sb2-stage12-flight";
import { sb2NativeJumpFlightY } from "../src/sb2-native-motion";
import type { Facing } from "../src/state";

interface Sample { index: number; phase: number; buttons: string[];
  players: { x: number; y: number; latches: number }[] }
function load(file: string): Record<string, Sample[]> {
  return JSON.parse(readFileSync(new URL(`../../../docs/sb2/${file}`, import.meta.url), "utf8")).cases;
}
const cases = { ...load("SB2-STAGE12-SPRING-CONTROLS-CLASSIFIED-REPLAY.json"),
  ...load("SB2-STAGE12-LAUNCH-DIRECTIONS-CLASSIFIED-REPLAY.json") };

it.each(Object.entries(cases))("preparo e primeiro voo reproduzem a captura %s", (_name, samples) => {
  const before = samples[6]!.players[0]!;
  let preparation = startSb2Stage12Preparation(before.x, before.y);
  expect(preparation).toMatchObject({ x: samples[7]!.players[0]!.x, y: samples[7]!.players[0]!.y });
  for (let frame = 8; frame <= 26; frame++) {
    const sample = samples[frame]!;
    const direction = sample.buttons.find(button => ["UP", "DOWN", "LEFT", "RIGHT"].includes(button))
      ?.toLowerCase() as Facing | undefined;
    preparation = advanceSb2Stage12Preparation(preparation, direction ?? null);
    expect(preparation.ready, `liberacao ${frame}`).toBe(frame === 26);
    if (!preparation.ready) {
      expect(sample.players[0], `bloqueio ${frame}`).toMatchObject({ x: preparation.x, y: preparation.y, latches: 0x801 });
      expect(preparation.direction).toBe(null);
    }
    preparation = JSON.parse(JSON.stringify(preparation));
  }
  const { x, y, direction } = preparation;
  let first: { x: number; y: number };
  if (direction === "left" || direction === "right") {
    first = advanceSb2Stage12HorizontalFlight(startSb2Stage12HorizontalFlight(x, y, direction),
      direction === "left" ? -1 : 1);
  } else if (direction === "up" || direction === "down") {
    const flight = advanceSb2Stage12VerticalFlight(startSb2Stage12VerticalFlight(y, direction),
      samples[26]!.phase, direction === "up" ? -1 : 1);
    first = { x, y: flight.y };
  } else first = { x, y: sb2NativeJumpFlightY(y, 1, 5) };
  expect(samples[26]!.players[0]).toMatchObject({ x: first.x, y: first.y, latches: 0x1801 });
});
