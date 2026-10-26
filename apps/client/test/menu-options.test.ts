import { afterEach, expect, it, vi } from "vitest";
import { menuOptions } from "../src/ui/menu-options";

class Element extends EventTarget {
  children: Element[] = [];
  hidden = false;
  attributes = new Map<string, string>();
  focus = vi.fn();
  appendChild(child: Element) { this.children.push(child); return child; }
  append(...children: Element[]) { this.children.push(...children); }
  dataset = {};
  setAttribute(key: string, value: string) { this.attributes.set(key, value); }
  click() { this.dispatchEvent(new Event("click")); }
}

afterEach(() => vi.unstubAllGlobals());

it("toggles options with an accessible button and closes with Escape", () => {
  vi.stubGlobal("document", { createElement: () => new Element() });
  const options = menuOptions([]);
  const root = options.root as unknown as Element;
  const [toggle, panel] = root.children;
  expect(panel!.hidden).toBe(true);
  toggle!.click();
  expect(panel!.hidden).toBe(false);
  expect(toggle!.attributes.get("aria-expanded")).toBe("true");
  const escape = new Event("keydown", { cancelable: true });
  Object.assign(escape, { key: "Escape" });
  root.dispatchEvent(escape);
  expect(panel!.hidden).toBe(true);
  expect(toggle!.focus).toHaveBeenCalledOnce();
});

it("closes the panel when leaving the home screen", () => {
  vi.stubGlobal("document", { createElement: () => new Element() });
  const options = menuOptions([]);
  const [toggle, panel] = (options.root as unknown as Element).children;
  toggle!.click();
  options.close();
  expect(panel!.hidden).toBe(true);
  expect(toggle!.attributes.get("aria-expanded")).toBe("false");
});

it("keeps supplied actions and provides a controller back button", () => {
  vi.stubGlobal("document", { createElement: () => new Element() });
  const action = new Element();
  const options = menuOptions([action as unknown as HTMLElement]);
  const [toggle, panel] = (options.root as unknown as Element).children;
  expect(panel!.children[0]).toBe(action);
  toggle!.click();
  const back = panel!.children[1]!;
  expect(back.dataset).toHaveProperty("padBack");
  back.click();
  expect(panel!.hidden).toBe(true);
  expect(toggle!.focus).toHaveBeenCalledOnce();
  toggle!.click();
  toggle!.click();
  expect(panel!.hidden).toBe(true);
});
