import { describe, expect, it } from "vitest";
import {
  BASE_SPEED,
  createMatch,
  placeBomb,
  placePlayerAt,
  playerTile,
  setTile,
  step,
  TILE,
  Tile,
  type Direction,
  type MatchState,
} from "../src";

const HALF = TILE / 2;
const center = (t: number) => t * TILE + HALF;

function match(): MatchState {
  return createMatch({ seed: 1, playerIds: ["p1", "p2"], blockDensity: 0 });
}

function hold(s: MatchState, dir: Direction, ticks: number, id = "p1") {
  for (let i = 0; i < ticks; i++) step(s, { [id]: { dir, bomb: false } });
}

const p1 = (s: MatchState) => s.players[0]!;

/** Enough ticks to cross several tiles at base speed. */
const LONG = Math.ceil((TILE * 4) / BASE_SPEED);

describe("positions", () => {
  it("placePlayerAt puts the player on the tile center", () => {
    const s = match();
    placePlayerAt(s, "p1", 3, 5);
    expect(p1(s).px).toBe(center(3));
    expect(p1(s).py).toBe(center(5));
    expect(playerTile(p1(s))).toEqual({ x: 3, y: 5 });
  });

  it("players spawn with base speed", () => {
    expect(p1(match()).speed).toBe(BASE_SPEED);
  });
});

describe("free movement", () => {
  it("moves by `speed` units per tick", () => {
    const s = match();
    placePlayerAt(s, "p1", 1, 1);
    hold(s, "right", 1);
    expect(p1(s).px).toBe(center(1) + BASE_SPEED);
    expect(p1(s).py).toBe(center(1));
  });

  it("moves in all four directions", () => {
    const s = match();
    placePlayerAt(s, "p1", 5, 5);
    hold(s, "up", 1);
    expect(p1(s).py).toBe(center(5) - BASE_SPEED);
    placePlayerAt(s, "p1", 5, 5);
    hold(s, "down", 1);
    expect(p1(s).py).toBe(center(5) + BASE_SPEED);
    placePlayerAt(s, "p1", 5, 5);
    hold(s, "left", 1);
    expect(p1(s).px).toBe(center(5) - BASE_SPEED);
  });

  it("does not move without input", () => {
    const s = match();
    placePlayerAt(s, "p1", 1, 1);
    hold(s, null, 5);
    expect(playerTile(p1(s))).toEqual({ x: 1, y: 1 });
    expect(p1(s).px).toBe(center(1));
  });

  it("crosses into the next tile", () => {
    const s = match();
    placePlayerAt(s, "p1", 1, 1);
    hold(s, "right", Math.ceil(TILE / BASE_SPEED));
    expect(playerTile(p1(s))).toEqual({ x: 2, y: 1 });
  });

  it("dead players do not move", () => {
    const s = match();
    placePlayerAt(s, "p1", 1, 1);
    p1(s).alive = false;
    hold(s, "right", 5);
    expect(p1(s).px).toBe(center(1));
  });
});

describe("collision", () => {
  it("stops at the tile center in front of a wall", () => {
    const s = match();
    placePlayerAt(s, "p1", 1, 1);
    hold(s, "left", LONG); // border wall at x=0
    expect(p1(s).px).toBe(center(1));
  });

  it("cannot walk into a pillar", () => {
    const s = match();
    placePlayerAt(s, "p1", 1, 2);
    hold(s, "right", LONG); // pillar at (2,2)
    expect(p1(s).px).toBe(center(1));
  });

  it("cannot walk into a block", () => {
    const s = match();
    setTile(s, 4, 1, Tile.Block);
    placePlayerAt(s, "p1", 1, 1);
    hold(s, "right", LONG);
    expect(p1(s).px).toBe(center(3));
  });

  it("can walk off a bomb it is standing on", () => {
    const s = match();
    placePlayerAt(s, "p1", 3, 1);
    placeBomb(s, "p1");
    hold(s, "right", Math.ceil(TILE / BASE_SPEED));
    expect(playerTile(p1(s))).toEqual({ x: 4, y: 1 });
  });

  it("cannot walk back onto a bomb after leaving it", () => {
    const s = match();
    placePlayerAt(s, "p1", 3, 1);
    placeBomb(s, "p1");
    hold(s, "right", Math.ceil(TILE / BASE_SPEED) * 2);
    hold(s, "left", LONG);
    expect(playerTile(p1(s))).toEqual({ x: 4, y: 1 });
    expect(p1(s).px).toBe(center(4));
  });

  it("cannot walk into someone else's bomb", () => {
    const s = match();
    placePlayerAt(s, "p2", 5, 1);
    placeBomb(s, "p2");
    placePlayerAt(s, "p2", 9, 9);
    placePlayerAt(s, "p1", 1, 1);
    hold(s, "right", LONG);
    expect(p1(s).px).toBe(center(4));
  });
});

describe("corner sliding", () => {
  it("re-aligns to the lane when moving while slightly off-center", () => {
    const s = match();
    placePlayerAt(s, "p1", 1, 1);
    p1(s).py = center(1) + 3 * BASE_SPEED;
    hold(s, "right", LONG);
    expect(p1(s).py).toBe(center(1));
    expect(playerTile(p1(s)).x).toBeGreaterThan(1);
  });

  it("slides into the adjacent free lane when the path ahead is blocked", () => {
    const s = match();
    // (3,2) is between pillars (2,2) and (4,2); row 3 is open.
    placePlayerAt(s, "p1", 3, 2);
    p1(s).py = center(2) + HALF - 1; // nearly in row 3
    hold(s, "right", LONG);
    expect(playerTile(p1(s)).y).toBe(3);
    expect(playerTile(p1(s)).x).toBeGreaterThan(3);
    expect(p1(s).py).toBe(center(3));
  });

  it("slides upward too", () => {
    const s = match();
    placePlayerAt(s, "p1", 3, 2);
    p1(s).py = center(2) - HALF + 1; // nearly in row 1
    hold(s, "right", LONG);
    expect(playerTile(p1(s)).y).toBe(1);
    expect(playerTile(p1(s)).x).toBeGreaterThan(3);
  });

  it("does not slide when both lanes are blocked", () => {
    const s = match();
    setTile(s, 4, 1, Tile.Block);
    placePlayerAt(s, "p1", 3, 1);
    p1(s).py = center(1) + 2;
    hold(s, "right", LONG);
    expect(playerTile(p1(s))).toEqual({ x: 3, y: 1 });
  });
});

describe("inputs", () => {
  it("places a bomb when the bomb button is pressed", () => {
    const s = match();
    placePlayerAt(s, "p1", 3, 1);
    step(s, { p1: { dir: null, bomb: true } });
    expect(s.bombs).toHaveLength(1);
    expect(s.bombs[0]).toMatchObject({ x: 3, y: 1 });
  });
});
