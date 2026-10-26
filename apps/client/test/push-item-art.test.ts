import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ItemKind } from "@bombtop/shared";
import { ITEMS, itemCell } from "../src/render/sprites";
import { ITEM_GUIDE } from "../src/ui/item-guide";

describe("Push item presentation", () => {
  it("provides a distinct atlas column with all four animated frames", () => {
    expect(ITEMS.order).toContain(ItemKind.Push);
    expect(new Set(ITEMS.order).size).toBe(ITEMS.order.length);
    const png = readFileSync(join(process.cwd(), "public", ITEMS.url));
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(ITEMS.order.length * ITEMS.size);
    expect(png.readUInt32BE(20)).toBe(ITEMS.frames * ITEMS.size);
    expect(itemCell(ItemKind.Push)).toBeGreaterThan(itemCell(ItemKind.Punch));
  });

  it("documents the player-pushing power separately from Punch", () => {
    const push = ITEM_GUIDE.find((item) => item.kind === ItemKind.Push);
    expect(push?.name).toContain("Empurr");
    expect(push?.text).toContain("jogador");
    expect(push?.tips.length).toBeGreaterThanOrEqual(2);
  });
});
