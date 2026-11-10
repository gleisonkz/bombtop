import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { advanceSb2ItemFlightSegment, SB2_ITEM_PATH_C5C7BC, startSb2ItemFlightSegment } from "../src/sb2-item-flight";

interface Sample { index: number; airborne_items: { owner: number; glyph: number; x: number; y: number }[] }
const replay: { cases: Record<string, Sample[]> } = JSON.parse(readFileSync(
  new URL("../../../docs/sb2/SB2-STAGE12-CENTER-ENTRY-CLASSIFIED-REPLAY.json", import.meta.url), "utf8"));

it("reproduz ateFFFF o primeiro segmento do Fire expelido nas quatro capturas nativas", () => {
  for (const samples of Object.values(replay.cases)) {
    const first = samples.findIndex(sample => sample.airborne_items.length > 0);
    const initial = samples[first]!.airborne_items[0]!;
    expect({ owner: initial.owner, glyph: initial.glyph }).toEqual({ owner: 0, glyph: 0x1602 });
    let flight = startSb2ItemFlightSegment(initial.x, initial.y);
    for (const sample of samples.slice(first + 1, first + 22)) {
      flight = advanceSb2ItemFlightSegment(flight, SB2_ITEM_PATH_C5C7BC);
      const native = sample.airborne_items[0]!;
      expect({ x: flight.x, y: flight.y }, `frame ${sample.index}`).toEqual({ x: native.x, y: native.y });
      flight = JSON.parse(JSON.stringify(flight));
    }
    expect(flight.ended).toBe(true);
    expect({ x: flight.x, y: flight.y }).toEqual({ x: 208, y: 129 });
  }
});
