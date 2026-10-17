import { describe, expect, it } from "vitest";
import {
  BASE_SPEED,
  createMatch,
  CURSE_TICKS,
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
  player(s).curse = { kind, ticks: CURSE_TICKS };
  return s;
}

describe("skull", () => {
  it("picking a skull applies a random curse", () => {
    const s = emptyMatch();
    s.items.push({ x: 1, y: 1, kind: ItemKind.Skull });
    step(s);
    const curse = player(s).curse!;
    expect(CURSES).toContain(curse.kind);
    expect(curse.ticks).toBeGreaterThan(CURSE_TICKS - 2);
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

  it("curses wear off", () => {
    const s = cursed("slow");
    run(s, CURSE_TICKS);
    expect(player(s).curse).toBeNull();
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

  it("spreads to players who touch the cursed one", () => {
    const s = cursed("reverse");
    placePlayerAt(s, "p2", 5, 5);
    step(s);
    expect(player(s, "p2").curse?.kind).toBe("reverse");
    expect(player(s).curse?.kind).toBe("reverse");
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
