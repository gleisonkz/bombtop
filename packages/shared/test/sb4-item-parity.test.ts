import { describe, expect, it } from "vitest";
import { collectItems, ItemKind, MAX_FIRE_RANGE, placeBomb, placePlayerAt, step } from "../src";
import { emptyMatch, player } from "./helpers";

describe("documented SB4 item limits", () => {
  it("full fire reaches ten blocks ahead, as specified on manual pages 26 and 27", () => {
    const s = emptyMatch();
    placePlayerAt(s, "p1", 1, 1);
    s.items.push({ x: 1, y: 1, kind: ItemKind.FullFire });
    collectItems(s);
    expect(MAX_FIRE_RANGE).toBe(10);
    expect(player(s).fireRange).toBe(10);
    placeBomb(s, "p1");
    s.bombs[0]!.fuse = 1;
    placePlayerAt(s, "p1", 1, 9);
    step(s);
    expect(s.flames.some(f => f.x === 11 && f.y === 1)).toBe(true);
    expect(s.flames.some(f => f.x === 12 && f.y === 1)).toBe(false);
  });
});
