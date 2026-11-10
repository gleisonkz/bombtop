import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { sb2Stage2JunctionDirection, sb2Stage2PreparationStep, sb2Stage2RouteStep, sb2Stage2ExitStep } from "../src/sb2-stage2-route";
import { SB2_STAGE_CAPTURES } from "../src/sb2-stage-captures";
import type { Facing } from "../src/state";

interface Junction { label: string; before: number; after: number; random_word: number }
const reference: { junctions: Junction[] } = JSON.parse(readFileSync(
  new URL("../../../docs/sb2/SB2-ICE-FLOOR-OBSERVATIONS.json", import.meta.url), "utf8"));
const facings = { 2: "right", 4: "left", 8: "down", 16: "up" } as const;

it.each(reference.junctions)("reproduz a escolha nativa da junção em $label", sample => {
  expect(sb2Stage2JunctionDirection(facings[sample.before as keyof typeof facings], sample.random_word))
    .toBe(facings[sample.after as keyof typeof facings]);
});

const variedJunctions: { junctions: Junction[] } = JSON.parse(readFileSync(
  new URL("../../../docs/sb2/SB2-ICE-TRANSPORT-INTERACTIONS-OBSERVATIONS.json", import.meta.url), "utf8"));
it.each(variedJunctions.junctions.filter(sample => sample.random_word !== 34))(
  "reproduz o fallback nativo com outra palavra aleatória em $label", sample => {
    expect(sb2Stage2JunctionDirection(facings[sample.before as keyof typeof facings], sample.random_word))
      .toBe(facings[sample.after as keyof typeof facings]);
  },
);

it.each(["neutral-route", "opposite-route"])("reproduz saída aérea e aterrissagem nativas %s", name => {
  const samples = routes.cases[name]!;
  const initial = samples.find(s => s.index === 125)!;
  let position = { x: initial.x, y: 176 + initial.y - Math.floor(initial.y) };
  let motion = { velocity: 8, ascending: true, slow: false, target: { x: 3, y: 8 } };
  for (const sample of samples.filter(s => s.index > 125 && s.index <= 185)) {
    const result = sb2Stage2ExitStep(position, motion);
    expect(position, `saída ${name}:${sample.index}`).toEqual({ x: sample.x, y: sample.y });
    expect(Math.abs(result.vy)).toBe(sample.vy_magnitude);
    expect(result.landed).toBe(sample.index === 185);
    position = JSON.parse(JSON.stringify(position));
    motion = JSON.parse(JSON.stringify(motion));
  }
});

interface RouteSample {
  index: number; x: number; y: number; facing: number; latches: number;
  route_random_word: number; vx_magnitude: number; vy_magnitude: number;
}
const routes: { cases: Record<string, RouteSample[]> } = JSON.parse(readFileSync(
  new URL("../../../docs/sb2/SB2-ICE-FLOOR-OBSERVATIONS.json", import.meta.url), "utf8"));
it.each(["entry", "neutral-route", "opposite-route"])("reproduz curvas e junções do percurso nativo %s", name => {
  const samples = routes.cases[name]!;
  const initial = samples.find(s => s.index === 34)!;
  let position = { x: initial.x, y: initial.y };
  let motion: { facing: Facing; junction: boolean } = { facing: "down", junction: false };
  for (const sample of samples.filter(s => s.index > 34 && s.index <= 125)) {
    const velocity = sb2Stage2RouteStep(position, motion, SB2_STAGE_CAPTURES[1].background, sample.route_random_word);
    expect(position, `posição ${name}:${sample.index}`).toEqual({ x: sample.x, y: sample.y });
    expect({ vx: Math.abs(velocity.vx), vy: Math.abs(velocity.vy) }).toEqual({ vx: sample.vx_magnitude, vy: sample.vy_magnitude });
    expect(motion.facing).toBe(facings[sample.facing as keyof typeof facings]);
    expect(motion.junction).toBe(!!(sample.latches & 64));
    position = JSON.parse(JSON.stringify(position));
    motion = JSON.parse(JSON.stringify(motion));
  }
});

interface LaunchSample { index: number; x: number; y: number; vy: number }
const preparations: { launches: { case: string; hold: LaunchSample[]; launched: LaunchSample }[] } = JSON.parse(readFileSync(
  new URL("../../../docs/sb2/SB2-ICE-LAUNCH-OBSERVATIONS.json", import.meta.url), "utf8"));

it.each(preparations.launches)("reproduz a preparação e o lançamento nativos em $case", sample => {
  let state = { elapsed: 0 };
  let y = sample.hold[0]!.y;
  for (const frame of [...sample.hold, sample.launched]) {
    const result = sb2Stage2PreparationStep(state, 0x308);
    y += result.displacementY + result.velocityY;
    expect({ y, vy: result.velocityY }, `quadro ${frame.index}`).toEqual({ y: frame.y, vy: frame.vy });
    expect(result.launched).toBe(frame.index === sample.launched.index);
    state = JSON.parse(JSON.stringify(state));
  }
});
