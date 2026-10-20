import { describe, expect, it } from "vitest";
import { ARROWS, KeyboardInput, mergeInputs, WASD } from "../src/input/keyboard";

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

  it("uses the earlier held direction as the diagonal fallback", () => {
    const k = new KeyboardInput(WASD);
    k.keyDown("KeyW");
    k.keyDown("KeyA");
    expect(k.sample()).toMatchObject({ dir: "left", alt: "up" });
  });

  it("has no fallback for opposite keys", () => {
    const k = new KeyboardInput(WASD);
    k.keyDown("KeyA");
    k.keyDown("KeyD");
    expect(k.sample().alt).toBeUndefined();
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

  it("reports the bomb key as held until it is let go (glove carry)", () => {
    const k = new KeyboardInput(WASD);
    k.keyDown("Space");
    expect(k.sample()).toMatchObject({ bomb: true, hold: true });
    expect(k.sample()).toMatchObject({ bomb: false, hold: true });
    k.keyUp("Space");
    expect(k.sample().hold).toBeUndefined();
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

describe("special button", () => {
  it("fires once per press, on E (left player) or right Ctrl (right player)", () => {
    const left = new KeyboardInput(WASD);
    left.keyDown("KeyE");
    expect(left.sample().special).toBe(true);
    expect(left.sample().special).toBeFalsy();
    const right = new KeyboardInput(ARROWS);
    expect(right.keyDown("ControlRight")).toBe(true);
    expect(right.sample().special).toBe(true);
  });

  it("merges like the other buttons", () => {
    expect(mergeInputs([{ dir: null, bomb: false }, { dir: null, bomb: false, special: true }]).special).toBe(true);
    expect(mergeInputs([{ dir: null, bomb: false }]).special).toBeUndefined();
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

  it("holds the bomb button if any source holds it", () => {
    expect(mergeInputs([{ dir: null, bomb: false }, { dir: null, bomb: false, hold: true }]).hold).toBe(true);
    expect(mergeInputs([{ dir: null, bomb: false }]).hold).toBeUndefined();
  });

  it("is idle with no inputs", () => {
    expect(mergeInputs([])).toEqual({ dir: null, bomb: false, action: false });
  });
});
