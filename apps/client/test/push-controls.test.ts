import { describe, expect, it } from "vitest";
import { createMatch, publicView, type Snapshot } from "@bombtop/shared";
import { GamepadInput, type PadState } from "../src/input/gamepad";
import { ARROWS, KeyboardInput, mergeInputs, WASD } from "../src/input/keyboard";
import { TouchInput } from "../src/input/touch";
import { Predictor } from "../src/net/prediction";

function pad(pressed: number[]): PadState {
  return { buttons: Array.from({ length: 17 }, (_, index) => ({ pressed: pressed.includes(index) })), axes: [0, 0] };
}

describe("Push defense on controllers", () => {
  it("holds defense on the left player's keyboard and releases it on keyup", () => {
    const keys = new KeyboardInput(WASD);
    expect(keys.keyDown("KeyQ")).toBe(true);
    expect(keys.sample().brace).toBe(true);
    expect(keys.sample().brace).toBe(true);
    keys.keyUp("KeyQ");
    expect(keys.sample().brace).toBeUndefined();
  });

  it("uses a separate defense key on the arrow keyboard", () => {
    const keys = new KeyboardInput(ARROWS);
    expect(keys.keyDown("Numpad0")).toBe(true);
    expect(keys.sample().brace).toBe(true);
    keys.reset();
    expect(keys.sample().brace).toBeUndefined();
  });

  it("reads the left shoulder of a standard gamepad as held defense", () => {
    let state = pad([4]);
    const gamepad = new GamepadInput(() => state);
    expect(gamepad.sample()).toMatchObject({ bomb: false, action: false, brace: true });
    expect(gamepad.sample().brace).toBe(true);
    state = pad([]);
    expect(gamepad.sample().brace).toBeUndefined();
  });

  it("allows a touch button to hold defense without producing extra action presses", () => {
    const touch = new TouchInput();
    touch.press("brace");
    expect(touch.sample()).toMatchObject({ action: false, brace: true });
    expect(touch.sample().brace).toBe(true);
    touch.release("brace");
    expect(touch.sample().brace).toBeUndefined();
  });

  it("merges defense with steering and other buttons", () => {
    expect(mergeInputs([{ dir: "right", bomb: false }, { dir: null, bomb: false, brace: true }])).toMatchObject({ dir: "right", brace: true });
  });

  it("sends defense transitions to the server and does not predict walking while braced", () => {
    const predictor = new Predictor("me");
    const snapshot: Snapshot = { ...publicView(createMatch({ seed: 7, playerIds: ["me", "them"], blockDensity: 0 })), acks: {} };
    const initial = snapshot.players[0]!;
    expect(predictor.step({ dir: "right", bomb: false, brace: true })).toBe(1);
    expect(predictor.step({ dir: "right", bomb: false, brace: true })).toBeNull();
    expect(predictor.predict(snapshot)!.px).toBe(initial.px);
    expect(predictor.step({ dir: "right", bomb: false, brace: false })).toBe(2);
    expect(predictor.predict(snapshot)!.px).toBeGreaterThan(initial.px);
  });
});
