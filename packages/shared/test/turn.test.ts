import { describe, expect, it } from "vitest";
import { sanitizeInput, step, TILE } from "../src";
import { center, emptyMatch, player } from "./helpers";

describe("diagonal input (dir + alt)", () => {
  it("prefers the main direction when it is free", () => {
    const s = emptyMatch();
    step(s, { p1: { dir: "right", alt: "down", bomb: false } });
    expect(player(s).px).toBeGreaterThan(center(1));
    expect(player(s).py).toBe(center(1));
  });

  it("keeps moving along `alt` while the main direction is blocked", () => {
    const s = emptyMatch();
    // Left of (1,1) is the border wall: the player keeps going down instead of stopping.
    step(s, { p1: { dir: "left", alt: "down", bomb: false } });
    expect(player(s).px).toBe(center(1));
    expect(player(s).py).toBeGreaterThan(center(1));
    expect(player(s).facing).toBe("down");
  });

  it("turns into the opening as soon as it reaches it", () => {
    const s = emptyMatch();
    const p = player(s);
    p.px = center(3);
    p.py = center(2); // pillar row: (2,2) is a wall, (2,3) is open
    for (let i = 0; i < 2 * (TILE / p.speed); i++) step(s, { p1: { dir: "left", alt: "down", bomb: false } });
    expect(p.px).toBeLessThan(center(3));
    expect(Math.floor(p.py / TILE)).toBe(3);
    expect(p.facing).toBe("left");
  });

  it("accepts alt from the network only when it is a real direction", () => {
    expect(sanitizeInput({ dir: "left", alt: "down" }).alt).toBe("down");
    expect(sanitizeInput({ dir: "left", alt: "sideways" }).alt).toBeUndefined();
    expect(sanitizeInput({ dir: "left", alt: "left" }).alt).toBeUndefined();
  });
});
