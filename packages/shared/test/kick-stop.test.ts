import { describe, expect, it } from "vitest";
import { InputQueue, placeBomb, placePlayerAt, step } from "../src";
import { emptyMatch, hold, player, run } from "./helpers";

function slidingBomb(owner: "p1" | "p2") {
  const s = emptyMatch();
  player(s).canKick = true;
  placePlayerAt(s, owner, 3, 1);
  expect(placeBomb(s, owner)).toBe(true);
  placePlayerAt(s, owner, owner === "p1" ? 1 : 13, owner === "p1" ? 1 : 11);
  hold(s, "right", 20);
  const bomb = s.bombs[0]!;
  expect(bomb.slide).toBe("right");
  return { s, bomb };
}

describe("manual kick stop", () => {
  it("halts a sliding bomb placed by the player and preserves its fuse", () => {
    const { s, bomb } = slidingBomb("p1");
    const x = bomb.x;
    const fuse = bomb.fuse;
    step(s, { p1: { dir: null, bomb: false, stopKick: true } });
    expect(bomb.slide).toBeNull();
    expect(bomb.offset).toBe(0);
    expect(bomb.fuse).toBe(fuse - 1);
    run(s, 20);
    expect(bomb.x).toBe(x);
  });

  it("cannot stop a bomb placed by another player", () => {
    const { s, bomb } = slidingBomb("p2");
    step(s, { p1: { dir: null, bomb: false, stopKick: true } });
    expect(bomb.slide).toBe("right");
  });

  it("prevents kicking the stopped bomb again while the stop button stays held", () => {
    const { s, bomb } = slidingBomb("p1");
    step(s, { p1: { dir: null, bomb: false, stopKick: true } });
    placePlayerAt(s, "p1", bomb.x - 1, bomb.y);
    step(s, { p1: { dir: "right", bomb: false, stopKick: true } });
    expect(bomb.slide).toBeNull();
    step(s, { p1: { dir: "right", bomb: false } });
    expect(bomb.slide).toBe("right");
  });

  it("holds and releases the stop command through the server jitter buffer", () => {
    const queue = new InputQueue();
    queue.push({ dir: null, bomb: false, stopKick: true }, 1, undefined, 0);
    expect(queue.take(0).stopKick).toBe(true);
    expect(queue.take(1).stopKick).toBe(true);
    queue.push({ dir: null, bomb: false, stopKick: false }, 2, undefined, 2);
    expect(queue.take(2).stopKick).toBeFalsy();
  });

  it("preserves stop release through jitter-buffer movement coalescing", () => {
    const queue = new InputQueue();
    queue.push({ dir: "right", bomb: false, stopKick: true }, 1, 0, 4);
    queue.push({ dir: "right", bomb: false, stopKick: false }, 2, 1, 5);
    const sampled = Array.from({ length: 11 }, (_, tick) => queue.take(tick).stopKick ?? false);
    expect(sampled).toContain(true);
    expect(sampled.at(-1)).toBe(false);
  });
});
