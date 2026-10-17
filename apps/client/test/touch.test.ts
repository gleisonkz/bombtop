import { describe, expect, it } from "vitest";
import { dirFromVector, TouchInput } from "../src/input/touch";

describe("dirFromVector", () => {
  it("picks the dominant axis past the dead zone", () => {
    expect(dirFromVector(30, 5, 12)).toBe("right");
    expect(dirFromVector(-30, 5, 12)).toBe("left");
    expect(dirFromVector(5, -30, 12)).toBe("up");
    expect(dirFromVector(5, 30, 12)).toBe("down");
  });

  it("is neutral inside the dead zone", () => {
    expect(dirFromVector(5, 5, 12)).toBeNull();
  });
});

describe("TouchInput", () => {
  it("the stick follows the finger relative to where it touched down", () => {
    const t = new TouchInput();
    t.stickStart(1, 100, 100);
    t.stickMove(1, 140, 105);
    expect(t.sample().dir).toBe("right");
    t.stickEnd(1);
    expect(t.sample().dir).toBeNull();
  });

  it("ignores other fingers on the stick", () => {
    const t = new TouchInput();
    t.stickStart(1, 100, 100);
    t.stickMove(2, 300, 100);
    expect(t.sample().dir).toBeNull();
  });

  it("buttons fire once per tap", () => {
    const t = new TouchInput();
    t.press("bomb");
    expect(t.sample()).toMatchObject({ bomb: true, action: false });
    expect(t.sample().bomb).toBe(false);
    t.press("action");
    expect(t.sample().action).toBe(true);
  });

  it("reset releases everything", () => {
    const t = new TouchInput();
    t.stickStart(1, 0, 0);
    t.stickMove(1, 50, 0);
    t.press("bomb");
    t.reset();
    expect(t.sample()).toEqual({ dir: null, bomb: false, action: false });
  });
});
