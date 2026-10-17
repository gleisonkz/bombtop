import { describe, expect, it } from "vitest";
import { FUSE_TICKS, hasFlame, ItemKind, placeBomb, placePlayerAt, step } from "../src";
import { emptyMatch, player, press, run } from "./helpers";

function remoteMatch() {
  const s = emptyMatch();
  player(s).bombType = "remote";
  player(s).bombCapacity = 3;
  return s;
}

function drop(s: ReturnType<typeof emptyMatch>, x: number, y: number, id = "p1") {
  placePlayerAt(s, id, x, y);
  placeBomb(s, id);
  return s.bombs.at(-1)!;
}

describe("remote bombs", () => {
  it("the remote item switches the bomb type", () => {
    const s = emptyMatch();
    s.items.push({ x: 1, y: 1, kind: ItemKind.Remote });
    step(s);
    expect(player(s).bombType).toBe("remote");
  });

  it("do not explode on their own", () => {
    const s = remoteMatch();
    const b = drop(s, 5, 5);
    placePlayerAt(s, "p1", 1, 1);
    run(s, FUSE_TICKS * 3);
    expect(s.bombs).toContain(b);
  });

  it("the action button detonates the oldest one", () => {
    const s = remoteMatch();
    const first = drop(s, 5, 5);
    const second = drop(s, 9, 5);
    placePlayerAt(s, "p1", 1, 1);
    press(s, "action");
    expect(s.bombs).not.toContain(first);
    expect(s.bombs).toContain(second);
    expect(hasFlame(s, 5, 5)).toBe(true);
    press(s, "action");
    expect(s.bombs).not.toContain(second);
  });

  it("the action button does nothing without remote bombs", () => {
    const s = emptyMatch();
    const b = drop(s, 5, 5);
    placePlayerAt(s, "p1", 1, 1);
    press(s, "action");
    expect(s.bombs).toContain(b);
  });

  it("are detonated by other explosions", () => {
    const s = remoteMatch();
    const remote = drop(s, 5, 5);
    drop(s, 6, 5, "p2");
    placePlayerAt(s, "p1", 1, 1);
    placePlayerAt(s, "p2", 11, 9);
    run(s, FUSE_TICKS);
    expect(s.bombs).not.toContain(remote);
  });

  it("start a normal fuse when their owner dies", () => {
    const s = remoteMatch();
    const b = drop(s, 5, 5);
    placePlayerAt(s, "p1", 1, 1);
    player(s).alive = false;
    run(s, FUSE_TICKS);
    expect(s.bombs).not.toContain(b);
  });
});
