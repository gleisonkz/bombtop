import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ItemKind } from "@bombtop/shared";
import { ITEMS, itemCell } from "../src/render/sprites";

const kinds = [ItemKind.BombPass, ItemKind.BlockPass, ItemKind.FireSuit, ItemKind.Heart];

describe("Maniac item medallion artwork", () => {
  it("includes one correctly indexed unique atlas column for each new powerup", () => {
    const atlas = readFileSync(new URL("../public/sprites/items.png", import.meta.url));
    expect(atlas.readUInt32BE(16)).toBe(ITEMS.order.length * ITEMS.size);
    expect(atlas.readUInt32BE(20)).toBe(ITEMS.frames * ITEMS.size);
    expect(new Set(ITEMS.order).size).toBe(ITEMS.order.length);
    for (const kind of kinds) {
      expect(ITEMS.order).toContain(kind);
      expect(itemCell(kind)).toBeGreaterThanOrEqual(0);
    }
  });
});
