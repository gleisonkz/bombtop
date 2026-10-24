import { describe, expect, it } from "vitest";
import {
  Bot,
  CHARACTERS,
  createMatch,
  placeBomb,
  placePlayerAt,
  SNEAK_TICKS,
  SPECIAL_COOLDOWN,
  step,
  TICK_RATE,
  type MatchState,
} from "../src";
import { center, emptyMatch, player, run } from "./helpers";

/** p1 (the panther) at (3,5). */
function alone(): MatchState {
  const s = createMatch({ seed: 1, playerIds: ["p1", "p2"], blockDensity: 0, characters: { p1: "panther", p2: "bomb" } });
  placePlayerAt(s, "p1", 3, 5);
  placePlayerAt(s, "p2", 9, 9);
  return s;
}

const cast = (s: MatchState, id = "p1") => step(s, { [id]: { dir: null, bomb: false, special: true } });

describe("the pink panther's tiptoe", () => {
  it("the panther is a playable character", () => {
    expect(CHARACTERS).toContain("panther");
  });

  it(`sneaks out of sight for ${SNEAK_TICKS / TICK_RATE} seconds, then shows again`, () => {
    const s = alone();
    cast(s);
    expect(player(s).sneak).toBeGreaterThanOrEqual(SNEAK_TICKS - 1);
    run(s, SNEAK_TICKS);
    expect(player(s).sneak).toBe(0);
  });

  it("walks as fast as ever while out of sight", () => {
    const plain = alone();
    const sneaking = alone();
    cast(sneaking);
    run(plain, 20, { p1: { dir: "up", bomb: false } });
    run(sneaking, 20, { p1: { dir: "up", bomb: false } });
    expect(player(sneaking).py).toBe(player(plain).py);
  });

  it("flames still catch him", () => {
    const s = alone();
    cast(s);
    placeBomb(s, "p1");
    run(s, 4 * TICK_RATE);
    expect(player(s).alive).toBe(false);
  });

  it(`recharges for ${SPECIAL_COOLDOWN / TICK_RATE} seconds`, () => {
    const s = alone();
    cast(s);
    expect(player(s).specialCooldown).toBe(SPECIAL_COOLDOWN);
  });

  it("bots do not hunt a rival they cannot see", () => {
    const s = emptyMatch();
    const me = player(s);
    const target = player(s, "p2");
    target.px = center(9);
    target.py = center(1);
    target.sneak = 10 * TICK_RATE;
    const bot = new Bot(me.id, "hard", "hunter");
    const before = me.px;
    for (let i = 0; i < 2 * TICK_RATE; i++) step(s, { [me.id]: bot.input(s) });
    expect(me.px).toBeLessThanOrEqual(before);
  });
});
