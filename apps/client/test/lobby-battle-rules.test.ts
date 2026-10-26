import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_STAGE_ROTATION, type LobbyInfo } from "@bombtop/shared";
import { LobbyPanel } from "../src/ui/lobby";

vi.mock("../src/ui/sheet-art", () => ({ characterArt: () => document.createElement("span") }));

class Node {
  children: Node[] = [];
  dataset: Record<string, string> = {};
  attributes = new Map<string, string>();
  events = new Map<string, (() => void)[]>();
  className = "";
  textContent = "";
  disabled = false;
  hidden = false;
  open = false;
  style = { setProperty: () => {} };

  appendChild(child: Node) { this.children.push(child); return child; }
  append(...children: Node[]) { this.children.push(...children); }
  replaceChildren(...children: Node[]) { this.children = children; }
  setAttribute(key: string, value: string) { this.attributes.set(key, value); }
  addEventListener(event: string, callback: () => void) { this.events.set(event, [...this.events.get(event) ?? [], callback]); }
  click() { if (!this.disabled) for (const callback of this.events.get("click") ?? []) callback(); }
  showModal() { this.open = true; }
  close() { this.open = false; }
  all(): Node[] { return this.children.flatMap((child) => [child, ...child.all()]); }
}

beforeEach(() => vi.stubGlobal("document", { createElement: () => new Node() }));
afterEach(() => vi.unstubAllGlobals());

describe("Battle Mode lobby controls", () => {
  it("shows the saved settings and allows only the host to change them", () => {
    const parent = new Node();
    const setWinsToWin = vi.fn();
    const setTimeMinutes = vi.fn();
    const setSuddenDeath = vi.fn();
    const panel = new LobbyPanel(parent as unknown as HTMLElement, {
      start: vi.fn(), leave: vi.fn(), addBot: vi.fn(), removeBot: vi.fn(),
      pickCharacter: vi.fn(), pickBotCharacter: vi.fn(), setStageRotation: vi.fn(),
      setWinsToWin, setTimeMinutes, setSuddenDeath, setBattleMode: vi.fn(), setManiac: vi.fn(),
    });
    const lobby: LobbyInfo = {
      phase: "lobby", code: "TST", stage: "classic", hostId: "host", members: [],
      winsToWin: 3, timeMinutes: null, suddenDeath: true, stageRotation: [...DEFAULT_STAGE_ROTATION],
    };
    panel.update(lobby, "host");
    const nodes = parent.all();
    const wins = nodes.filter((node) => node.className === "lobby-win-option");
    const times = nodes.filter((node) => node.className.includes("lobby-time-option"));
    const suddenDeath = nodes.find((node) => node.className === "lobby-rule-toggle")!;
    expect(wins).toHaveLength(5);
    expect(times).toHaveLength(5);
    expect(wins[2]!.attributes.get("aria-pressed")).toBe("true");
    expect(times[4]!.attributes.get("aria-pressed")).toBe("true");
    expect(suddenDeath.attributes.get("aria-pressed")).toBe("true");
    wins[1]!.click();
    times[2]!.click();
    suddenDeath.click();
    expect(setWinsToWin).toHaveBeenCalledWith(2);
    expect(setTimeMinutes).toHaveBeenCalledWith(3);
    expect(setSuddenDeath).toHaveBeenCalledWith(false);

    panel.update({ ...lobby, hostId: "guest", winsToWin: 2, timeMinutes: 3, suddenDeath: false }, "host");
    expect(wins[1]!.attributes.get("aria-pressed")).toBe("true");
    expect(times[2]!.attributes.get("aria-pressed")).toBe("true");
    expect(suddenDeath.attributes.get("aria-pressed")).toBe("false");
    expect([...wins, ...times, suddenDeath].every((node) => node.disabled)).toBe(true);
    times[0]!.click();
    expect(setTimeMinutes).toHaveBeenCalledTimes(1);
  });

  it("selects Maniac, fixes its official options and restricts editing to the host", () => {
    const parent = new Node();
    const setBattleMode = vi.fn();
    const setWinsToWin = vi.fn();
    const setTimeMinutes = vi.fn();
    const setSuddenDeath = vi.fn();
    const panel = new LobbyPanel(parent as unknown as HTMLElement, {
      start: vi.fn(), leave: vi.fn(), addBot: vi.fn(), removeBot: vi.fn(),
      pickCharacter: vi.fn(), pickBotCharacter: vi.fn(), setStageRotation: vi.fn(),
      setWinsToWin, setTimeMinutes, setSuddenDeath, setBattleMode, setManiac: vi.fn(),
    });
    const info: LobbyInfo = {
      phase: "lobby", code: "X", stage: "classic", hostId: "host", members: [],
      winsToWin: 3, timeMinutes: 3, suddenDeath: false, battleMode: "maniac", maniac: { items: {}, hitPoints: {} },
      stageRotation: [{ stage: "classic" }],
    };
    panel.update(info, "host");
    const modes = parent.all().filter((node) => node.className === "lobby-mode-option");
    expect(modes).toHaveLength(2);
    expect(modes[1]!.attributes.get("aria-pressed")).toBe("true");
    expect(parent.all().filter((node) => node.className === "lobby-win-option").every((node) => node.disabled)).toBe(true);
    expect(parent.all().filter((node) => node.className.includes("lobby-time-option")).every((node) => node.disabled)).toBe(true);
    expect(parent.all().find((node) => node.className === "lobby-rule-toggle")!.disabled).toBe(true);
    modes[0]!.click();
    expect(setBattleMode).toHaveBeenCalledWith("single");
    panel.update({ ...info, hostId: "guest" }, "host");
    expect(modes.every((node) => node.disabled)).toBe(true);
    modes[0]!.click();
    expect(setBattleMode).toHaveBeenCalledTimes(1);
  });
});
