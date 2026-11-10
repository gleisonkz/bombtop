import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { advanceSb2Stage11Flight, startSb2Stage11Flight } from "../src/sb2-stage11-flight";
import { SB2_ITEM_SPEEDS } from "../src/sb2-items";
import type { Facing } from "../src/state";
import { createMatch } from "../src/arena";
import { TILE } from "../src/constants";
import { ItemKind } from "../src/state";

interface NativeSample {
  index: number;
  players: { x: number; y: number; mode_word: number; state_word: number;
    inventory: { speed: number; capacity: number; fire: number; kick: number; glove: number } }[];
  items: { x: number; y: number; glyph: number }[];
}
const cases: Record<string, NativeSample[]> = Object.assign({}, ...[
  "SB2-STAGE11-EDGE-CONTROLS-CLASSIFIED-REPLAY.json", "SB2-STAGE11-EDGE-CHARGE-CLASSIFIED-REPLAY.json",
].map(file => JSON.parse(readFileSync(new URL(`../../../docs/sb2/${file}`, import.meta.url), "utf8")).cases));

it("cria o inventario e item exposto da arena11 conforme a captura inicial", () => {
  const initial = cases["p1-left"]![0]!;
  const match = createMatch({ stage: "sb2-11", playerIds: ["p1", "p2"], seed: 1 });
  expect(match.players.map(player => ({ capacity: player.bombCapacity, fire: player.fireRange - 1,
    speed: SB2_ITEM_SPEEDS.indexOf((player.speed / (TILE / 16)) as typeof SB2_ITEM_SPEEDS[number]),
    kick: Number(player.canKick), glove: Number(player.canGlove) })))
    .toEqual(initial.players.map(player => player.inventory));
  expect(initial.items.every(item => item.glyph === 0x160a)).toBe(true);
  expect(match.items).toEqual(initial.items.map(({ x, y }) => ({ x, y, kind: ItemKind.Skull })));
});

it.each([
  ["p1-left", 0, "right"], ["p1-up", 0, "down"],
  ["p2-right", 1, "left"], ["p2-down", 1, "up"],
  ["release5", 0, "right"], ["interrupted", 0, "right"], ["reverse-charge", 0, "right"],
] as const)("reproduz a projecao nativa completa do lancamento %s", (name, seat, direction: Facing) => {
  const samples = cases[name]!;
  const first = samples.findIndex(sample => sample.players[seat]!.mode_word === 0xc0);
  expect(first).toBeGreaterThan(0);
  const before = samples[first - 1]!.players[seat]!;
  let flight = startSb2Stage11Flight(before.x, before.y, direction, SB2_ITEM_SPEEDS[before.inventory.speed]!);
  let compared = 0;
  for (const sample of samples.slice(first)) {
    flight = advanceSb2Stage11Flight(flight);
    const native = sample.players[seat]!;
    expect({ x: flight.x, y: flight.y }, `posicao ${sample.index}`).toEqual({ x: native.x, y: native.y });
    expect(flight.done, `fim ${sample.index}`).toBe(!(native.mode_word & 0x80));
    expect(flight.done, `estado ${sample.index}`).toBe(!(native.state_word & 0x400));
    flight = JSON.parse(JSON.stringify(flight));
    compared++;
    if (flight.done) break;
  }
  expect(flight.done).toBe(true);
  expect(compared).toBe(44);
});
