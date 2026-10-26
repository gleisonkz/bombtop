import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LeaveConfirm } from "../src/ui/leave-confirm";

class Node {
  children: Node[] = [];
  dataset: Record<string, string> = {};
  attributes = new Map<string, string>();
  events = new Map<string, (() => void)[]>();
  className = "";
  textContent = "";
  type = "";
  hidden = false;
  focused = false;

  appendChild(child: Node) { this.children.push(child); return child; }
  setAttribute(key: string, value: string) { this.attributes.set(key, value); }
  addEventListener(event: string, callback: () => void) { this.events.set(event, [...this.events.get(event) ?? [], callback]); }
  click() { for (const callback of this.events.get("click") ?? []) callback(); }
  focus() { this.focused = true; }
  all(): Node[] { return this.children.flatMap((child) => [child, ...child.all()]); }
}

beforeEach(() => vi.stubGlobal("document", { createElement: () => new Node() }));
afterEach(() => vi.unstubAllGlobals());

describe("leave confirmation", () => {
  function setup() {
    const parent = new Node();
    const leave = vi.fn();
    const confirm = new LeaveConfirm(parent as unknown as HTMLElement, leave);
    const nodes = () => parent.all();
    const root = parent.children[0]!;
    const stay = nodes().find((n) => n.className.includes("leave-stay"))!;
    const go = nodes().find((n) => n.className.includes("leave-go"))!;
    return { confirm, leave, root, stay, go };
  }

  it("starts hidden and asks before leaving the room", () => {
    const { confirm, leave, root, go } = setup();
    expect(root.hidden).toBe(true);
    confirm.toggle();
    expect(root.hidden).toBe(false);
    expect(confirm.open).toBe(true);
    expect(leave).not.toHaveBeenCalled();
    go.click();
    expect(leave).toHaveBeenCalledOnce();
    expect(root.hidden).toBe(true);
  });

  it("staying (also B on a controller, or Esc again) closes it and keeps the room", () => {
    const { confirm, leave, root, stay } = setup();
    confirm.toggle();
    expect(stay.focused).toBe(true); // Space or Enter never leaves by accident
    expect(stay.dataset.padBack).toBe("");
    stay.click();
    expect(root.hidden).toBe(true);
    confirm.toggle();
    confirm.toggle();
    expect(root.hidden).toBe(true);
    expect(leave).not.toHaveBeenCalled();
  });
});
