import { describe, expect, it } from "vitest";
import type { PadState } from "../src/input/gamepad";
import { PadNav } from "../src/input/pad-nav";

function pad(pressed: number[] = [], axes: [number, number] = [0, 0]): PadState {
  return { buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) })), axes };
}

describe("PadNav", () => {
  it("says nothing with no pad", () => {
    expect(new PadNav(() => null).sample(0)).toBeNull();
  });

  it("moves once per d-pad press", () => {
    let state = pad([13]);
    const nav = new PadNav(() => state);
    expect(nav.sample(0)).toBe("down");
    expect(nav.sample(16)).toBeNull();
    state = pad([]);
    expect(nav.sample(32)).toBeNull();
    state = pad([14]);
    expect(nav.sample(48)).toBe("left");
  });

  it("reads the left stick as a direction", () => {
    expect(new PadNav(() => pad([], [0.9, 0.1])).sample(0)).toBe("right");
    expect(new PadNav(() => pad([], [0, -0.8])).sample(0)).toBe("up");
    expect(new PadNav(() => pad([], [0.2, 0.3])).sample(0)).toBeNull();
  });

  it("repeats a held direction after a pause, then steadily", () => {
    const nav = new PadNav(() => pad([12]));
    expect(nav.sample(0)).toBe("up");
    expect(nav.sample(300)).toBeNull();
    expect(nav.sample(400)).toBe("up");
    expect(nav.sample(500)).toBeNull();
    expect(nav.sample(550)).toBe("up");
  });

  it("A confirms and B goes back, once per press", () => {
    let state = pad([0]);
    const nav = new PadNav(() => state);
    expect(nav.sample(0)).toBe("confirm");
    expect(nav.sample(16)).toBeNull();
    state = pad([1]);
    expect(nav.sample(400)).toBe("back");
    expect(nav.sample(416)).toBeNull();
  });

  it("a second A or B within the cooldown is dropped (no double join, no bouncing contacts)", () => {
    let state = pad([0]);
    const nav = new PadNav(() => state);
    expect(nav.sample(0)).toBe("confirm");
    state = pad([]);
    nav.sample(50);
    state = pad([0]);
    expect(nav.sample(100)).toBeNull(); // a bounce
    state = pad([]);
    nav.sample(150);
    state = pad([1]);
    expect(nav.sample(200)).toBeNull(); // B right after A: dropped too
    state = pad([]);
    nav.sample(250);
    state = pad([0]);
    expect(nav.sample(320)).toBe("confirm");
  });

  it("a button held from before (the press that opened the screen) does nothing", () => {
    const nav = new PadNav(() => pad([0]));
    nav.reset();
    expect(nav.sample(0)).toBeNull();
  });
});
