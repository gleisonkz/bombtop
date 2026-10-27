import { describe, expect, it } from "vitest";
import { createMatch } from "../src/arena";
import { Bot } from "../src/bot";
import { addFlame, placeBomb, updateBombs } from "../src/bombs";
import { effectiveFuse } from "../src/curse";
import { FUSE_TICKS, TICK_RATE } from "../src/constants";
import { SB4_STAGES, type StageId } from "../src/stage";
import { hasFlame, placePlayerAt, setTile, Tile } from "../src/state";
import { step } from "../src/step";

function match(stage: StageId = "sb4-11") {
  return createMatch({ seed: 17, stage, playerIds: ["a", "b"], blockDensity: 0 });
}

// ROM evidence: bomb-first-ten-frames.json and bomb-timer-write-trace.json;
// C1:1FC7 initializes 126, C1:3CE9 first decrements on the following update.
describe("SB4 normal bomb fuse observed in the ROM", () => {
  it.each(SB4_STAGES)("places a normal bomb with fuse 126 on %s", stage => {
    const s = match(stage);
    expect(placeBomb(s, "a")).toBe(true);
    expect(s.bombs[0]?.fuse).toBe(126);
    expect(effectiveFuse(s.players[0]!, stage)).toBe(126);
  });

  it("samples 126 at input spawn, followed by 125 through 118", () => {
    const s = match();
    step(s, { a: { dir: null, bomb: true } });
    const samples = [s.bombs[0]?.fuse];
    for (let tick = 0; tick < 8; tick++) {
      step(s);
      samples.push(s.bombs[0]?.fuse);
    }
    expect(samples).toEqual([126, 125, 124, 123, 122, 121, 120, 119, 118]);
  });

  it("explodes on the 126th update after input creation", () => {
    const s = match();
    step(s, { a: { dir: null, bomb: true } });
    placePlayerAt(s, "a", 3, 1);
    for (let tick = 0; tick < 125; tick++) step(s);
    expect(s.bombs[0]?.fuse).toBe(1);
    expect(hasFlame(s, 1, 1)).toBe(false);
    step(s);
    expect(s.bombs).toHaveLength(0);
    expect(hasFlame(s, 1, 1)).toBe(true);
  });

  it("counts the first subsequent step after direct placement", () => {
    const s = match();
    placeBomb(s, "a");
    step(s);
    expect(s.bombs[0]?.fuse).toBe(125);
  });

  it("still ignites a fresh bomb already touching a flame", () => {
    const s = match();
    placeBomb(s, "a");
    addFlame(s, 1, 1, "b");
    updateBombs(s);
    expect(s.bombs).toHaveLength(0);
    expect(hasFlame(s, 1, 1)).toBe(true);
  });

  it("still chains into a fresh bomb from an adjacent explosion", () => {
    const s = match();
    placePlayerAt(s, "b", 2, 1);
    expect(placeBomb(s, "b")).toBe(true);
    s.bombs[0]!.fuse = 0;
    expect(placeBomb(s, "a")).toBe(true);
    updateBombs(s);
    expect(s.bombs).toHaveLength(0);
    expect(hasFlame(s, 1, 1)).toBe(true);
  });

  it("keeps carried bombs paused after their creation tick", () => {
    const s = match();
    placeBomb(s, "a");
    const bomb = s.bombs[0]!;
    bomb.heldBy = "a";
    s.tick++;
    updateBombs(s);
    expect(bomb.fuse).toBe(126);
    bomb.heldBy = null;
    s.tick++;
    updateBombs(s);
    expect(bomb.fuse).toBe(125);
  });
});

describe("fuse compatibility and unverified ROM variants", () => {
  it("forecasts the shorter SB4 escape window before choosing to bomb", () => {
    const decisions = (["classic", "sb4-01"] as const).map(stage => {
      const s = match(stage);
      const p = s.players[0]!;
      p.speed = 4;
      p.specialCooldown = 999;
      setTile(s, 2, 1, Tile.Block);
      return new Bot("a", "hard", "demolisher").input(s).bomb;
    });
    expect(decisions).toEqual([true, false]);
  });

  it.each(["classic", "conveyor", "warp"] as const)("preserves 180 and spawn decrement on %s", stage => {
    const s = match(stage);
    expect(effectiveFuse(s.players[0]!)).toBe(FUSE_TICKS);
    expect(effectiveFuse(s.players[0]!, stage)).toBe(180);
    placeBomb(s, "a");
    expect(s.bombs[0]?.fuse).toBe(180);
    updateBombs(s);
    expect(s.bombs[0]?.fuse).toBe(179);
    const input = match(stage);
    step(input, { a: { dir: null, bomb: true } });
    expect(input.bombs[0]?.fuse).toBe(179);
  });

  // Short/long curses and map 02 tempo remain provisional, not ROM parity claims.
  it.each([["shortFuse", TICK_RATE], ["longFuse", 4 * TICK_RATE]] as const)("preserves provisional %s", (kind, fuse) => {
    const s = match();
    s.players[0]!.curse = { kind };
    expect(effectiveFuse(s.players[0]!, s.stage)).toBe(fuse);
    step(s, { a: { dir: null, bomb: true } });
    expect(s.bombs[0]?.fuse).toBe(fuse - 1);
  });

  it.each(["remote", "pierce"] as const)("preserves unverified %s timing", type => {
    const s = match();
    s.players[0]!.bombType = type;
    expect(effectiveFuse(s.players[0]!, s.stage)).toBe(180);
    step(s, { a: { dir: null, bomb: true } });
    expect(s.bombs[0]?.fuse).toBe(type === "remote" ? 180 : 179);
  });

  it.each([[0.5, 126], [1, 125], [2, 124]] as const)("retains provisional map 02 tempo %s after spawn", (tempo, nextFuse) => {
    const s = match("sb4-02");
    s.tempo = tempo;
    s.tick = 1;
    step(s, { a: { dir: null, bomb: true } });
    expect(s.bombs[0]?.fuse).toBe(126);
    step(s);
    expect(s.bombs[0]?.fuse).toBe(nextFuse);
  });
});
