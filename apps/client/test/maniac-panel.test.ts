import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MANIAC_ITEM_KINDS, MAX_MANIAC_ITEMS, type LobbyInfo, type ManiacItemKind } from "@bombtop/shared";
import { ManiacPanel } from "../src/ui/maniac-panel";

class FakeElement {
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();
  readonly events = new Map<string, ((event: Event) => void)[]>();
  readonly dataset: Record<string, string> = {};
  readonly style: Record<string, string> = {};
  className = "";
  textContent = "";
  value = "";
  type = "";
  min = "";
  max = "";
  step = "";
  id = "";
  htmlFor = "";
  disabled = false;
  hidden = false;
  open = false;
  focused = false;

  constructor(readonly tag: string) {}

  appendChild(child: FakeElement): FakeElement {
    this.children.push(child);
    return child;
  }

  append(...children: FakeElement[]): void {
    children.forEach(child => this.appendChild(child));
  }

  replaceChildren(...children: FakeElement[]): void {
    this.children.length = 0;
    this.append(...children);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  addEventListener(name: string, callback: (event: Event) => void): void {
    this.events.set(name, [...this.events.get(name) ?? [], callback]);
  }

  emit(name: string): ReturnType<typeof vi.fn> {
    const preventDefault = vi.fn();
    for (const callback of this.events.get(name) ?? []) callback({ preventDefault } as unknown as Event);
    return preventDefault;
  }

  click(): void {
    if (!this.disabled && !this.hidden) this.emit("click");
  }

  showModal(): void {
    this.open = true;
  }

  close(): void {
    this.open = false;
    this.emit("close");
  }

  focus(): void {
    this.focused = true;
  }

  all(): FakeElement[] {
    return this.children.flatMap(child => [child, ...child.all()]);
  }
}

const firstItem = MANIAC_ITEM_KINDS[0]!;
const secondItem = MANIAC_ITEM_KINDS[1]!;

function lobby(overrides: Partial<LobbyInfo> = {}): LobbyInfo {
  return {
    code: "TEST", hostId: "host", phase: "lobby", stage: "classic", winsToWin: 3,
    timeMinutes: null, suddenDeath: true, battleMode: "maniac",
    members: [
      { id: "host", name: "Ana" },
      { id: "guest", name: "Bia" },
    ] as LobbyInfo["members"],
    maniac: { items: { [firstItem]: 2, [secondItem]: 1 }, hitPoints: { host: 3, guest: 4 } },
    ...overrides,
  };
}

function fixture(editable = true) {
  const parent = new FakeElement("div");
  const commit = vi.fn();
  const panel = new ManiacPanel(parent as unknown as HTMLElement, commit);
  const info = lobby();
  panel.update(info, editable);
  const trigger = panel.trigger as unknown as FakeElement;
  trigger.click();
  const dialog = parent.all().find(node => node.tag === "dialog")!;
  const item = (kind: ManiacItemKind) => dialog.all().find(node => node.tag === "input" && node.dataset.maniacItem === kind)!;
  const hp = (id: string) => dialog.all().find(node => node.tag === "input" && node.dataset.maniacHp === id)!;
  const action = (text: string) => dialog.all().find(node => node.tag === "button" && node.textContent === text)!;
  const change = (control: FakeElement, value: string) => { control.value = value; control.emit("input"); };
  return { panel, trigger, dialog, commit, info, item, hp, action, change };
}

beforeEach(() => vi.stubGlobal("document", { createElement: (tag: string) => new FakeElement(tag) }));
afterEach(() => vi.unstubAllGlobals());

describe("ManiacPanel", () => {
  it("mostra 15 itens, seus limites, HP dos membros e labels acessíveis", () => {
    const f = fixture();
    expect(f.trigger.hidden).toBe(false);
    expect(f.dialog.open).toBe(true);
    expect(f.dialog.getAttribute("aria-labelledby")).toBeTruthy();
    expect(f.dialog.all().filter(node => node.dataset.maniacItem !== undefined)).toHaveLength(15);
    for (const kind of MANIAC_ITEM_KINDS) {
      const control = f.item(kind);
      expect([control.type, control.min, control.max, control.step]).toEqual(["number", "0", "9", "1"]);
      expect(f.dialog.all().some(node => node.tag === "label" && node.htmlFor === control.id)).toBe(true);
    }
    expect(f.item(firstItem).value).toBe("2");
    expect(f.hp("host").value).toBe("3");
    expect(f.hp("guest").value).toBe("4");
    expect([f.hp("host").min, f.hp("host").max]).toEqual(["1", "5"]);
    expect(f.dialog.all().find(node => node.getAttribute("aria-live") === "polite")?.textContent).toContain(`/ ${MAX_MANIAC_ITEMS}`);
  });

  it("mantém o rascunho isolado e confirma somente ao salvar", () => {
    const f = fixture();
    f.change(f.item(firstItem), "6");
    f.change(f.hp("guest"), "5");
    expect(f.commit).not.toHaveBeenCalled();
    expect(f.info.maniac?.items[firstItem]).toBe(2);
    f.action("Salvar itens").click();
    expect(f.commit).toHaveBeenCalledOnce();
    expect(f.commit).toHaveBeenCalledWith({
      items: expect.objectContaining({ [firstItem]: 6, [secondItem]: 1 }),
      hitPoints: { host: 3, guest: 5 },
    });
    expect(f.dialog.open).toBe(false);
  });

  it("descarta edições ao cancelar ou pressionar Escape", () => {
    const f = fixture();
    f.change(f.item(firstItem), "7");
    f.action("Cancelar").click();
    expect(f.dialog.open).toBe(false);
    expect(f.trigger.focused).toBe(true);
    f.trigger.click();
    expect(f.item(firstItem).value).toBe("2");
    f.change(f.item(firstItem), "8");
    expect(f.dialog.emit("cancel")).toHaveBeenCalledOnce();
    expect(f.dialog.open).toBe(false);
    f.trigger.click();
    expect(f.item(firstItem).value).toBe("2");
    expect(f.commit).not.toHaveBeenCalled();
  });

  it("bloqueia totais superiores a 60 e anuncia o motivo", () => {
    const f = fixture();
    for (const kind of MANIAC_ITEM_KINDS.slice(0, 7)) f.change(f.item(kind), "9");
    expect(f.action("Salvar itens").disabled).toBe(true);
    expect(f.dialog.all().find(node => node.getAttribute("role") === "alert")?.textContent).toMatch(/60/);
    f.action("Salvar itens").click();
    expect(f.commit).not.toHaveBeenCalled();
    for (const kind of MANIAC_ITEM_KINDS.slice(0, 7)) f.change(f.item(kind), "0");
    expect(f.action("Salvar itens").disabled).toBe(false);
    for (const kind of MANIAC_ITEM_KINDS.slice(0, 6)) f.change(f.item(kind), "9");
    f.change(f.item(MANIAC_ITEM_KINDS[6]!), "6");
    expect(f.action("Salvar itens").disabled).toBe(false);
    expect(f.dialog.all().find(node => node.getAttribute("aria-live") === "polite")?.textContent).toContain("60 / 60");
  });

  it("rejeita valores vazios, fracionários ou fora da faixa de itens e HP", () => {
    const f = fixture();
    const save = f.action("Salvar itens");
    for (const value of ["", "1.5", "-1", "10", "NaN"]) {
      f.change(f.item(firstItem), value);
      expect(save.disabled).toBe(true);
      expect(f.dialog.all().find(node => node.getAttribute("role") === "alert")?.textContent).toBeTruthy();
    }
    f.change(f.item(firstItem), "2");
    for (const value of ["", "2.2", "0", "6"]) {
      f.change(f.hp("host"), value);
      expect(save.disabled).toBe(true);
    }
    f.change(f.hp("host"), "5");
    expect(save.disabled).toBe(false);
  });

  it("permite consultar a configuração como convidado sem alterar dados", () => {
    const f = fixture(false);
    expect(f.trigger.textContent).toBe("Ver itens Maniac");
    expect(f.dialog.open).toBe(true);
    expect(f.dialog.all().filter(node => node.tag === "input").every(node => node.disabled)).toBe(true);
    expect(f.action("Salvar itens").hidden).toBe(true);
    f.action("Salvar itens").emit("click");
    expect(f.commit).not.toHaveBeenCalled();
  });

  it("sincroniza atualizações do lobby e fecha ao sair do modo Maniac", () => {
    const f = fixture();
    f.change(f.item(firstItem), "8");
    f.panel.update({ ...f.info }, true);
    expect(f.item(firstItem).value).toBe("8");
    f.panel.update(lobby({ maniac: { items: { [firstItem]: 4 }, hitPoints: { host: 5, guest: 2 } } }), true);
    expect(f.item(firstItem).value).toBe("4");
    expect(f.hp("host").value).toBe("5");
    f.panel.update(lobby(), false);
    expect(f.dialog.all().filter(node => node.tag === "input").every(node => node.disabled)).toBe(true);
    f.panel.update(lobby({ battleMode: "single" }), false);
    expect(f.dialog.open).toBe(false);
    expect(f.trigger.hidden).toBe(true);
    expect(f.commit).not.toHaveBeenCalled();
  });

  it("recalcula HP ao entrar ou sair um participante", () => {
    const f = fixture();
    f.panel.update(lobby({
      members: [
        { id: "guest", name: "Bia" },
        { id: "new", name: "Caio" },
      ] as LobbyInfo["members"],
      maniac: { items: { [firstItem]: 3 }, hitPoints: { guest: 4 } },
    }), true);
    expect(f.hp("host")).toBeUndefined();
    expect(f.hp("guest").value).toBe("4");
    expect(f.hp("new").value).toBe("1");
    f.action("Salvar itens").click();
    expect(f.commit).toHaveBeenCalledWith({ items: { [firstItem]: 3 }, hitPoints: { guest: 4, new: 1 } });
  });
});
