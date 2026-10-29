import { expect, it } from "vitest";
import { DEFAULT_STAGE_ROTATION, MAX_STAGE_ROTATION, SB4_STAGES, validateStageRotation } from "../src";

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
  expect(DEFAULT_STAGE_ROTATION).toEqual(SB4_STAGES.map(stage => ({ stage })));
});

it("rejects malformed playlists without filtering or coercing entries", () => {
  for (const bad of [null, undefined, {}, [], new Array(2), Array(13).fill({ stage: "classic" }),
    [null], ["warp"], [{}], [{ stage: "unknown" }], [{ stage: 1 }],
    [{ stage: "classic" }, { stage: "missing" }]]) {
    expect(validateStageRotation(bad)).toBeNull();
  }
  expect(validateStageRotation(Array(12).fill({ stage: "conveyor" }))).toHaveLength(12);
});
