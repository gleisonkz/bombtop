import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { sb2NativeConveyorBombDirection, sb2NativeConveyorBombStep } from "../src/sb2-conveyor";

const report = JSON.parse(readFileSync(new URL("../../../docs/sb2/SB2-CONVEYOR-RESERVATION-SAMPLES.json", import.meta.url), "utf8"));
it("reproduz as células ocupadas e reservadas das entidades observadas pelo REA", () => {
  for (const sample of report.samples) {
    const proposed = sb2NativeConveyorBombStep(sample.entry_position, sample, []);
    const x = Math.floor((proposed.x - 8) / 16), y = Math.floor((proposed.y - 25) / 16);
    const direction = sb2NativeConveyorBombDirection(sample.entry_position, sample);
    const dx = direction === "right" ? 1 : direction === "left" ? -1 : 0;
    const dy = direction === "down" ? 1 : direction === "up" ? -1 : 0;
    const index = (y + 3) * 128 + (x + 1) * 2;
    expect(index, sample.label).toBe(sample.current);
    expect(sample.initializing ? 0 : sample.entry_current + dx * 2 + dy * 128, sample.label).toBe(sample.reserved);
  }
});
