import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { advanceSb2ItemFlightSegment, startSb2ItemFlightSegment, type Sb2ItemFlightCommand } from "../src/sb2-item-flight";

interface Sample {
  index: number;
  proxies: { x: number; y: number; raw_hex: string }[];
  static_records: { x: number; y: number }[];
}
const read = (name: string) => JSON.parse(readFileSync(new URL(`../../../docs/sb2/${name}`, import.meta.url), "utf8"));
const replay: { cases: Record<string, Sample[]> } = read("SB2-STAGE12-GLOVE-CONTROLS-REPLAY.json");
const paths: { paths: Record<string, { address: number; commands: Sb2ItemFlightCommand[]; birth_index: number }> } = read("SB2-STAGE12-GLOVE-PATHS-ROM.json");

it.each(Object.entries(paths.paths).filter(([name]) => name in replay.cases))("trajetoria da luva coincide com cada proxy nativo: %s", (name, path) => {
  const samples = replay.cases[name]!;
  const birth = samples[path.birth_index]!;
  let flight = startSb2ItemFlightSegment(birth.proxies[0]!.x, birth.proxies[0]!.y);
  for (const sample of samples.slice(path.birth_index)) {
    if (sample.index > path.birth_index) flight = advanceSb2ItemFlightSegment(flight, path.commands);
    if (flight.ended) {
      expect(sample.proxies).toEqual([]);
      expect(sample.static_records.map(bomb => ({ x: bomb.x, y: bomb.y }))).toEqual([
        { x: Math.floor((flight.x + 8) / 16) - 1, y: Math.floor((flight.y + 23) / 16) - 3 },
      ]);
      return;
    }
    expect(sample.proxies).toHaveLength(1);
    const proxy = sample.proxies[0]!;
    expect({ x: flight.x, y: flight.y }, `quadro ${sample.index}`).toEqual({ x: proxy.x, y: proxy.y });
    expect(path.address + flight.command * 6).toBe(Buffer.from(proxy.raw_hex, "hex").readUIntLE(0x43, 3));
  }
  throw new Error("Captura encerrou antes do pouso");
});
