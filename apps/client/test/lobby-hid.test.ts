import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LobbyPanel } from "../src/ui/lobby";

vi.mock("../src/ui/sheet-art", () => ({ characterArt: () => document.createElement("span") }));

class Node {
  children: Node[] = [];
  dataset: Record<string, string> = {};
  events = new Map<string, (() => void)[]>();
  className = "";
  textContent = "";
  disabled = false;
  hidden = false;
  style = { setProperty: () => {} };
  appendChild(child: Node) { this.children.push(child); return child; }
  append(...children: Node[]) { this.children.push(...children); }
  replaceChildren(...children: Node[]) { this.children = children; }
  setAttribute() {}
  addEventListener(event: string, callback: () => void) { this.events.set(event, [...this.events.get(event) ?? [], callback]); }
  click() { if (!this.disabled) for (const callback of this.events.get("click") ?? []) callback(); }
  showModal() {}
  close() {}
  all(): Node[] { return this.children.flatMap((child) => [child, ...child.all()]); }
}

beforeEach(() => vi.stubGlobal("document", { createElement: () => new Node() }));
afterEach(() => vi.unstubAllGlobals());

function panel() {
  const parent = new Node();
  const lobby = new LobbyPanel(parent as unknown as HTMLElement, {
    start: vi.fn(), leave: vi.fn(), addBot: vi.fn(), removeBot: vi.fn(),
    pickCharacter: vi.fn(), pickBotCharacter: vi.fn(), setStageRotation: vi.fn(),
    setWinsToWin: vi.fn(), setTimeMinutes: vi.fn(), setSuddenDeath: vi.fn(),
    setBattleMode: vi.fn(), setManiac: vi.fn(), setTeam: vi.fn(), setReady: vi.fn(),
  });
  const hidBtn = () => parent.all().find((n) => n.className.includes("hid-btn"))!;
  return { lobby, hidBtn };
}

describe("lobby: PS4 controllers over WebHID", () => {
  it("offers them on a couch room where WebHID is there, and asks for them on a click", () => {
    const { lobby, hidBtn } = panel();
    const hid = vi.fn();
    lobby.setOffline({ pair: null, couch: true, hid });
    expect(hidBtn().hidden).toBe(false);
    hidBtn().click();
    expect(hid).toHaveBeenCalled();
  });

  it("hides them elsewhere", () => {
    const { lobby, hidBtn } = panel();
    lobby.setOffline({ pair: null, couch: true });
    expect(hidBtn().hidden).toBe(true);
    lobby.setOffline(null);
    expect(hidBtn().hidden).toBe(true);
  });
});
