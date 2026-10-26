import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LobbyInfo } from "@bombtop/shared";
import { StageRotationPanel } from "../src/ui/stage-rotation-panel";

class Node {
  parent?: Node; className = ""; captured = false; offsetHeight = 100; scrollTop = 0; style = { transform: "" };
  classList = { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() };
  children: Node[] = []; textContent = ""; value = ""; disabled = false; hidden = false; open = false;
  dataset = {}; attributes = new Map<string, string>();
  events = new Map<string, ((event: PointerEvent) => void)[]>();
  constructor(readonly tag: string) {}
  appendChild(child: Node) { child.parent = this; this.children.push(child); return child; }
  append(...children: Node[]) { this.children.push(...children); }
  replaceChildren(...children: Node[]) { this.children = []; for (const child of children) this.appendChild(child); }
  setAttribute(key: string, value: string) { this.attributes.set(key, value); }
  addEventListener(event: string, callback: (event: PointerEvent) => void) { this.events.set(event, [...this.events.get(event) ?? [], callback]); }
  emit(event: string, values: Partial<PointerEvent> = {}) { for (const callback of this.events.get(event) ?? []) callback({ pointerId: 1, isPrimary: true, button: 0, clientY: 50, preventDefault: vi.fn(), ...values } as unknown as PointerEvent); }
  click() { if (!this.disabled) this.emit("click"); }
  showModal() { this.open = true; }
  close() { this.open = false; this.emit("close"); }
  setPointerCapture() { this.captured = true; }
  hasPointerCapture() { return this.captured; }
  releasePointerCapture() { this.captured = false; }
  getBoundingClientRect() { const top = Math.max(0, this.parent?.children.indexOf(this) ?? 0) * 110; return { top, bottom: top + 100, height: 100 }; }
  focus() {}
  querySelector(tag: string): Node | undefined { return this.all().find(node => node.tag === tag || (tag.startsWith(".") && node.className.split(" ").includes(tag.slice(1)))); }
  all(): Node[] { return this.children.flatMap(child => [child, ...child.all()]); }
}

beforeEach(() => {
  vi.stubGlobal("document", { createElement: (tag: string) => new Node(tag) });
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

function fixture(editable = true) {
  const parent = new Node("div");
  const commit = vi.fn();
  const panel = new StageRotationPanel(parent as unknown as HTMLElement, commit);
  const info: LobbyInfo = { code: "test", hostId: "host", members: [], stage: "classic", winsToWin: 3, timeMinutes: null, suddenDeath: true, phase: "lobby",
    stageRotation: [{ stage: "classic" }, { stage: "conveyor" }, { stage: "warp" }] };
  panel.update(info, editable);
  (panel.trigger as unknown as Node).click();
  const dialog = parent.querySelector("dialog")!;
  const control = (label: string) => dialog.all().find(node => node.attributes.get("aria-label") === label)!;
  const button = (label: string) => dialog.all().find(node => node.tag === "button" && node.textContent === label)!;
  return { panel, parent, dialog, commit, info, control, button };
}

describe("stage sequence editor", () => {
  it("saves pointer drag order, including repeated stages, only after confirmation", () => {
    const f = fixture();
    f.button("＋ Clássica").click();
    const handle = f.control("Arrastar fase 1 para reordenar");
    handle.emit("pointerdown", { pointerType: "touch" });
    handle.emit("pointermove", { clientY: 275, pointerType: "touch" });
    handle.emit("pointerup", { clientY: 275, pointerType: "touch" });
    expect(f.commit).not.toHaveBeenCalled();
    f.button("Salvar sequência").click();
    expect(f.commit).toHaveBeenCalledWith([{ stage: "conveyor" }, { stage: "warp" }, { stage: "classic" }, { stage: "classic" }]);
  });

  it("clears an active drag before closing or losing host permission", () => {
    const f = fixture();
    const handle = f.control("Arrastar fase 1 para reordenar");
    handle.emit("pointerdown");
    handle.emit("pointermove", { clientY: 275 });
    f.panel.update(f.info, false);
    expect(handle.captured).toBe(false);
    handle.emit("pointerup", { clientY: 275 });
    expect(f.commit).not.toHaveBeenCalled();
    f.button("Fechar").click();
    expect(f.dialog.open).toBe(false);
  });

  it("edits a draft, reorders and adds stages, then saves without changing the server snapshot", () => {
    const f = fixture();
    f.control("Descer fase 1").click();
    f.button("＋ Teleportes").click();
    f.control("Remover fase 3").click();
    expect(f.commit).not.toHaveBeenCalled();
    f.button("Salvar sequência").click();
    expect(f.commit).toHaveBeenCalledWith([{ stage: "conveyor" }, { stage: "classic" }, { stage: "warp" }]);
    expect(f.info.stageRotation).toEqual([{ stage: "classic" }, { stage: "conveyor" }, { stage: "warp" }]);
    expect(f.dialog.open).toBe(false);
  });

  it("discards changes when closed and prevents removing the last stage", () => {
    const f = fixture();
    f.control("Remover fase 3").click();
    f.control("Remover fase 2").click();
    expect(f.control("Remover fase 1").disabled).toBe(true);
    f.button("Fechar").click();
    (f.panel.trigger as unknown as Node).click();
    expect(f.dialog.all().filter(node => node.tag === "select")).toHaveLength(3);
    expect(f.commit).not.toHaveBeenCalled();
  });

  it("limits the number of selected stages and makes guest controls read-only", () => {
    const f = fixture();
    for (let i = 0; i < 12; i++) f.button("＋ Clássica").click();
    expect(f.dialog.all().filter(node => node.tag === "select")).toHaveLength(12);
    expect(f.button("＋ Clássica").disabled).toBe(true);
    f.panel.update(f.info, false);
    expect(f.button("Salvar sequência").hidden).toBe(true);
    expect(f.dialog.all().filter(node => node.tag === "select").every(node => node.disabled)).toBe(true);
    f.button("Salvar sequência").click();
    expect(f.commit).not.toHaveBeenCalled();
    f.panel.update({ ...f.info, phase: "playing" }, false);
    expect(f.dialog.open).toBe(false);
  });
});
