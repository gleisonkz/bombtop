import { describe, expect, it } from "vitest";
import { GamepadInput, type PadState } from "../src/input/gamepad";

function pad(pressed: number[] = [], axes: [number, number] = [0, 0]): PadState {
  return { buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) })), axes };
}

describe("GamepadInput", () => {
  it("is idle with no pad", () => {
    const g = new GamepadInput(() => null);
    expect(g.sample()).toEqual({ dir: null, bomb: false, action: false });
  });

  it("reads the d-pad (standard mapping 12-15)", () => {
    for (const [btn, dir] of [[12, "up"], [13, "down"], [14, "left"], [15, "right"]] as const) {
      const g = new GamepadInput(() => pad([btn]));
      expect(g.sample().dir).toBe(dir);
    }
  });

  it("reads the left stick past a dead zone, using the dominant axis", () => {
    expect(new GamepadInput(() => pad([], [0.9, 0.3])).sample().dir).toBe("right");
    expect(new GamepadInput(() => pad([], [-0.2, -0.8])).sample().dir).toBe("up");
    expect(new GamepadInput(() => pad([], [0.3, 0.2])).sample().dir).toBeNull();
  });

  it("A drops a bomb once per press; B or X is the action button", () => {
    let state = pad([0]);
    const g = new GamepadInput(() => state);
    expect(g.sample().bomb).toBe(true);
    expect(g.sample().bomb).toBe(false);
    state = pad([]);
    g.sample();
    state = pad([0, 1]);
    expect(g.sample()).toMatchObject({ bomb: true, action: true });
    state = pad([2]);
    expect(g.sample().action).toBe(false); // B and X are one logical button: still held, no new press
  });

  it("Y is the special button, once per press", () => {
    let state = pad([3]);
    const g = new GamepadInput(() => state);
    expect(g.sample().special).toBe(true);
    expect(g.sample().special).toBeFalsy();
    state = pad([]);
    expect(g.sample().special).toBeFalsy();
  });
});
