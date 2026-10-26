import { describe, expect, it } from "vitest";
import { createMatch } from "../src/arena";
import { TILE } from "../src/constants";
import { stageFlame, updateStageMechanics } from "../src/stage-mechanics";
import { tileCenter } from "../src/state";

describe("SB4 rolling ball observed ROM motion", () => {
  it("moves toward the bomb at one pixel per update and stops after eight segments", () => {
    const s = createMatch({ stage: "sb4-03", seed: 17, playerIds: ["a", "b"], blockDensity: 0 });
    const ball = { px: tileCenter(5), py: tileCenter(5), dir: null };
    s.stageState = { balls: [ball] };
    expect(stageFlame(s, 5, 5, "a", "left")).toBe(true);
    expect(ball.dir).toBe("right");
    updateStageMechanics(s);
    expect(ball.px).toBe(tileCenter(5) + TILE / 16);
    for (let tick = 1; tick < 128; tick++) updateStageMechanics(s);
    expect(ball.px).toBe(tileCenter(13));
    expect(ball.py).toBe(tileCenter(5));
    expect(ball.dir).toBeNull();
    updateStageMechanics(s);
    expect(ball.px).toBe(tileCenter(13));
  });
});
