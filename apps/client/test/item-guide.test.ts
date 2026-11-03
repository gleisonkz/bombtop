import { describe, expect, it } from "vitest";
import { ItemKind } from "@bombtop/shared";
import { ITEM_CATEGORIES, ITEM_GUIDE, ITEM_GROUPS } from "../src/ui/item-guide";
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

  it("sorts every item into one of the tray's groups, each with a badge", () => {
    expect(ITEM_CATEGORIES.map((c) => c.id)).toEqual(["power", "bomb", "defense", "danger"]);
    for (const i of ITEM_GUIDE) {
      expect(ITEM_CATEGORIES.map((c) => c.id), i.kind).toContain(i.cat);
      expect(i.badge.length, i.kind).toBeGreaterThan(2);
    }
    const tray = ITEM_GROUPS.flatMap((g) => g.items.map((i) => i.kind));
    expect([...tray].sort()).toEqual(ITEM_GUIDE.map((i) => i.kind).sort());
    expect(ITEM_GROUPS.map((g) => g.id)).toEqual(ITEM_CATEGORIES.map((c) => c.id));
    for (const g of ITEM_GROUPS) for (const i of g.items) expect(i.cat).toBe(g.id);
  });

  it("gives each group a short name for the phone's filter pills", () => {
    expect(ITEM_CATEGORIES.map((c) => c.short)).toEqual(["Poderes", "Bombas", "Defesa", "Perigo"]);
  });
});
