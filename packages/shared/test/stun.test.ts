import { describe, expect, it } from "vitest";
import { createMatch, placeBomb, placePlayerAt, steer, step, tryKick, FUSE_TICKS, STUN_TICKS, TICK_RATE, TILE } from "../src";
import { emptyMatch, player, run } from "./helpers";

describe("stun escape window", () => {
  it("lets a special victim escape a fresh bomb at base speed", () => {
    const s = createMatch({ seed: 1, playerIds: ["p1", "p2"], blockDensity: 0, characters: { p1: "thor" } });
    placePlayerAt(s, "p1", 3, 5);
    placePlayerAt(s, "p2", 5, 5);
    const attacker = player(s);
    const victim = player(s, "p2");
    attacker.facing = "right";
    step(s, { p1: { dir: null, bomb: false, special: true } });
    expect(victim.stun).toBeGreaterThan(0);
    placePlayerAt(s, "p1", 5, 5);
    placeBomb(s, "p1");
    placePlayerAt(s, "p1", 1, 1);
    run(s, FUSE_TICKS, { p2: { dir: "down", bomb: false } });
    expect(s.bombs).toHaveLength(0);
    expect(victim.alive).toBe(true);
    expect(victim.py).toBeGreaterThan(7 * TILE);
  });

  it("releases a bomb-hit victim after three quarters of a second", () => {
    const s = emptyMatch();
    const p = player(s);
    p.stun = STUN_TICKS;
    const start = p.px;
    run(s, Math.round(TICK_RATE * 0.75) + 1, { p1: { dir: "right", bomb: false } });
    expect(p.px).toBeGreaterThan(start);
  });
});

describe("stun input lock", () => {
  it("blocks direct steering, including diagonal fallback", () => {
    const s = emptyMatch();
    const p = player(s);
    p.stun = 1;
    const { px, py } = p;
    expect(steer(s, p, "right", "down")).toBeNull();
    expect(p).toMatchObject({ px, py });
  });

  it("blocks direct kicks on the last stun tick", () => {
    const s = emptyMatch();
    const p = player(s);
    p.canKick = true;
    p.stun = 1;
    placePlayerAt(s, "p2", 2, 1);
    placeBomb(s, "p2");
    tryKick(s, p, "right");
    expect(s.bombs[0]!.slide).toBeNull();
  });

  it("ignores input on the last stun tick and resumes on the next", () => {
    const s = emptyMatch();
    const p = player(s);
    p.stun = 1;
    const { px, py, facing } = p;
    const inputs = { p1: { dir: "right" as const, bomb: true, special: true, action: true } };
    step(s, inputs);
    expect(p).toMatchObject({ px, py, facing, stun: 0 });
    expect(s.bombs).toHaveLength(0);
    step(s, { p1: { dir: "right", bomb: false } });
    expect(p.px).toBeGreaterThan(px);
  });

  it("resumes a held kick only after the last stun tick", () => {
    const s = emptyMatch();
    const p = player(s);
    p.canKick = true;
    p.stun = 1;
    placePlayerAt(s, "p2", 2, 1);
    placeBomb(s, "p2");
    placePlayerAt(s, "p2", 13, 11);
    const inputs = { p1: { dir: "right" as const, bomb: false } };
    step(s, inputs);
    expect(s.bombs[0]).toMatchObject({ x: 2, slide: null, offset: 0 });
    step(s, inputs);
    expect(s.bombs[0]!.slide).toBe("right");
  });

  it("stops movement immediately when a special stuns its own caster", () => {
    const s = createMatch({ seed: 1, playerIds: ["p1", "p2"], blockDensity: 0, characters: { p1: "thor", p2: "captain" } });
    placePlayerAt(s, "p1", 3, 5);
    placePlayerAt(s, "p2", 5, 5);
    player(s, "p2").shield = 100;
    player(s, "p2").facing = "left";
    const p = player(s);
    const { px, py } = p;
    step(s, { p1: { dir: "right", bomb: false, special: true } });
    expect(p.stun).toBeGreaterThan(0);
    expect(p).toMatchObject({ px, py, facing: "right" });
  });
});
