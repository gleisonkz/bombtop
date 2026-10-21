import { describe, expect, it } from "vitest";
import { controlStyle, otherStyle } from "../src/input/control-style";

describe("controlStyle", () => {
  it("the d-pad unless the player switched to the stick", () => {
    expect(controlStyle(null)).toBe("dpad");
    expect(controlStyle("junk")).toBe("dpad");
    expect(controlStyle("stick")).toBe("stick");
    expect(controlStyle("dpad")).toBe("dpad");
  });

  it("toggles between the two", () => {
    expect(otherStyle("dpad")).toBe("stick");
    expect(otherStyle("stick")).toBe("dpad");
  });
});
