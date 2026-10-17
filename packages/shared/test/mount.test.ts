import { describe, expect, it } from "vitest";
import {
  createMatch,
  DASH_TICKS,
  FLAME_TICKS,
  INVULN_TICKS,
  ItemKind,
  MOUNTS,
  placeBomb,
  placePlayerAt,
  playerTile,
  setTile,
  step,
  Tile,
  type MountKind,
} from "../src";
import { emptyMatch, hold, player, press, run } from "./helpers";

function mounted(kind: MountKind) {
  const s = emptyMatch();
  placePlayerAt(s, "p1", 3, 5);
  player(s).mount = kind;
  return s;
}

describe("mounts", () => {
  it("an egg gives a random mount, deterministic per seed", () => {
    const pick = (seed: number) => {
      const s = createMatch({ seed, playerIds: ["p1"], blockDensity: 0 });
      s.items.push({ x: 1, y: 1, kind: ItemKind.Egg });
      step(s);
      return player(s).mount;
    };
    expect(MOUNTS).toContain(pick(3));
    expect(pick(3)).toBe(pick(3));
  });

  it("an egg does nothing for a player already riding", () => {
    const s = mounted("hopper");
    placePlayerAt(s, "p1", 1, 1);
    s.items.push({ x: 1, y: 1, kind: ItemKind.Egg });
    step(s);
    expect(player(s).mount).toBe("hopper");
  });

  it("a hit costs the mount instead of the rider's life", () => {
    const s = mounted("dasher");
    s.flames.push({ x: 3, y: 5, ttl: FLAME_TICKS });
    step(s);
    expect(player(s).alive).toBe(true);
    expect(player(s).mount).toBeNull();
    expect(player(s).invuln).toBeGreaterThan(0);
  });

  it("riders are safe from the same flames while invulnerable", () => {
    const s = mounted("dasher");
    s.flames.push({ x: 3, y: 5, ttl: FLAME_TICKS });
    run(s, FLAME_TICKS);
    expect(player(s).alive).toBe(true);
  });

  it("invulnerability wears off", () => {
    const s = mounted("dasher");
    s.flames.push({ x: 3, y: 5, ttl: 2 }); // flames tick down before the hit check
    run(s, INVULN_TICKS + 1);
    expect(player(s).mount).toBeNull();
    s.flames.push({ x: 3, y: 5, ttl: FLAME_TICKS });
    step(s);
    expect(player(s).alive).toBe(false);
  });

  it("hopper jumps two tiles over an obstacle", () => {
    const s = mounted("hopper");
    setTile(s, 4, 5, Tile.Block);
    press(s, "action", "p1", "right");
    run(s, 30);
    expect(playerTile(player(s))).toEqual({ x: 5, y: 5 });
  });

  it("hopper does not jump onto a solid tile", () => {
    const s = mounted("hopper");
    setTile(s, 5, 5, Tile.Block);
    press(s, "action", "p1", "right");
    run(s, 30);
    expect(playerTile(player(s))).toEqual({ x: 3, y: 5 });
  });

  it("dasher bursts forward until blocked", () => {
    const s = mounted("dasher");
    press(s, "action", "p1", "right");
    run(s, DASH_TICKS);
    expect(playerTile(player(s)).x).toBeGreaterThanOrEqual(6);
    run(s, 60);
    expect(playerTile(player(s)).x).toBeLessThanOrEqual(11);
  });

  it("pusher can kick bombs", () => {
    const s = mounted("pusher");
    placePlayerAt(s, "p2", 5, 5);
    placeBomb(s, "p2");
    placePlayerAt(s, "p2", 11, 9);
    hold(s, "right", 20);
    expect(s.bombs[0]!.slide).toBe("right");
  });
});
