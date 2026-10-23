import { describe, expect, it } from "vitest";
import {
  BUBBLE_COOLDOWN,
  BUBBLE_TICKS,
  CHARACTERS,
  createMatch,
  placePlayerAt,
  step,
  type MatchState,
} from "../src";
import { hold, player } from "./helpers";

/** p1 (lantern) at (5,5), p2 (another character) at (9,5). */
function lantern(): MatchState {
  const s = createMatch({ seed: 1, playerIds: ["p1", "p2"], blockDensity: 0, characters: { p1: "lantern" } });
  placePlayerAt(s, "p1", 5, 5);
  placePlayerAt(s, "p2", 9, 5);
  return s;
}

const cast = (s: MatchState) => step(s, { p1: { dir: null, bomb: false, special: true } });

describe("green lantern bubble", () => {
  it("the green lantern is a playable character", () => {
    expect(CHARACTERS).toContain("lantern");
  });

  it(`raises a bubble around him for ${BUBBLE_TICKS / 60} seconds`, () => {
    const s = lantern();
    cast(s);
    expect(player(s).bubble).toBe(BUBBLE_TICKS);
    for (let i = 0; i < BUBBLE_TICKS; i++) step(s);
    expect(player(s).bubble).toBe(0);
  });

  it("fire from any side cannot get to him inside it, while it still burns anyone else", () => {
    const s = lantern();
    cast(s);
    s.flames.push({ x: 5, y: 5, ttl: 10 }, { x: 9, y: 5, ttl: 10 });
    step(s);
    expect(player(s).alive).toBe(true);
    expect(player(s, "p2").alive).toBe(false);
  });

  it("once it is gone fire burns him again", () => {
    const s = lantern();
    cast(s);
    for (let i = 0; i < BUBBLE_TICKS; i++) step(s);
    s.flames.push({ x: 5, y: 5, ttl: 10 });
    step(s);
    expect(player(s).alive).toBe(false);
  });

  it("he moves at half speed inside it", () => {
    const free = lantern();
    hold(free, "up", 20);
    const bubbled = lantern();
    cast(bubbled);
    hold(bubbled, "up", 20);
    const moved = (s: MatchState) => player(lantern()).py - player(s).py;
    expect(moved(bubbled)).toBeGreaterThan(0);
    expect(moved(bubbled)).toBeCloseTo(moved(free) / 2, 0);
  });

  it(`recharges for ${BUBBLE_COOLDOWN / 60} seconds`, () => {
    const s = lantern();
    cast(s);
    expect(player(s).specialCooldown).toBe(BUBBLE_COOLDOWN);
  });
});
