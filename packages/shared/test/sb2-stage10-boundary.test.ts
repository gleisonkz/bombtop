import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { advanceSb2Stage10Boundary, startSb2Stage10Boundary } from "../src/sb2-stage10-boundary";
import { advanceSb2Stage10Jump, startSb2Stage10Jump } from "../src/sb2-stage10-jump";
import type { Facing } from "../src/state";

interface Sample { index: number; phase: number; players: { x: number; y: number; latches: number }[] }
const replay: { cases: Record<string, Sample[]> } = JSON.parse(readFileSync(
  new URL("../../../docs/sb2/SB2-STAGE10-JUMP-DIRECTIONS-VERIFIED-REPLAY.json", import.meta.url), "utf8"));
const edges: { cases: Record<string, Sample[]> } = JSON.parse(readFileSync(
  new URL("../../../docs/sb2/SB2-STAGE10-JUMP-EDGES-VERIFIED-REPLAY.json", import.meta.url), "utf8"));
const cases: { name: string; direction: Facing; seat: number; samples: Sample[] }[] = [
  { name: "left", direction: "left", seat: 0, samples: replay.cases["pulse-left"]! },
  { name: "up", direction: "up", seat: 0, samples: replay.cases["pulse-up"]! },
  { name: "right-p2", direction: "right", seat: 1, samples: edges.cases["p2-right"]! },
  { name: "down-p2", direction: "down", seat: 1, samples: edges.cases["p2-down"]! },
  { name: "left-reverse", direction: "left", seat: 0, samples: edges.cases["p1-left-reverse"]! },
  { name: "up-reverse", direction: "up", seat: 0, samples: edges.cases["p1-up-reverse"]! },
];

it.each(cases)("confronta salto, travessia e limpeza da borda $name sem cortar frames", ({ direction, samples, seat }) => {
  const origin = samples[0]!.players[seat]!;
  let jump = startSb2Stage10Jump(origin.x, origin.y, direction);
  let boundary: ReturnType<typeof startSb2Stage10Boundary> | undefined;
  for (const sample of samples.slice(1)) {
    if (!jump.landed) {
      jump = advanceSb2Stage10Jump(jump, sample.phase);
      if (jump.landed) {
        boundary = startSb2Stage10Boundary(jump.x, jump.y, direction);
      }
    } else boundary = advanceSb2Stage10Boundary(boundary!);
    const actual = boundary ?? jump, expected = sample.players[seat]!;
    expect({ x: actual.x, y: actual.y }, `frame ${sample.index}`).toEqual({ x: expected.x, y: expected.y });
    if (boundary) expect(!boundary.done, `controle forçado ${sample.index}`).toBe(!!(expected.latches & 8));
    jump = JSON.parse(JSON.stringify(jump));
    if (boundary) boundary = JSON.parse(JSON.stringify(boundary));
  }
  expect(boundary?.done).toBe(true);
});
