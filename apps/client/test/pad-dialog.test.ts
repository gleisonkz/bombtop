import { afterEach, describe, expect, it, vi } from "vitest";
import { PadMenus } from "../src/ui/pad-menus";
import type { PadNav, NavCommand } from "../src/input/pad-nav";

afterEach(() => vi.unstubAllGlobals());

function scene(command: NavCommand, selectedIndex = 0) {
  const select = { tagName: "SELECT", selectedIndex, options: [{}, {}, {}], disabled: false,
    dispatchEvent: vi.fn(), getClientRects: () => [{}], matches: () => false };
  const close = { tagName: "BUTTON", disabled: false, getClientRects: () => [{}],
    matches: (selector: string) => selector === "[data-pad-back]", click: vi.fn() };
  const behind = { click: vi.fn() };
  const root = { querySelector: () => ({ querySelectorAll: () => [select, close] }), querySelectorAll: () => [behind] };
  vi.stubGlobal("window", { addEventListener: vi.fn() });
  vi.stubGlobal("document", { activeElement: select });
  const nav = { sample: () => command, reset: vi.fn() };
  const menus = new PadMenus(root as unknown as HTMLElement, nav as unknown as PadNav);
  return { menus, select, close, behind };
}

describe("controller navigation inside a dialog", () => {
  it("changes a native select with left/right and dispatches its change", () => {
    const { menus, select } = scene("right");
    menus.tick(0);
    expect(select.selectedIndex).toBe(1);
    expect(select.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "change" }));
  });
  it("keeps the selection inside its options", () => {
    const { menus, select } = scene("left");
    menus.tick(0);
    expect(select.selectedIndex).toBe(0);
    expect(select.dispatchEvent).not.toHaveBeenCalled();
  });
  it("uses the dialog's back button instead of leaving the lobby behind it", () => {
    const { menus, close, behind } = scene("back");
    menus.tick(0);
    expect(close.click).toHaveBeenCalledOnce();
    expect(behind.click).not.toHaveBeenCalled();
  });
});
