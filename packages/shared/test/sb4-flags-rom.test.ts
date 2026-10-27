import { describe, expect, it } from "vitest";
import { createMatch } from "../src/arena";
import { placePlayerAt } from "../src/state";
import { step } from "../src/step";

describe("SB4 flags constructor and release", () => {
  it("uses C31CB0..C31E04 owner positions rather than the player spawns", () => {
    const s = createMatch({ stage: "sb4-12", seed: 7, playerIds: ["a", "b", "c", "d", "e"] });
    expect(s.stageState!.flags).toEqual([
      { ownerId: "a", x: 2, y: 1 }, { ownerId: "b", x: 12, y: 11 },
      { ownerId: "c", x: 12, y: 1 }, { ownerId: "d", x: 2, y: 11 },
      { ownerId: "e", x: 7, y: 7 },
    ]);
    step(s);
    expect(s.stageState!.flags!.every(flag => !flag.carriedBy)).toBe(true);
  });

  it("releases with B/brace, then waits for the dropper to leave the cell", () => {
    const s = createMatch({ stage: "sb4-12", seed: 7, playerIds: ["a", "b"], blockDensity: 0 });
    placePlayerAt(s, "a", 2, 1);
    step(s);
    const flag = s.stageState!.flags![0]!;
    expect(flag.carriedBy).toBe("a");
    step(s, { a: { dir: null, bomb: false, brace: true } });
    expect(flag.carriedBy).toBeUndefined();
    const replay = structuredClone(s);
    for (let tick = 0; tick < 60; tick++) { step(s); step(replay); }
    expect(replay).toEqual(s);
    expect(flag.carriedBy).toBeUndefined();
    placePlayerAt(s, "a", 3, 1); step(s);
    placePlayerAt(s, "a", 2, 1); step(s);
    expect(flag.carriedBy).toBe("a");
  });

  it("does not confuse Y/action with B and keeps the original owner on enemy pickup", () => {
    const s = createMatch({ stage: "sb4-12", seed: 7, playerIds: ["a", "b"], blockDensity: 0 });
    placePlayerAt(s, "b", 2, 1);
    step(s);
    const flag = s.stageState!.flags![0]!;
    expect(flag).toMatchObject({ ownerId: "a", carriedBy: "b" });
    step(s, { b: { dir: null, bomb: false, action: true } });
    expect(flag).toMatchObject({ ownerId: "a", carriedBy: "b" });
  });

  it("pauses for the measured pickup animation, then resumes at unchanged walking speed", () => {
    const s = createMatch({ stage: "sb4-12", seed: 7, playerIds: ["a", "b"], blockDensity: 0 });
    placePlayerAt(s, "a", 2, 1);
    const p = s.players[0]!, start = p.px, positions = [];
    for (let tick = 1; tick <= 11; tick++) {
      step(s, { a: { dir: "right", bomb: false } });
      positions.push(p.px - start);
    }
    expect(positions).toEqual([16,32,32,32,32,32,32,32,32,32,48]);
    expect(p.speed).toBe(16);
  });
});
