import { describe, expect, it } from "vitest";
import { AIR_TICKS_PER_TILE, BASE_SPEED, createMatch, placeBomb, placePlayerAt, SPEED_STEP, step, type MatchState } from "../src";
import { player, run } from "./helpers";

const FLIGHT = AIR_TICKS_PER_TILE * 3 + 2;

/** p1 punches a bomb three tiles right onto p2, who carries what `load` gives them. */
function punchOnto(seed: number, load: (p: ReturnType<typeof player>) => void, stage?: "sb4-01"): MatchState {
  const s = createMatch({ seed, playerIds: ["p1", "p2"], blockDensity: 0, ...(stage && { stage }) });
  player(s).canPunch = true;
  placePlayerAt(s, "p2", 4, 5);
  placeBomb(s, "p2");
  placePlayerAt(s, "p2", 7, 5);
  placePlayerAt(s, "p1", 3, 5);
  player(s).facing = "right";
  load(player(s, "p2"));
  step(s, { p1: { dir: null, bomb: false, action: true } });
  run(s, FLIGHT);
  return s;
}

function held(p: ReturnType<typeof player>) {
  return (p.fireRange - 1) + (p.bombCapacity - 1) + (p.speed - BASE_SPEED) / SPEED_STEP
    + [p.canKick, p.canPunch, p.canGlove, p.canPush].filter(Boolean).length;
}

const loaded = (p: ReturnType<typeof player>) => {
  p.fireRange = 6; p.bombCapacity = 6; p.speed = BASE_SPEED + 3 * SPEED_STEP;
  p.canKick = p.canPunch = p.canGlove = p.canPush = true;
};

describe("a bomb coming down on a player (SB4, e-hit-item)", () => {
  it("knocks one to four of their power-ups out, and they are gone", () => {
    const lost = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) {
      const s = punchOnto(seed, loaded);
      const p2 = player(s, "p2");
      expect(p2.stun).toBeGreaterThan(0);
      const n = 5 + 5 + 3 + 4 - held(p2);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(4);
      expect(s.items).toHaveLength(0);
      lost.add(n);
    }
    expect([...lost].sort()).toEqual([1, 2, 3, 4]);
  });

  it("picks each loss among the kinds they hold, not by how many of each", () => {
    let kicks = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const s = punchOnto(seed, p => { p.bombCapacity = 8; p.canKick = true; });
      if (!player(s, "p2").canKick) kicks++;
    }
    // Two kinds held: kick goes in about 1 - (1/2)^~2.5 of hits, far more than its 1 in 8 share of the items.
    expect(kicks).toBeGreaterThan(100);
  });

  it("takes nothing from a player with nothing, nor below the starting fire on an SB4 map", () => {
    const bare = player(punchOnto(3, () => {}), "p2");
    expect([bare.fireRange, bare.bombCapacity, bare.speed]).toEqual([1, 1, BASE_SPEED]);
    for (let seed = 1; seed <= 20; seed++) {
      const p2 = player(punchOnto(seed, p => { p.fireRange = 3; }, "sb4-01"), "p2");
      expect(p2.stun).toBeGreaterThan(0);
      expect(p2.fireRange).toBe(2);
    }
  });

  it("leaves a player carrying a bomb alone", () => {
    const s = createMatch({ seed: 5, playerIds: ["p1", "p2"], blockDensity: 0 });
    player(s).canPunch = true;
    placePlayerAt(s, "p2", 4, 5);
    placeBomb(s, "p2");
    placePlayerAt(s, "p2", 7, 5);
    placePlayerAt(s, "p1", 3, 5);
    player(s).facing = "right";
    const p2 = player(s, "p2");
    loaded(p2);
    placeBomb(s, "p2");
    s.bombs.at(-1)!.heldBy = "p2";
    const carrying = { dir: null, bomb: false, hold: true };
    step(s, { p1: { dir: null, bomb: false, action: true }, p2: carrying });
    run(s, FLIGHT, { p2: carrying });
    expect(held(p2)).toBe(17);
  });
});
