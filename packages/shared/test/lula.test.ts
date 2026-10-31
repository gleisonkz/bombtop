import { describe, expect, it } from "vitest";
import {
  CHARACTERS,
  createMatch,
  ItemKind,
  placeBomb,
  placePlayerAt,
  setTile,
  SPECIAL_COOLDOWN,
  SPECIAL_STUN_TICKS,
  step,
  Tile,
  type MatchState,
} from "../src";
import { BOT_NAMES } from "../src/room/session";
import { player } from "./helpers";

/** p1 (lula) at (2,5) facing right; p2 (bomb) far off at (8,5). */
function duel(): MatchState {
  const s = createMatch({ seed: 1, playerIds: ["p1", "p2"], blockDensity: 0, characters: { p1: "lula", p2: "bomb" } });
  s.items = [];
  placePlayerAt(s, "p1", 2, 5);
  placePlayerAt(s, "p2", 8, 5);
  player(s).facing = "right";
  return s;
}

const cast = (s: MatchState, id = "p1") => step(s, { [id]: { dir: null, bomb: false, special: true } });
const idle = (s: MatchState, n = 1) => {
  for (let i = 0; i < n; i++) step(s, {});
};

describe("lula's promise of picanha", () => {
  it("lula is a playable character, with bot names", () => {
    expect(CHARACTERS).toContain("lula");
    expect(BOT_NAMES.lula.length).toBeGreaterThan(0);
  });

  it("drops a picanha, looking like a power-up, on the tile in front of him", () => {
    const s = duel();
    cast(s);
    expect(s.items).toContainEqual({ x: 3, y: 5, kind: ItemKind.Picanha, owner: "p1" });
    expect(player(s).specialCooldown).toBe(SPECIAL_COOLDOWN);
  });

  it("whoever else picks it up is let down: stunned 3 s, and the picanha is gone", () => {
    const s = duel();
    cast(s);
    placePlayerAt(s, "p2", 3, 5);
    idle(s);
    expect(player(s, "p2").stun).toBeGreaterThanOrEqual(SPECIAL_STUN_TICKS - 1);
    expect(s.items.some((i) => i.kind === ItemKind.Picanha)).toBe(false);
  });

  it("whoever picks it up also loses one of their power-ups at random, scattered onto open floor", () => {
    const s = duel();
    cast(s);
    const p2 = player(s, "p2");
    p2.fireRange += 2;
    p2.canKick = true;
    const fire = p2.fireRange;
    placePlayerAt(s, "p2", 3, 5);
    idle(s);
    const lost = (fire - p2.fireRange) + (p2.canKick ? 0 : 1);
    expect(lost).toBe(1);
    const dropped = s.items.filter((i) => i.kind === ItemKind.Fire || i.kind === ItemKind.Kick);
    expect(dropped).toHaveLength(1);
    expect(dropped[0]!.kind).toBe(p2.canKick ? ItemKind.Fire : ItemKind.Kick);
  });

  it("with no power-ups to lose, it only stuns", () => {
    const s = duel();
    cast(s);
    placePlayerAt(s, "p2", 3, 5);
    idle(s);
    expect(player(s, "p2").stun).toBeGreaterThan(0);
    expect(s.items).toHaveLength(0);
  });

  it("lula walks over his own picanha: it stays", () => {
    const s = duel();
    cast(s);
    placePlayerAt(s, "p1", 3, 5);
    idle(s);
    expect(player(s).stun).toBe(0);
    expect(s.items).toContainEqual(expect.objectContaining({ kind: ItemKind.Picanha }));
  });

  it("is not dropped where something already is (a block, a bomb, an item, a player), and keeps his special", () => {
    for (const fill of [
      (s: MatchState) => setTile(s, 3, 5, Tile.Block),
      (s: MatchState) => (placePlayerAt(s, "p2", 3, 5), placeBomb(s, "p2"), placePlayerAt(s, "p2", 8, 5)),
      (s: MatchState) => s.items.push({ x: 3, y: 5, kind: ItemKind.Fire }),
      (s: MatchState) => placePlayerAt(s, "p2", 3, 5),
    ]) {
      const s = duel();
      fill(s);
      cast(s);
      expect(s.items.some((i) => i.kind === ItemKind.Picanha)).toBe(false);
      expect(player(s).specialCooldown).toBe(0);
    }
  });

  it("never comes out of a broken block", () => {
    const s = createMatch({ seed: 3, playerIds: ["p1", "p2"] });
    expect(s.items.some((i) => i.kind === ItemKind.Picanha)).toBe(false);
  });
});
