import {
  ItemKind, MANIAC_ITEM_KINDS, MAX_MANIAC_HP, MAX_MANIAC_ITEMS,
  MAX_MANIAC_PER_KIND, MIN_MANIAC_HP,
  type LobbyInfo, type ManiacConfig, type ManiacItemKind,
} from "@bombtop/shared";
import { button, el } from "./dom";

const ITEM_DETAILS: Record<ManiacItemKind, { label: string; color: string }> = {
  [ItemKind.Bomb]: { label: "Bomba extra", color: "#15151f" },
  [ItemKind.Fire]: { label: "Fogo", color: "#ff7a1a" },
  [ItemKind.FullFire]: { label: "Fogo máximo", color: "#ffd23f" },
  [ItemKind.Speed]: { label: "Velocidade", color: "#3fd0ff" },
  [ItemKind.Egg]: { label: "Ovo", color: "#fff3e0" },
  [ItemKind.Glove]: { label: "Luva", color: "#ffffff" },
  [ItemKind.Punch]: { label: "Soco", color: "#f4a261" },
  [ItemKind.Push]: { label: "Empurrão (Push)", color: "#ffb347" },
  [ItemKind.Kick]: { label: "Chute", color: "#9b5de5" },
  [ItemKind.BombPass]: { label: "Passar bombas", color: "#6bd7c4" },
  [ItemKind.BlockPass]: { label: "Passar blocos", color: "#87b95e" },
  [ItemKind.Pierce]: { label: "Bomba perfurante", color: "#48cae4" },
  [ItemKind.FireSuit]: { label: "Traje anti-chamas", color: "#bfe9fc" },
  [ItemKind.Heart]: { label: "Coração", color: "#e84665" },
  [ItemKind.Skull]: { label: "Caveira", color: "#6a0dad" },
};

interface Member {
  id: string;
  name: string;
}

function integerInRange(value: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(value)) return null;
  const result = Number(value);
  return Number.isSafeInteger(result) && result >= min && result <= max ? result : null;
}

export class ManiacPanel {
  readonly trigger: HTMLButtonElement;
  private readonly dialog = el("dialog", { class: "stage-dialog maniac-dialog card" });
  private readonly itemList = el("ul", { class: "maniac-item-list" });
  private readonly hpList = el("ul", { class: "maniac-hp-list" });
  private readonly summary = el("output", { class: "hint" });
  private readonly error = el("p", { class: "hint" });
  private readonly itemInputs = new Map<ManiacItemKind, HTMLInputElement>();
  private readonly hpInputs = new Map<string, HTMLInputElement>();
  private readonly save: HTMLButtonElement;
  private members: Member[] = [];
  private current: ManiacConfig = { items: {}, hitPoints: {} };
  private revision = "";
  private active = false;
  private editable = false;

  constructor(parent: HTMLElement, private readonly commit: (config: ManiacConfig) => void) {
    this.trigger = button("Configurar itens Maniac", () => this.open(), "stage-configure");
    this.trigger.setAttribute("aria-haspopup", "dialog");
    this.trigger.hidden = true;
    const title = el("h2", { text: "Itens Maniac" });
    title.id = "maniac-panel-title";
    this.dialog.setAttribute("aria-labelledby", title.id);
    this.dialog.style.width = "min(88vw, 740px)";
    this.dialog.style.maxHeight = "85vh";
    this.dialog.style.overflowY = "auto";
    this.itemList.style.display = "grid";
    this.itemList.style.gridTemplateColumns = "repeat(auto-fit, minmax(210px, 1fr))";
    this.itemList.style.gap = "0.5rem 1.25rem";
    this.itemList.style.padding = "0";
    this.itemList.style.listStyle = "none";
    this.hpList.style.padding = "0";
    this.hpList.style.listStyle = "none";
    this.hpList.style.display = "grid";
    this.hpList.style.gap = "0.5rem";
    this.summary.setAttribute("aria-live", "polite");
    this.error.setAttribute("role", "alert");
    this.dialog.addEventListener("cancel", event => {
      event.preventDefault();
      this.close();
    });
    this.save = button("Salvar itens", () => {
      if (!this.editable) return;
      const draft = this.readDraft();
      if (!draft) return;
      this.commit(draft);
      this.close();
    }, "primary");
    const cancel = button("Cancelar", () => this.close(), "ghost");
    cancel.autofocus = true;
    cancel.dataset.padBack = "";
    this.itemList.append(...MANIAC_ITEM_KINDS.map(kind => this.itemRow(kind)));
    this.dialog.append(
      title,
      el("p", { class: "hint", text: "Defina quantos itens de cada tipo entram na partida. O total máximo é de 60 itens." }),
      this.itemList,
      el("h3", { text: "Pontos de vida por jogador" }),
      el("p", { class: "hint", text: "Cada participante pode ter de 1 a 5 pontos de vida." }),
      this.hpList,
      this.summary,
      this.error,
      el("div", { class: "stage-dialog-actions" }, [cancel, this.save]),
    );
    parent.appendChild(this.dialog);
  }

