import { describe, expect, it } from "vitest";
import { createMatch } from "../src/arena";
import { placeBomb } from "../src/bombs";
import { updateCurses } from "../src/curse";
import { collectItems } from "../src/items";
import { Floor, ItemKind, Tile, tileCenter } from "../src/state";
import { step } from "../src/step";

function match() {
  const s = createMatch({ stage: "sb4-08", seed: 17, playerIds: ["a", "b"], blockDensity: 0 });
  s.grid.tiles.fill(Tile.Empty);
  s.grid.floor.fill(Floor.Normal);
  s.items = [];
  const player = s.players[0]!;
  player.px = tileCenter(2);
  player.py = tileCenter(2);
  s.players[1]!.alive = false;
  return { s, player };
}

describe("SB4 slot collectible statuses", () => {
  it("makes native ID36 prevent bomb placement", () => {
    const { s, player } = match();
    s.items.push({ x: 2, y: 2, kind: ItemKind.Skull, sb4Status: 36 });
    collectItems(s);
    expect(player.curse).toMatchObject({ kind: "constipation", sb4Status: 36 });
    expect(placeBomb(s, player.id)).toBe(false);
  });

  it("attempts native ID43 power loss on the global 32-tick cadence", () => {
    const { s, player } = match();
    player.fireRange = 3;
    player.bombCapacity = 3;
    s.items.push({ x: 2, y: 2, kind: ItemKind.Skull, sb4Status: 43 });
    collectItems(s);
    expect(player.curse).toMatchObject({ kind: "hiccups", sb4Status: 43 });
    s.tick = 31;
    step(s);
    expect(s.tick).toBe(32);
    expect(s.items).toHaveLength(1);
    expect(player.fireRange < 3 || player.bombCapacity < 3).toBe(true);
  });

  it("preserves native ID43 across a curse transfer", () => {
    const { s, player } = match();
    const receiver = s.players[1]!;
    receiver.alive = true;
    receiver.px = player.px;
    receiver.py = player.py;
    player.curse = { kind: "hiccups", sb4Status: 43 };
    updateCurses(s);
    expect(player.curse).toBeNull();
    expect(receiver.curse).toMatchObject({ kind: "hiccups", sb4Status: 43, from: player.id });
  });

  it("uses a distinct native ID37 state without rolling an unrelated random curse", () => {
    const { s, player } = match();
    player.bombCapacity = 2;
    const rng = s.rng;
    s.items.push({ x: 2, y: 2, kind: ItemKind.Skull, sb4Status: 37 });
    collectItems(s);
    expect(s.rng).toBe(rng);
    expect(player.curse).toMatchObject({ kind: "dangerBomb", sb4Status: 37 });
    expect(placeBomb(s, player.id)).toBe(true);
    expect(s.bombs[0]?.sb4SlotVariant).toBe(10);
    player.px = tileCenter(3);
    expect(placeBomb(s, player.id)).toBe(true);
    expect(s.bombs[1]?.sb4SlotVariant).toBeUndefined();
  });

  it.each([
    { escaped: false, alive: false, status: null },
    { escaped: true, alive: true, status: 37 },
  ])("preserves native ID37 on explosion only while its carrier survives ($escaped)", ({ escaped, alive, status }) => {
    const { s, player } = match();
    player.curse = { kind: "dangerBomb", sb4Status: 37 };
    expect(placeBomb(s, player.id)).toBe(true);
    expect(s.bombs[0]!.sb4SlotVariant).toBe(10);
    s.bombs[0]!.fuse = 1;
    player.px = tileCenter(escaped ? 9 : 3);
    player.py = tileCenter(escaped ? 9 : 2);
    step(s);
    expect(player.alive).toBe(alive);
    expect(player.curse?.sb4Status ?? null).toBe(status);
  });
});
