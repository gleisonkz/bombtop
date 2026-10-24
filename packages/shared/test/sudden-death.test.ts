import { describe, expect, it } from "vitest";
import {
  getTile,
  ItemKind,
  matchResult,
  placeBomb,
  placePlayerAt,
  PRESSURE_INTERVAL,
  pressureOrder,
  ROUND_TICKS,
  step,
  Tile,
} from "../src";
import { emptyMatch, player, run } from "./helpers";

function atSuddenDeath() {
  const s = emptyMatch();
  placePlayerAt(s, "p1", 5, 5);
  placePlayerAt(s, "p2", 7, 5);
  s.tick = ROUND_TICKS;
  return s;
}

describe("pressure order", () => {
  it("spirals inward clockwise from the top-left corner over interior tiles", () => {
    const order = pressureOrder(13, 11);
    expect(order.slice(0, 3)).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ]);
    expect(order[10]).toEqual({ x: 11, y: 1 });
    expect(order[11]).toEqual({ x: 11, y: 2 });
    expect(order).toHaveLength(11 * 9);
    expect(new Set(order.map((t) => `${t.x},${t.y}`)).size).toBe(order.length);
  });
});

describe("sudden death", () => {
  it("nothing falls before time runs out", () => {
    const s = emptyMatch();
    run(s, 100);
    expect(getTile(s, 1, 1)).toBe(Tile.Empty);
  });

  it("walls fall along the spiral once time is up", () => {
    const s = atSuddenDeath();
    step(s);
    expect(getTile(s, 1, 1)).toBe(Tile.Wall);
    run(s, PRESSURE_INTERVAL);
    expect(getTile(s, 2, 1)).toBe(Tile.Wall);
  });

  it("skips tiles that are already walls without waiting", () => {
    const s = atSuddenDeath();
    // The outer interior ring has 44 tiles; the next ring starts on pillar (2,2),
    // which is skipped, so the 45th fall lands on (3,2).
    run(s, PRESSURE_INTERVAL * 44 + 1);
    expect(getTile(s, 3, 2)).toBe(Tile.Wall);
  });

  it("a falling wall crushes players, even mounted or invulnerable ones", () => {
    const s = atSuddenDeath();
    placePlayerAt(s, "p1", 1, 1);
    player(s).mount = "dasher";
    player(s).invuln = 100;
    step(s);
    expect(player(s).alive).toBe(false);
  });

  it("a falling wall destroys bombs and items under it", () => {
    const s = atSuddenDeath();
    placePlayerAt(s, "p2", 1, 1);
    placeBomb(s, "p2");
    placePlayerAt(s, "p2", 7, 5);
    s.items.push({ x: 2, y: 1, kind: ItemKind.Fire });
    run(s, PRESSURE_INTERVAL + 1);
    expect(s.bombs).toHaveLength(0);
    expect(s.items).toHaveLength(0);
  });
});

describe("match result", () => {
  it("is ongoing while two or more players live", () => {
    expect(matchResult(emptyMatch())).toEqual({ over: false });
  });

  it("names the last player standing", () => {
    const s = emptyMatch();
    player(s, "p2").alive = false;
    expect(matchResult(s)).toEqual({ over: true, winnerId: "p1" });
  });

  it("is a draw when nobody survives", () => {
    const s = emptyMatch();
    player(s).alive = false;
    player(s, "p2").alive = false;
    expect(matchResult(s)).toEqual({ over: true, winnerId: null });
  });

  it("a solo match is never over by count alone", () => {
    const s = emptyMatch(["p1"]);
    expect(matchResult(s)).toEqual({ over: false });
  });
});
