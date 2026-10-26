import { describe, expect, it } from "vitest";
import { SPECIAL_COOLDOWN } from "@bombtop/shared";
import { staticPowerLook } from "../src/render/static-power";

describe("Static electrical charge", () => {
  it("holds a visible body effect after the short pull has ended", () => {
    expect(staticPowerLook(SPECIAL_COOLDOWN - 20)?.alpha).toBe(1);
    expect(staticPowerLook(SPECIAL_COOLDOWN - 38)?.alpha).toBe(1);
    expect(staticPowerLook(SPECIAL_COOLDOWN - 50)?.alpha).toBe(0.5);
  });
  it("stops without stale aura when the special is ready or finished", () => {
    expect(staticPowerLook(0)).toBeNull();
    expect(staticPowerLook(SPECIAL_COOLDOWN - 60)).toBeNull();
    expect(staticPowerLook(SPECIAL_COOLDOWN + 1)).toBeNull();
  });
});
