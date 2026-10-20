import { describe, expect, it } from "vitest";
import {
  BASE_SPEED,
  bombAt,
  getTile,
  hasFlame,
  ItemKind,
  MAX_FIRE_RANGE,
  playerTile,
  SPEED_STEP,
  START_BOMB_CAPACITY,
  START_FIRE_RANGE,
  step,
  Tile,
  type MatchState,
} from "../src";
import { emptyMatch, player } from "./helpers";

/** p1 picked up 2 fire, 1 bomb, 1 speed, kick and remote. */
function loaded(): MatchState {
  const s = emptyMatch();
  s.items = [];
  const p = player(s);
  p.fireRange = START_FIRE_RANGE + 2;
  p.bombCapacity = START_BOMB_CAPACITY + 1;
  p.speed = BASE_SPEED + SPEED_STEP;
  p.canKick = true;
  p.bombType = "remote";
  return s;
}

function burn(s: MatchState, id = "p1") {
  const { x, y } = playerTile(player(s, id));
  s.flames.push({ x, y, ttl: 30, ownerId: "p2" });
  step(s);
}

const kinds = (s: MatchState) => s.items.map((i) => i.kind).sort();

describe("dropping items on death", () => {
  it("a player who dies scatters the items they picked up over the arena", () => {
    const s = loaded();
    burn(s);
    expect(player(s).alive).toBe(false);
    expect(kinds(s)).toEqual(
      [ItemKind.Fire, ItemKind.Fire, ItemKind.Bomb, ItemKind.Speed, ItemKind.Kick, ItemKind.Remote].sort(),
    );
  });

  it("they land on open floor: no block, wall, bomb, flame, player or other item", () => {
    const s = loaded();
    burn(s);
    const spots = new Set(s.items.map((i) => `${i.x},${i.y}`));
    expect(spots.size).toBe(s.items.length);
    for (const i of s.items) {
      expect(getTile(s, i.x, i.y)).toBe(Tile.Empty);
      expect(hasFlame(s, i.x, i.y)).toBe(false);
      expect(bombAt(s, i.x, i.y)).toBeUndefined();
      for (const p of s.players.filter((p) => p.alive)) expect(playerTile(p)).not.toEqual({ x: i.x, y: i.y });
    }
  });

  it("full fire comes back as fire, one per extra range, and a player with nothing drops nothing", () => {
    const s = emptyMatch();
    s.items = [];
    player(s).fireRange = MAX_FIRE_RANGE;
    burn(s);
    expect(s.items.filter((i) => i.kind === ItemKind.Fire)).toHaveLength(MAX_FIRE_RANGE - START_FIRE_RANGE);

    const bare = emptyMatch();
    bare.items = [];
    burn(bare);
    expect(bare.items).toEqual([]);
  });

  it("drops each item once and leaves the dead player with none, so a revived one starts over", () => {
    const s = loaded();
    burn(s);
    const p = player(s);
    expect([p.fireRange, p.bombCapacity, p.speed, p.canKick, p.bombType]).toEqual([
      START_FIRE_RANGE,
      START_BOMB_CAPACITY,
      BASE_SPEED,
      false,
      "normal",
    ]);
    const n = s.items.length;
    step(s);
    expect(s.items.length).toBe(n);
  });

  it("scatters the same way on server and client (the match's seeded random)", () => {
    const a = loaded();
    const b = loaded();
    burn(a);
    burn(b);
    expect(a.items).toEqual(b.items);
  });
});
