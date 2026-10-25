import { describe, expect, it } from "vitest";
import {
  BASE_SPEED,
  createMatch,
  CURSES,
  FUSE_TICKS,
  ItemKind,
  MAX_SPEED,
  placeBomb,
  placePlayerAt,
  SLOW_SPEED,
  step,
  type CurseKind,
} from "../src";
import { center, emptyMatch, hold, player, press, run } from "./helpers";

function cursed(kind: CurseKind) {
  const s = emptyMatch();
  placePlayerAt(s, "p1", 5, 5);
  player(s).curse = { kind };
  return s;
}

describe("skull", () => {
  it("picking a skull applies a random curse", () => {
    const s = emptyMatch();
    s.items.push({ x: 1, y: 1, kind: ItemKind.Skull });
    step(s);
    const curse = player(s).curse!;
    expect(CURSES).toContain(curse.kind);
  });

  it("the random curse is deterministic per match seed", () => {
    const pick = (seed: number) => {
      const s = createMatch({ seed, playerIds: ["p1"], blockDensity: 0 });
      s.items.push({ x: 1, y: 1, kind: ItemKind.Skull });
      step(s);
      return player(s).curse!.kind;
    };
    expect(pick(5)).toBe(pick(5));
    const kinds = new Set(Array.from({ length: 40 }, (_, i) => pick(i)));
    expect(kinds.size).toBeGreaterThan(3);
  });

  it("never wears off by itself: only passing it on or another item ends it", () => {
    const s = cursed("slow");
    run(s, 60 * 60);
    expect(player(s).curse).toEqual({ kind: "slow" });
  });

  it("slow forces a crawl", () => {
    const s = cursed("slow");
    player(s).speed = MAX_SPEED;
    hold(s, "right", 1);
    expect(player(s).px).toBe(center(5) + SLOW_SPEED);
  });

  it("fast forces top speed", () => {
    const s = cursed("fast");
    hold(s, "right", 1);
    expect(player(s).px).toBe(center(5) + MAX_SPEED);
  });

  it("reverse inverts the controls", () => {
    const s = cursed("reverse");
    hold(s, "right", 1);
    expect(player(s).px).toBe(center(5) - BASE_SPEED);
    placePlayerAt(s, "p1", 5, 5);
    hold(s, "up", 1);
    expect(player(s).py).toBe(center(5) + BASE_SPEED);
  });

  it("diarrhea drops bombs constantly", () => {
    const s = cursed("diarrhea");
    player(s).bombCapacity = 3;
    hold(s, "right", 40);
    expect(s.bombs.length).toBeGreaterThan(1);
  });

  it("constipation blocks dropping bombs", () => {
    const s = cursed("constipation");
    press(s, "bomb");
    expect(s.bombs).toHaveLength(0);
  });

  it("weak fire limits bombs to range 1", () => {
    const s = cursed("weakFire");
    player(s).fireRange = 5;
    placeBomb(s, "p1");
    expect(s.bombs[0]!.range).toBe(1);
  });

  it("passes to a player who touches the cursed one, who is rid of it", () => {
    const s = cursed("reverse");
    placePlayerAt(s, "p2", 5, 5);
    step(s);
    expect(player(s, "p2").curse).toEqual({ kind: "reverse", from: "p1" });
    expect(player(s).curse).toBeNull();
  });

  it("does not bounce straight back while they still touch, but can once they have parted", () => {
    const s = cursed("reverse");
    placePlayerAt(s, "p2", 5, 5);
    run(s, 20);
    expect(player(s, "p2").curse?.kind).toBe("reverse");
    expect(player(s).curse).toBeNull();
    placePlayerAt(s, "p2", 7, 5);
    step(s);
    placePlayerAt(s, "p2", 5, 5);
    step(s);
    expect(player(s).curse?.kind).toBe("reverse");
    expect(player(s, "p2").curse).toBeNull();
  });

  it("two cursed players touching keep their own curses", () => {
    const s = cursed("reverse");
    placePlayerAt(s, "p2", 5, 5);
    player(s, "p2").curse = { kind: "slow" };
    step(s);
    expect(player(s).curse?.kind).toBe("reverse");
    expect(player(s, "p2").curse?.kind).toBe("slow");
  });

  it("picking up any other item cures it", () => {
    const s = cursed("weakFire");
    s.items.push({ x: 6, y: 5, kind: ItemKind.Bomb });
    hold(s, "right", 30);
    expect(player(s).bombCapacity).toBe(2);
    expect(player(s).curse).toBeNull();
  });

  it("dead players neither spread nor catch curses", () => {
    const s = cursed("reverse");
    placePlayerAt(s, "p2", 5, 5);
    player(s, "p2").alive = false;
    step(s);
    expect(player(s, "p2").curse).toBeNull();
  });

  it("cursed bombs still explode normally", () => {
    const s = cursed("weakFire");
    placeBomb(s, "p1");
    placePlayerAt(s, "p1", 1, 1);
    run(s, FUSE_TICKS);
    expect(s.bombs).toHaveLength(0);
  });
});
