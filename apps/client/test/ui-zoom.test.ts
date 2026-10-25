import { describe, expect, it } from "vitest";
import { uiZoom } from "../src/ui/ui-zoom";

describe("uiZoom", () => {
  it("leaves phones, tablets and laptops as they are", () => {
    expect(uiZoom(390, 844)).toBe(1);
    expect(uiZoom(932, 430)).toBe(1);
    expect(uiZoom(1366, 1024)).toBe(1);
    expect(uiZoom(1440, 820)).toBe(1);
  });

  it("grows the screens on a TV, as far as the height allows", () => {
    expect(uiZoom(1920, 1080)).toBeCloseTo(1080 / 820);
    expect(uiZoom(2560, 1080)).toBeCloseTo(1080 / 820); // ultrawide: the height decides
    expect(uiZoom(1920, 1600)).toBeCloseTo(1920 / 1440); // tall: the width decides
  });

  it("stops at 2x on the biggest screens", () => {
    expect(uiZoom(3840, 2160)).toBe(2);
  });
});
