import { describe, expect, it } from "vitest";
import {
  BASE_SPEED, CURSES, FUSE_TICKS, ItemKind, TICK_RATE, Tile,
  placeBomb, placePlayerAt, setTile, step,
} from "../src";
import { center, emptyMatch, hold, player, run } from "./helpers";

describe("Super Bomberman 4 Skull diseases", () => {
  it("offers all eleven documented diseases without duplicate entries", () => {
    expect(CURSES).toHaveLength(11);
    expect(new Set(CURSES).size).toBe(11);
    expect(CURSES).toEqual(expect.arrayContaining([
      "diarrhea", "weakFire", "hiccups", "fast", "shortFuse", "invisible",
      "cannotStop", "slow", "longFuse", "constipation", "reverse",
    ]));
  });

  it("limits both active bombs and fire to one with the weakest disease", () => {
    const s = emptyMatch();
    const p = player(s);
    p.curse = { kind: "weakFire" };
    p.bombCapacity = 5;
    p.fireRange = 6;
    expect(placeBomb(s, p.id)).toBe(true);
    expect(s.bombs[0]!.range).toBe(1);
    placePlayerAt(s, p.id, 5, 5);
    expect(placeBomb(s, p.id)).toBe(false);
    p.curse = null;
    expect(placeBomb(s, p.id)).toBe(true);
  });

  it("sets an approximately one-second and four-second fuse while cursed", () => {
    const short = emptyMatch();
    player(short).curse = { kind: "shortFuse" };
    placeBomb(short, "p1");
    expect(short.bombs[0]?.fuse).toBe(TICK_RATE);

    const long = emptyMatch();
    player(long).curse = { kind: "longFuse" };
    placeBomb(long, "p1");
    expect(long.bombs[0]?.fuse).toBe(TICK_RATE * 4);

    const regular = emptyMatch();
    placeBomb(regular, "p1");
    expect(regular.bombs[0]?.fuse).toBe(FUSE_TICKS);
  });

  it("does not cure Skull on collecting an egg, but does on a normal power-up", () => {
    const s = emptyMatch();
    const p = player(s);
    p.curse = { kind: "slow" };
    s.items.push({ x: 1, y: 1, kind: ItemKind.Egg });
    step(s);
    expect(p.curse?.kind).toBe("slow");
    s.items.push({ x: 1, y: 1, kind: ItemKind.Fire });
    step(s);
    expect(p.curse).toBeNull();
  });

  it("hiccups scatter one carried item roughly every half-second", () => {
    const s = emptyMatch();
    const p = player(s);
    p.curse = { kind: "hiccups" };
    p.bombCapacity = 4;
    p.fireRange = 3;
    p.speed = BASE_SPEED + 4;
    const totalPower = () => p.bombCapacity + p.fireRange + (p.speed - BASE_SPEED) / 4;
    const initial = totalPower();
    run(s, TICK_RATE / 2 - 1);
    expect(s.items).toHaveLength(0);
    expect(totalPower()).toBe(initial);
    step(s);
    expect(s.items).toHaveLength(1);
    expect(totalPower()).toBe(initial - 1);
    run(s, TICK_RATE / 2);
    expect(s.items).toHaveLength(2);
    expect(totalPower()).toBe(initial - 2);
    p.curse = null;
    run(s, TICK_RATE);
    expect(s.items).toHaveLength(2);
  });

  it("compels movement after releasing the stick until the runner hits a wall", () => {
    const s = emptyMatch();
    placePlayerAt(s, "p1", 5, 5);
    setTile(s, 7, 5, Tile.Wall);
    const p = player(s);
    p.curse = { kind: "cannotStop" };
    hold(s, "right", 1);
    const first = p.px;
    step(s);
    expect(p.px).toBeGreaterThan(first);
    run(s, 50);
    const stopped = p.px;
    step(s);
    expect(p.px).toBe(stopped);
    hold(s, "left", 1);
    expect(p.px).toBeLessThan(stopped);
    step(s);
    expect(p.px).toBeLessThan(stopped - BASE_SPEED);
  });

  it("invisibility alternates visibility without removing the player from collisions", () => {
    const s = emptyMatch();
    const p = player(s);
    p.curse = { kind: "invisible" };
    expect(p.alive).toBe(true);
    const initially = p.px;
    hold(s, "right", 1);
    expect(p.px).toBeGreaterThan(initially);
    expect(p.curse?.kind).toBe("invisible");
  });
});
