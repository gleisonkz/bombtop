import { describe, expect, it } from "vitest";
import { createMatch } from "../src/arena";
import { placePlayerAt, type Facing } from "../src/state";
import { step } from "../src/step";

// Native controls: stage05-rope-walk-control.json, 240 held-input frames
// per edge. All remain C2141C, recovery counter 0394 stays zero.
describe("SB4 electrical rope walking controls", () => {
  it.each<[Facing, number, number]>([
    ["left", 1, 3], ["up", 3, 1],
    ["right", 13, 3], ["down", 3, 11],
  ])("does not stun a player walking against the %s edge", (dir, x, y) => {
    const s = createMatch({ stage: "sb4-05", seed: 7, playerIds: ["a", "b"] });
    placePlayerAt(s, "a", x, y);
    const p = s.players[0]!;
    for (let tick = 0; tick < 240; tick++) {
      step(s, { a: { dir, bomb: false } });
      expect(p.stun).toBe(0);
      expect(p.alive).toBe(true);
    }
    const before = { px: p.px, py: p.py };
    const inward: Facing = dir === "left" ? "right" : "left";
    step(s, { a: { dir: inward, bomb: false } });
    expect(p.px).not.toBe(before.px);
    expect(p.py).toBe(before.py);
  });
});
