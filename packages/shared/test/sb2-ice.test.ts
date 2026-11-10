import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { sb2IceAxisVelocity } from "../src/sb2-ice";

interface Sample { buttons: string[]; player: { x: number; y: number; vx: number; vy: number } }
const reference: { cases: Record<string, Sample[]> } = JSON.parse(readFileSync(
  new URL("../../../docs/sb2/SB2-ICE-INPUT-REPLAY.json", import.meta.url), "utf8"));

// Prefixos livres até antes do primeiro contato; os 384 passos completos são preservados no fixture.
it.each([
  ["right-release", "x", "vx", 19],
  ["down-release", "y", "vy", 27],
  ["reverse", "x", "vx", 25],
] as const)("reproduz posição e velocidade no trecho livre %s", (name, axis, component, frames) => {
  const samples = reference.cases[name]!;
  let velocity = samples[0]!.player[component];
  let position = samples[0]!.player[axis];
  for (let index = 1; index <= frames; index++) {
    const sample = samples[index]!;
    const input = sample.buttons.includes(axis === "x" ? "RIGHT" : "DOWN") ? 1
      : sample.buttons.includes(axis === "x" ? "LEFT" : "UP") ? -1 : 0;
    velocity = sb2IceAxisVelocity(velocity, input);
    position += velocity;
    expect({ velocity, position }, `${name}, frame ${index}`)
      // O sentido é um bit separado; magnitude zero não representa velocidade negativa.
      .toEqual({ velocity: sample.player[component] || 0, position: sample.player[axis] });
  }
});
