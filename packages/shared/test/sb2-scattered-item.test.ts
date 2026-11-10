import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { advanceSb2ScatteredItem, startSb2ScatteredItem } from "../src/sb2-scattered-item";

interface Sample { index: number; random_history: number[]; grid: number[][];
  items: { x: number; y: number; glyph: number }[];
  airborne_items: { x: number; y: number; raw_hex: string }[] }
const captures = ["CENTER-ENTRY", "CENTER-GATE", "FLOOR-REGISTERS-160", "FLOOR-PARITY"].flatMap(name => {
  const replay: { cases: Record<string, Sample[]> } = JSON.parse(readFileSync(
    new URL(`../../../docs/sb2/SB2-STAGE12-${name}-CLASSIFIED-REPLAY.json`, import.meta.url), "utf8"));
  return Object.entries(replay.cases).filter(([, samples]) => samples.some(sample => sample.airborne_items.length));
});

it.each(captures)("seleciona trajetorias e resolve rebates/pouso do Fire: %s", (_name, samples) => {
  const first = samples.findIndex(sample => sample.airborne_items.length);
  const initial = samples[first]!.airborne_items[0]!;
  let item = startSb2ScatteredItem(initial.x, initial.y, samples[first - 1]!.random_history[0]!);
  let observations = 0;
  for (const sample of samples.slice(first)) {
    // A grade posterior ao pouso ja contem o proprio item44; a entrada
    // externa do componente precisa ser a grade anterior a essa escrita.
    const beforeGrid = samples[sample.index - 1]!.grid;
    if (sample.index !== first) item = advanceSb2ScatteredItem(item, (x, y) => beforeGrid[y]?.[x] ?? 0x46);
    const native = sample.airborne_items[0];
    expect(item.landed, `pouso ${sample.index}`).toBe(!native);
    if (item.landed) {
      expect(sample.items).toContainEqual({ x: Math.floor((item.flight.x + 8) / 16) - 1,
        y: Math.floor((item.flight.y + 23) / 16) - 3, glyph: 0x1602 });
      break;
    }
    expect({ x: item.flight.x, y: item.flight.y }, `posicao ${sample.index}`)
      .toEqual({ x: native!.x, y: native!.y });
    const pointer = Buffer.from(native!.raw_hex, "hex").readUIntLE(0x43, 3);
    expect(item.path + item.flight.command * 6, `tabela ${sample.index}`).toBe(pointer);
    item = JSON.parse(JSON.stringify(item));
    observations++;
  }
  expect(observations).toBeGreaterThan(0);
  expect(item.landed).toBe(true);
});
