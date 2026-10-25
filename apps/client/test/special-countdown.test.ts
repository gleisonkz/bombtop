import { describe, expect, it } from "vitest";
import { TICK_RATE } from "@bombtop/shared";
import { specialCountdown } from "../src/ui/special-countdown";

describe("specialCountdown", () => {
  it("is null when the special is ready", () => {
    expect(specialCountdown(0)).toBeNull();
    expect(specialCountdown(-3)).toBeNull();
  });

  it("counts whole seconds left, rounding up", () => {
    expect(specialCountdown(20 * TICK_RATE)).toBe("20");
    expect(specialCountdown(20 * TICK_RATE - 1)).toBe("20");
    expect(specialCountdown(TICK_RATE + 1)).toBe("2");
    expect(specialCountdown(TICK_RATE)).toBe("1");
    expect(specialCountdown(1)).toBe("1");
  });
});