  update(info: LobbyInfo, editable: boolean): void {
    const revision = JSON.stringify([
      info.members.map(member => [member.id, member.name]),
      MANIAC_ITEM_KINDS.map(kind => info.maniac?.items[kind] ?? 0),
      info.members.map(member => info.maniac?.hitPoints[member.id] ?? MIN_MANIAC_HP),
    ]);
    const changed = this.revision !== revision;
    const canEdit = editable && info.phase === "lobby";
    const permissionChanged = this.editable !== canEdit;
    this.current = { items: { ...info.maniac?.items }, hitPoints: { ...info.maniac?.hitPoints } };
    this.members = info.members.map(member => ({ id: member.id, name: member.name }));
    this.revision = revision;
    this.editable = canEdit;
    this.active = info.battleMode === "maniac" && info.phase === "lobby";
    this.trigger.hidden = !this.active;
    this.trigger.textContent = this.editable ? "Configurar itens Maniac" : "Ver itens Maniac";
    if (!this.active) {
      this.close();
      return;
    }
    if (this.dialog.open && (changed || permissionChanged)) this.render();
  }

  close(): void {
    if (!this.dialog.open) return;
    this.dialog.close();
    if (!this.trigger.hidden) this.trigger.focus();
  }

  private open(): void {
    if (!this.active) return;
    this.render();
    if (!this.dialog.open) this.dialog.showModal();
  }

  private itemRow(kind: ManiacItemKind): HTMLLIElement {
    const details = ITEM_DETAILS[kind];
    const marker = el("span", { class: "maniac-item-color" });
    marker.style.backgroundColor = details.color;
    marker.style.width = "0.65rem";
    marker.style.height = "0.65rem";
    marker.style.borderRadius = "50%";
    marker.style.outline = "1px solid rgba(255, 255, 255, 0.4)";
    marker.setAttribute("aria-hidden", "true");
    const label = el("label", { text: details.label });
    label.htmlFor = `maniac-item-${kind}`;
    const input = el("input");
    input.id = label.htmlFor;
    input.type = "number";
    input.min = "0";
    input.max = String(MAX_MANIAC_PER_KIND);
    input.step = "1";
    input.dataset.maniacItem = kind;
    input.style.width = "4rem";
    input.addEventListener("input", () => this.readDraft());
    input.addEventListener("change", () => this.readDraft());
    this.itemInputs.set(kind, input);
    const row = el("li", { class: "maniac-item-row" }, [marker, label, input]);
    row.style.display = "grid";
    row.style.gridTemplateColumns = "0.65rem minmax(0, 1fr) 4rem";
    row.style.gap = "0.5rem";
    row.style.alignItems = "center";
    return row;
  }

  private hpRow(member: Member, index: number): HTMLLIElement {
    const label = el("label", { text: member.name });
    label.htmlFor = `maniac-hp-${index}`;
    const input = el("input");
    input.id = label.htmlFor;
    input.type = "number";
    input.min = String(MIN_MANIAC_HP);
    input.max = String(MAX_MANIAC_HP);
    input.step = "1";
    input.value = String(this.current.hitPoints[member.id] ?? MIN_MANIAC_HP);
    input.dataset.maniacHp = member.id;
    input.disabled = !this.editable;
    input.style.width = "4rem";
    input.addEventListener("input", () => this.readDraft());
    input.addEventListener("change", () => this.readDraft());
    this.hpInputs.set(member.id, input);
    const row = el("li", { class: "maniac-hp-row" }, [label, input]);
    row.style.display = "grid";
    row.style.gridTemplateColumns = "minmax(0, 1fr) 4rem";
    row.style.gap = "0.5rem";
    row.style.alignItems = "center";
    return row;
  }

  private render(): void {
    for (const kind of MANIAC_ITEM_KINDS) {
      const input = this.itemInputs.get(kind)!;
      input.value = String(this.current.items[kind] ?? 0);
      input.disabled = !this.editable;
    }
    this.hpInputs.clear();
    this.hpList.replaceChildren(...this.members.map((member, index) => this.hpRow(member, index)));
    this.save.hidden = !this.editable;
    this.readDraft();
  }

  private readDraft(): ManiacConfig | null {
    const items: ManiacConfig["items"] = {};
    const hitPoints: Record<string, number> = Object.create(null) as Record<string, number>;
    let total = 0;
    let error = "";
    for (const kind of MANIAC_ITEM_KINDS) {
      const amount = integerInRange(this.itemInputs.get(kind)!.value, 0, MAX_MANIAC_PER_KIND);
      if (amount === null) {
        error = "Use quantidades inteiras de 0 a 9 em todos os itens.";
        continue;
      }
      total += amount;
      if (amount > 0) items[kind] = amount;
    }
    if (!error && total > MAX_MANIAC_ITEMS) error = `O limite é de ${MAX_MANIAC_ITEMS} itens por partida.`;
    for (const member of this.members) {
      const amount = integerInRange(this.hpInputs.get(member.id)!.value, MIN_MANIAC_HP, MAX_MANIAC_HP);
      if (amount === null) {
        if (!error) error = `Defina os pontos de vida de cada jogador entre ${MIN_MANIAC_HP} e ${MAX_MANIAC_HP}.`;
        continue;
      }
      hitPoints[member.id] = amount;
    }
    this.summary.textContent = `${total} / ${MAX_MANIAC_ITEMS} itens${this.editable ? "" : " · Somente o anfitrião pode alterar"}`;
    this.error.textContent = error;
    this.error.hidden = !error;
    this.save.disabled = !this.editable || Boolean(error);
    return error ? null : { items, hitPoints };
  }
}
