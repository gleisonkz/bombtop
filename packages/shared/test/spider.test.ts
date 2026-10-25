import { describe, expect, it } from "vitest";
import {
  CHARACTERS,
  createMatch,
  placePlayerAt,
  setTile,
  SPECIAL_COOLDOWN,
  step,
  Tile,
  WEB_RANGE,
  WEB_TICKS,
  type MatchState,
} from "../src";
import { hold, player, run } from "./helpers";

/** p1 (spider) at (3,5) facing right; p2 (bomb) `gap` tiles in front of him. */
function duel(gap = 2, p2: "bomb" | "captain" = "bomb"): MatchState {
  const s = createMatch({ seed: 1, playerIds: ["p1", "p2"], blockDensity: 0, characters: { p1: "spider", p2 } });
  placePlayerAt(s, "p1", 3, 5);
  placePlayerAt(s, "p2", 3 + gap, 5);
  player(s).facing = "right";
  return s;
}

const cast = (s: MatchState, id = "p1") => step(s, { [id]: { dir: null, bomb: false, special: true } });

describe("spider web shot", () => {
  it("the spider is a playable character", () => {
    expect(CHARACTERS).toContain("spider");
  });

  it(`wraps the first player within ${WEB_RANGE} tiles in front in web for 4 seconds`, () => {
    const s = duel(WEB_RANGE);
    cast(s);
    expect(player(s, "p2").webbed).toBe(WEB_TICKS);
    expect(WEB_TICKS).toBe(4 * 60);
    expect(player(s, "p2").stun).toBe(0);
  });

  it("misses players out of range or past a block", () => {
    const far = duel(WEB_RANGE + 1);
    cast(far);
    expect(player(far, "p2").webbed).toBe(0);

    const blocked = duel(3);
    setTile(blocked, 4, 5, Tile.Block);
    cast(blocked);
    expect(player(blocked, "p2").webbed).toBe(0);
  });

  it("leaves a web blast behind for clients to draw", () => {
    const s = duel(2);
    cast(s);
    expect(s.blasts).toEqual([expect.objectContaining({ ownerId: "p1", dir: "right", length: 2, kind: "web" })]);
  });

  it("a webbed player can neither move nor drop bombs until it wears off", () => {
    const s = duel(2);
    cast(s);
    const p2 = player(s, "p2");
    const px = p2.px;
    run(s, 30, { p2: { dir: "right", bomb: true } });
    expect(p2.px).toBe(px);
    expect(s.bombs.filter((b) => b.ownerId === "p2")).toHaveLength(0);
    run(s, WEB_TICKS);
    expect(p2.webbed).toBe(0);
    hold(s, "right", 10, "p2");
    expect(p2.px).toBeGreaterThan(px);
  });

  it("still burns in a blast while webbed", () => {
    const s = duel(2);
    cast(s);
    s.flames.push({ x: 5, y: 5, ttl: 10 });
    step(s);
    expect(player(s, "p2").alive).toBe(false);
  });

  it("a raised shield sends the web back at him", () => {
    const s = duel(2, "captain");
    player(s, "p2").facing = "left";
    player(s, "p2").shield = 60;
    cast(s);
    expect(player(s, "p2").webbed).toBe(0);
    expect(player(s).webbed).toBe(WEB_TICKS);
  });

  it(`recharges for ${SPECIAL_COOLDOWN / 60} seconds`, () => {
    const s = duel(2);
    cast(s);
    expect(player(s).specialCooldown).toBe(SPECIAL_COOLDOWN);
  });
});
