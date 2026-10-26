import { describe, expect, it } from "vitest";
import { GamepadInput, type PadState } from "../src/input/gamepad";
import { ARROWS, KeyboardInput, mergeInputs, WASD } from "../src/input/keyboard";
import { TouchInput } from "../src/input/touch";
import { Predictor } from "../src/net/prediction";

function pad(pressed: number[]): PadState {
  return { buttons: Array.from({ length: 17 }, (_, index) => ({ pressed: pressed.includes(index) })), axes: [0, 0] };
}

describe("kick stop controls", () => {
  it("holds stop on the WASD keyboard and releases on keyup", () => {
    const keys = new KeyboardInput(WASD);
    expect(keys.keyDown("KeyR")).toBe(true);
    expect(keys.sample().stopKick).toBe(true);
    expect(keys.sample().stopKick).toBe(true);
    keys.keyUp("KeyR");
    expect(keys.sample().stopKick).toBeUndefined();
  });

  it("supports a separate key for arrow controls", () => {
    const keys = new KeyboardInput(ARROWS);
    expect(keys.keyDown("Numpad1")).toBe(true);
    expect(keys.sample().stopKick).toBe(true);
    keys.reset();
    expect(keys.sample().stopKick).toBeUndefined();
  });

  it("uses the right gamepad shoulder without triggering other actions", () => {
    let state = pad([5]);
    const gamepad = new GamepadInput(() => state);
    expect(gamepad.sample()).toMatchObject({ bomb: false, action: false, stopKick: true });
    state = pad([]);
    expect(gamepad.sample().stopKick).toBeUndefined();
  });

  it("allows holding and releasing stop on touch", () => {
    const touch = new TouchInput();
    touch.press("stop");
    expect(touch.sample()).toMatchObject({ action: false, stopKick: true });
    expect(touch.sample().stopKick).toBe(true);
    touch.release("stop");
    expect(touch.sample().stopKick).toBeUndefined();
  });

  it("merges stop with independent directional input", () => {
    expect(mergeInputs([{ dir: "right", bomb: false }, { dir: null, bomb: false, stopKick: true }])).toMatchObject({ dir: "right", stopKick: true });
  });

  it("sends both stop transitions without repeatedly resending held state", () => {
    const predictor = new Predictor("me");
    expect(predictor.step({ dir: null, bomb: false, stopKick: true })).toBe(1);
    expect(predictor.step({ dir: null, bomb: false, stopKick: true })).toBeNull();
    expect(predictor.step({ dir: null, bomb: false, stopKick: false })).toBe(2);
  });
});
