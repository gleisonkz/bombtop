import { describe, expect, it } from "vitest";
import { FUSE_TICKS } from "@bombtop/shared";
import { bombLook } from "../src/render/sprites";

describe("Bomber mega bomb", () => {
  it("keeps its spherical proportions throughout its fuse and pulse", () => {
    for (let tick = 0; tick < FUSE_TICKS; tick++) {
      const look = bombLook({ fuse: FUSE_TICKS - tick, tick, type: "normal", mega: true });
      expect(look.sx).toBe(look.sy);
      expect(look.sx).toBeGreaterThan(1.3);
    }
  });
});
