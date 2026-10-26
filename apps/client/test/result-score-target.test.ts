import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResultScreen } from "../src/ui/result-screen";

vi.mock("../src/ui/sheet-art", () => ({ characterArt: () => document.createElement("span") }));

class Node {
  children: Node[] = [];
  className = "";
  hidden = false;
  textContent = "";
  style = { setProperty: () => {} };

  appendChild(child: Node) { this.children.push(child); return child; }
  replaceChildren(...children: Node[]) { this.children = children; }
  all(): Node[] { return this.children.flatMap((child) => [child, ...child.all()]); }
}

beforeEach(() => vi.stubGlobal("document", { createElement: () => new Node() }));
afterEach(() => vi.unstubAllGlobals());

describe("Battle Mode score display", () => {
  it("uses the selected victory target in round results", () => {
    const root = new Node();
    const screen = new ResultScreen(root as unknown as HTMLElement);
    screen.show([{ id: "a", place: 1 }], [{ id: "a", name: "Ana", wins: 2, character: "bomb", connected: true }], "a", null, false, 3);
    expect(root.all().find((node) => node.className === "seat-sub")?.textContent).toBe("2/3 🏆");
  });
});
