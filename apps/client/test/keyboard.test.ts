import { describe, expect, it } from "vitest";
import { KeyboardInput, mergeInputs, WASD } from "../src/input/keyboard";

describe("KeyboardInput", () => {
  it("has no direction and no bomb by default", () => {
    expect(new KeyboardInput(WASD).sample()).toEqual({ dir: null, bomb: false, action: false });
  });

  it("maps held keys to a direction", () => {
    const k = new KeyboardInput(WASD);
    k.keyDown("KeyD");
    expect(k.sample().dir).toBe("right");
    expect(k.sample().dir).toBe("right");
  });

  it("prefers the most recently pressed direction", () => {
    const k = new KeyboardInput(WASD);
    k.keyDown("KeyD");
    k.keyDown("KeyW");
    expect(k.sample().dir).toBe("up");
  });

  it("falls back to a still-held direction on release", () => {
    const k = new KeyboardInput(WASD);
    k.keyDown("KeyD");
    k.keyDown("KeyW");
    k.keyUp("KeyW");
    expect(k.sample().dir).toBe("right");
    k.keyUp("KeyD");
    expect(k.sample().dir).toBeNull();
  });

  it("ignores key repeat for ordering", () => {
    const k = new KeyboardInput(WASD);
    k.keyDown("KeyD");
    k.keyDown("KeyW");
    k.keyDown("KeyD"); // auto-repeat of an already-held key
    expect(k.sample().dir).toBe("up");
  });

  it("fires the bomb once per press", () => {
    const k = new KeyboardInput(WASD);
    k.keyDown("Space");
    expect(k.sample().bomb).toBe(true);
    expect(k.sample().bomb).toBe(false);
    k.keyDown("Space"); // auto-repeat while held
    expect(k.sample().bomb).toBe(false);
    k.keyUp("Space");
    k.keyDown("Space");
    expect(k.sample().bomb).toBe(true);
  });

  it("does not lose a tap released before the next sample", () => {
    const k = new KeyboardInput(WASD);
    k.keyDown("Space");
    k.keyUp("Space");
    expect(k.sample().bomb).toBe(true);
  });

  it("ignores unbound keys", () => {
    const k = new KeyboardInput(WASD);
    expect(k.keyDown("KeyX")).toBe(false);
    expect(k.keyDown("KeyA")).toBe(true);
    expect(k.sample().dir).toBe("left");
  });

  it("clears everything on reset (e.g. window blur)", () => {
    const k = new KeyboardInput(WASD);
    k.keyDown("KeyA");
    k.keyDown("Space");
    k.reset();
    expect(k.sample()).toEqual({ dir: null, bomb: false, action: false });
  });

  it("fires the action button once per press", () => {
    const k = new KeyboardInput(WASD);
    k.keyDown("ShiftLeft");
    expect(k.sample().action).toBe(true);
    k.keyDown("ShiftLeft");
    expect(k.sample().action).toBe(false);
    k.keyUp("ShiftLeft");
    k.keyDown("ShiftLeft");
    k.keyUp("ShiftLeft");
    expect(k.sample().action).toBe(true);
  });
});

describe("mergeInputs", () => {
  it("takes the first held direction and ORs the buttons", () => {
    expect(
      mergeInputs([
        { dir: null, bomb: false, action: true },
        { dir: "up", bomb: true, action: false },
      ]),
    ).toEqual({ dir: "up", bomb: true, action: true });
  });

  it("keeps the fallback direction of the source that steers", () => {
    expect(
      mergeInputs([
        { dir: null, bomb: false },
        { dir: "left", alt: "up", bomb: false },
      ]),
    ).toEqual({ dir: "left", alt: "up", bomb: false, action: false });
  });

  it("is idle with no inputs", () => {
    expect(mergeInputs([])).toEqual({ dir: null, bomb: false, action: false });
  });
});
