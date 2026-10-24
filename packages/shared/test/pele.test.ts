import { describe, expect, it } from "vitest";
import {
  BALL_RANGE,
  CHARACTERS,
  createMatch,
  placeBomb,
  placePlayerAt,
  setTile,
  SHIELD_TICKS,
  SPECIAL_COOLDOWN,
  SPECIAL_STUN_TICKS,
  step,
  Tile,
  type MatchState,
} from "../src";
import { BOT_NAMES } from "../src/room/session";
import { player, run } from "./helpers";

/** p1 (pelé) at (2,5) facing right; p2 (bomb) `gap` tiles in front of him. */
function duel(gap = 3, p2: "bomb" | "captain" = "bomb"): MatchState {
  const s = createMatch({ seed: 1, playerIds: ["p1", "p2"], blockDensity: 0, characters: { p1: "pele", p2 } });
  placePlayerAt(s, "p1", 2, 5);
  placePlayerAt(s, "p2", 2 + gap, 5);
  player(s).facing = "right";
  return s;
}

const cast = (s: MatchState, id = "p1") => step(s, { [id]: { dir: null, bomb: false, special: true } });

describe("pelé's kick", () => {
  it("pelé is a playable character, with bot names", () => {
    expect(CHARACTERS).toContain("pele");
    expect(BOT_NAMES.pele.length).toBeGreaterThan(0);
  });

  it(`kicks a ball up to ${BALL_RANGE} tiles straight ahead: the first player it hits is knocked down, stunned 3 s`, () => {
    const s = duel(BALL_RANGE);
    cast(s);
    expect(player(s, "p2").stun).toBeGreaterThanOrEqual(SPECIAL_STUN_TICKS - 1); // the hit player's own tick follows
    expect(player(s).specialCooldown).toBe(SPECIAL_COOLDOWN);
    expect(s.blasts).toContainEqual(expect.objectContaining({ ownerId: "p1", kind: "ball", dir: "right", length: BALL_RANGE }));
  });

  it("misses a player past its reach", () => {
    const s = duel(BALL_RANGE + 1);
    cast(s);
    expect(player(s, "p2").stun).toBe(0);
  });

  it("walls and blocks stop the ball", () => {
    const s = duel(4);
    setTile(s, 4, 5, Tile.Block);
    cast(s);
    expect(player(s, "p2").stun).toBe(0);
    expect(s.blasts[0]!.length).toBe(1);
  });

  it("a bomb in its way is kicked off sliding, and the ball stops there", () => {
    const s = duel(6);
    placePlayerAt(s, "p2", 4, 7);
    placeBomb(s, "p2");
    s.bombs[0]!.x = 4;
    s.bombs[0]!.y = 5;
    placePlayerAt(s, "p2", 9, 7);
    cast(s);
    expect(s.bombs[0]!.slide).toBe("right");
    run(s, 20);
    expect(s.bombs[0]!.x).toBeGreaterThan(4);
  });

  it("the captain's shield sends the ball back at him", () => {
    const s = duel(3, "captain");
    player(s, "p2").facing = "left";
    player(s, "p2").shield = SHIELD_TICKS;
    cast(s);
    expect(player(s, "p2").stun).toBe(0);
    expect(player(s).stun).toBe(SPECIAL_STUN_TICKS);
  });

  it("waits out his recharge", () => {
    const s = duel(3);
    cast(s);
    player(s, "p2").stun = 0;
    cast(s);
    expect(player(s, "p2").stun).toBe(0);
  });
});
