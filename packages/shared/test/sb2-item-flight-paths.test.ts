import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { SB2_ITEM_FLIGHT_PATHS } from "../src/sb2-item-flight-paths";
import { advanceSb2ItemFlightSegment, startSb2ItemFlightSegment, type Sb2ItemFlightSegment } from "../src/sb2-item-flight";

interface Sample { index: number; airborne_items: { slot: number; x: number; y: number; raw_hex: string }[] }
const captures = ["CENTER-ENTRY", "CENTER-GATE", "FLOOR-REGISTERS-160", "FLOOR-PARITY"].flatMap(name => {
  const replay: { cases: Record<string, Sample[]> } = JSON.parse(readFileSync(
    new URL(`../../../docs/sb2/SB2-STAGE12-${name}-CLASSIFIED-REPLAY.json`, import.meta.url), "utf8"));
  return Object.entries(replay.cases).filter(([, samples]) => samples.some(sample => sample.airborne_items.length));
});

it.each(captures)("confronta os segmentos de voo do item em %s", (_name, samples) => {
  const states = new Map<number, { path: number; flight: Sb2ItemFlightSegment }>();
  let observations = 0;
  for (const sample of samples) {
    for (const native of sample.airborne_items) {
      const bytes = Buffer.from(native.raw_hex, "hex");
      const pointer = bytes.readUIntLE(0x43, 3);
      let state = states.get(native.slot);
      if (!state) {
        expect(SB2_ITEM_FLIGHT_PATHS[pointer], `tabela inicial ${sample.index}`).toBeDefined();
        state = { path: pointer, flight: startSb2ItemFlightSegment(native.x, native.y) };
      } else {
        const next = advanceSb2ItemFlightSegment(state.flight, SB2_ITEM_FLIGHT_PATHS[state.path]!);
        expect({ x: next.x, y: next.y }, `movimento ${sample.index}`).toEqual({ x: native.x, y: native.y });
        if (next.ended) {
          // Confere cada segmento; a escolha do seguinte ainda vem da captura.
          expect(SB2_ITEM_FLIGHT_PATHS[pointer], `tabela de rebate ${sample.index}`).toBeDefined();
          state = { path: pointer, flight: startSb2ItemFlightSegment(next.x, next.y) };
        } else state.flight = next;
      }
      expect(pointer, `ponteiro ${sample.index}`).toBe(state.path + state.flight.command * 6);
      expect(state.flight.vx || 0, `VX ${sample.index}`).toBe(bytes.readUInt16LE(0x14) * (bytes.readUInt16LE(0) & 1 ? -1 : 1) || 0);
      expect(state.flight.vy || 0, `VY ${sample.index}`).toBe(bytes.readUInt16LE(0x1c) * (bytes.readUInt16LE(0) & 2 ? -1 : 1) || 0);
      states.set(native.slot, JSON.parse(JSON.stringify(state)));
      observations++;
    }
  }
  expect(observations).toBeGreaterThan(0);
});
