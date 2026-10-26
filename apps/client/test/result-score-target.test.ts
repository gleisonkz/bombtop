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

  it("exibe ambos os aliados como vencedores e identifica o time na vitória TAG", () => {
    const root = new Node();
    const screen = new ResultScreen(root as unknown as HTMLElement);
    screen.show(
      [{ id: "a", place: 1 }, { id: "c", place: 1 }, { id: "b", place: 3 }],
      [
        { id: "a", name: "Ana", wins: 2, character: "bomb", connected: true, team: "red" },
        { id: "b", name: "Bia", wins: 0, character: "bomb", connected: true, team: "blue" },
        { id: "c", name: "Carlos", wins: 2, character: "bomb", connected: true, team: "red" },
      ], "c", "a", true, 2, "red",
    );
    expect(root.all().find(node => node.className === "results-title")?.textContent).toBe("Sua equipe venceu a partida!");
    expect(root.all().filter(node => node.className.includes("placing won"))).toHaveLength(2);
  });
});
