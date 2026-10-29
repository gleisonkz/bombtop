import { expect, it } from "vitest";
import { DEFAULT_ROTATION_LENGTH, DEFAULT_STAGE_ROTATION, MAX_STAGE_ROTATION, SB4_STAGES, randomStageRotation, validateStageRotation } from "../src";

it("accepts all twelve Group 1 stages as a complete rotation", () => {
  const rotation = SB4_STAGES.map(stage => ({ stage }));
  expect(validateStageRotation(rotation)).toEqual(rotation);
});

it("validates a whole playlist and returns detached entries", () => {
  const input = [{ stage: "warp" }];
  const parsed = validateStageRotation(input);
  expect(parsed).toEqual(input);
  expect(parsed).not.toBe(input);
  expect(parsed![0]).not.toBe(input[0]);
  expect(validateStageRotation([{ stage: "warp", rounds: 9 }, { stage: "warp" }])).toEqual([
    { stage: "warp" }, { stage: "warp" },
  ]);
  expect(MAX_STAGE_ROTATION).toBe(12);
  expect(DEFAULT_STAGE_ROTATION).toEqual([
    { stage: "classic" }, { stage: "conveyor" }, { stage: "warp" },
  ]);
});

it("rejects malformed playlists without filtering or coercing entries", () => {
  for (const bad of [null, undefined, {}, [], new Array(2), Array(13).fill({ stage: "classic" }),
    [null], ["warp"], [{}], [{ stage: "unknown" }], [{ stage: 1 }],
    [{ stage: "classic" }, { stage: "missing" }]]) {
    expect(validateStageRotation(bad)).toBeNull();
  }
  expect(validateStageRotation(Array(12).fill({ stage: "conveyor" }))).toHaveLength(12);
});

it("draws five different SB4 stages at random for a new room's rotation", () => {
  const values = [0.99, 0, 0.5, 0.25, 0.75, 0.1];
  let i = 0;
  const random = () => values[i++ % values.length]!;
  const rotation = randomStageRotation(random);
  expect(DEFAULT_ROTATION_LENGTH).toBe(5);
  expect(rotation).toHaveLength(5);
  expect(new Set(rotation.map(entry => entry.stage)).size).toBe(5);
  for (const { stage } of rotation) expect(SB4_STAGES).toContain(stage);
  expect(validateStageRotation(rotation)).toEqual(rotation);
  i = 0;
  expect(randomStageRotation(random)).toEqual(rotation);
});
