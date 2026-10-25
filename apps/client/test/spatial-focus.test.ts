import { describe, expect, it } from "vitest";
import { nextFocus, type Box } from "../src/ui/spatial-focus";

const box = (x: number, y: number, w = 100, h = 40): Box => ({ left: x, top: y, width: w, height: h });

// A menu card: a column of wide buttons, then a row of two.
const column = [box(0, 0, 200), box(0, 60, 200), box(0, 120, 200), box(0, 180), box(110, 180)];

describe("nextFocus", () => {
  it("starts on the first box when nothing has focus", () => {
    expect(nextFocus(null, column, "down")).toBe(0);
  });

  it("goes down and up the column", () => {
    expect(nextFocus(0, column, "down")).toBe(1);
    expect(nextFocus(1, column, "down")).toBe(2);
    expect(nextFocus(2, column, "up")).toBe(1);
  });

  it("stays put at an edge", () => {
    expect(nextFocus(0, column, "up")).toBe(0);
    expect(nextFocus(4, column, "right")).toBe(4);
  });

  it("walks along a row", () => {
    expect(nextFocus(3, column, "right")).toBe(4);
    expect(nextFocus(4, column, "left")).toBe(3);
  });

  it("from a wide button down, takes the nearest below, not one farther along the way", () => {
    expect(nextFocus(2, column, "down")).toBe(3);
  });

  it("prefers a box straight ahead over a nearer one off to the side", () => {
    const boxes = [box(0, 0), box(300, 50), box(0, 100)];
    expect(nextFocus(0, boxes, "down")).toBe(2);
  });

  it("from a box gone from the list, starts on the first", () => {
    expect(nextFocus(9, column, "down")).toBe(0);
  });
});
