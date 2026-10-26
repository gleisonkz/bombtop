import { describe, expect, it } from "vitest";
import { ItemKind } from "@bombtop/shared";
import { ITEM_GUIDE } from "../src/ui/item-guide";
import { ITEMS } from "../src/render/sprites";

describe("item guide", () => {
  it("describes every item in play, in the art's order", () => {
    expect(ITEM_GUIDE.map((i) => i.kind)).toEqual(ITEMS.order.filter((k) => k !== ItemKind.Picanha));
  });

  it("leaves out lula's picanha: it never comes out of a block (the character guide tells of it)", () => {
    expect((ITEM_GUIDE.map((i) => i.kind) as ItemKind[])).not.toContain(ItemKind.Picanha);
  });

  it("shows the egg now available from blocks", () => {
    expect(ITEM_GUIDE.some((i) => i.kind === ItemKind.Egg)).toBe(true);
  });

  it("gives each a name and a description", () => {
    for (const i of ITEM_GUIDE) {
      expect(i.name.length).toBeGreaterThan(2);
      expect(i.text.length).toBeGreaterThan(15);
    }
  });

  it("gives tips for every item", () => {
    for (const i of ITEM_GUIDE) expect(i.tips.length, i.kind).toBeGreaterThanOrEqual(2);
  });

  it("points at the item's cell on the sheet", () => {
    expect(ITEM_GUIDE[2]!.cell).toBe(2 * ITEMS.size);
  });
});
