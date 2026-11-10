import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { sb2Stage3TunnelEntry } from "../src/sb2-stage3-tunnel";

interface Entry { case: string; entry: "top" | "bottom"; before: { y: number; vy: number }; after: { y: number; vy: number } }
const native: { entries: Entry[] } = JSON.parse(readFileSync(
  new URL("../../../docs/sb2/SB2-STAGE3-EXITS-OBSERVATIONS.json", import.meta.url), "utf8"));
it.each(native.entries)("reproduz o primeiro quadro nativo da abertura $case", entry => {
  const moved = sb2Stage3TunnelEntry(entry.before.y, entry.entry, Math.abs(entry.before.vy));
  expect({ y: moved.y + moved.vy, vy: moved.vy }).toEqual({ y: entry.after.y, vy: entry.after.vy });
});
