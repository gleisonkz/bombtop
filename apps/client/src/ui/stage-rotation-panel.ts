import { DEFAULT_STAGE_ROTATION, MAX_STAGE_ROTATION, SB4_STAGES, SELECTABLE_STAGES, type LobbyInfo, type StageId, type StageRotationEntry } from "@bombtop/shared";
import { button, el } from "./dom";
import { STAGE_NAMES } from "./stage-names";
import { stagePreview } from "./stage-preview";
import { StageDragOrder } from "./stage-drag-order";

export class StageRotationPanel {
  readonly trigger: HTMLButtonElement;
  private readonly dialog = el("dialog", { class: "stage-dialog card" });
  private readonly list = el("ol", { class: "stage-rotation-list" });
  private readonly summary = el("p", { class: "hint stage-summary" });
  private readonly save: HTMLButtonElement;
  private readonly sb4Preset: HTMLButtonElement;
  private readonly additions: HTMLButtonElement[];
  private draft: StageRotationEntry[] = [];
  private current: StageRotationEntry[] = [];
  private editable = false;
  private inLobby = false;
  private readonly drag: StageDragOrder;

  constructor(parent: HTMLElement, private readonly commit: (rotation: StageRotationEntry[]) => void) {
    this.drag = new StageDragOrder(this.list, this.dialog, (from, to) => {
      if (!this.editable) return;
      const [entry] = this.draft.splice(from, 1);
      this.draft.splice(to, 0, entry!);
      this.render();
      this.summary.textContent = `Fase movida da posição ${from + 1} para ${to + 1}. ${this.draft.length} fases na sequência.`;
      this.list.children[to]?.querySelector<HTMLButtonElement>(".stage-drag-handle")?.focus();
    });
    this.dialog.addEventListener("close", () => this.drag.cancel());
    this.dialog.addEventListener("cancel", () => this.drag.cancel());
    this.trigger = button("Configurar fases", () => this.open(), "stage-configure");
    this.trigger.setAttribute("aria-haspopup", "dialog");
    const title = el("h2", { text: "Fases da partida" });
    title.id = "stage-rotation-title";
    this.dialog.setAttribute("aria-labelledby", title.id);
    this.summary.setAttribute("aria-live", "polite");
    this.save = button("Salvar sequência", () => {
      if (!this.editable || !this.dialog.open) return;
      this.commit(this.draft.map(entry => ({ ...entry })));
      this.close();
    }, "primary");
    this.sb4Preset = button("12 fases SB4", () => {
      if (!this.editable || !this.inLobby || !this.dialog.open) return;
      this.draft = SB4_STAGES.map(stage => ({ stage }));
      this.render();
    }, "stage-preset");
    const cancel = button("Fechar", () => this.close(), "ghost");
    cancel.dataset.padBack = "";
    cancel.autofocus = true;
    this.additions = SELECTABLE_STAGES.map(stage => {
      const add = button(`＋ ${STAGE_NAMES[stage]}`, () => {
        if (!this.editable || this.draft.length >= MAX_STAGE_ROTATION) return;
        this.draft.push({ stage });
        this.render();
      });
      add.appendChild(stagePreview(stage));
      return add;
    });
    this.dialog.append(title, el("p", { class: "hint stage-intro", text: "Arraste pela alça ⠿ para mudar a ordem, com mouse ou toque. Cada rodada usa a próxima fase da lista; a sequência se repete até alguém atingir as vitórias para ganhar. As imagens da partida mostram os 12 mapas SB4 no Bombtop, com regras locais em validação." }), this.sb4Preset,
      this.list, el("div", { class: "stage-additions" }, this.additions), this.summary,
      el("div", { class: "stage-dialog-actions" }, [cancel, this.save]));
    parent.appendChild(this.dialog);
  }

  update(info: LobbyInfo, editable: boolean): void {
    this.current = (info.stageRotation ?? DEFAULT_STAGE_ROTATION).map(entry => ({ ...entry }));
    const wasEditable = this.editable;
    this.inLobby = info.phase === "lobby";
    this.editable = editable && this.inLobby;
    const permissionChanged = wasEditable !== this.editable;
    this.trigger.textContent = this.editable ? "Configurar fases" : "Ver fases";
    this.trigger.title = this.current.map(entry => STAGE_NAMES[entry.stage]).join(" → ");
    this.trigger.textContent += ` (${this.current.length})`;
    this.sb4Preset.disabled = !this.editable;
    if (!this.inLobby) {
      this.close();
      return;
    }
    if (this.dialog.open && (!editable || permissionChanged)) {
      this.draft = this.current.map(entry => ({ ...entry }));
      this.render();
    }
  }

  close(): void {
    this.drag.cancel();
    if (this.dialog.open) this.dialog.close();
  }

  private open(): void {
    if (!this.inLobby) return;
    this.draft = this.current.map(entry => ({ ...entry }));
    this.render();
    if (!this.dialog.open) this.dialog.showModal();
  }

  private render(): void {
    this.drag.cancel();
    this.list.replaceChildren(...this.draft.map((entry, index) => this.row(entry, index)));
    this.summary.textContent = `${this.draft.length} de ${MAX_STAGE_ROTATION} fases na sequência${this.editable ? "" : " · Só o anfitrião pode alterar"}`;
    this.save.hidden = !this.editable;
    this.sb4Preset.disabled = !this.editable;
    for (const add of this.additions) add.disabled = !this.editable || this.draft.length >= MAX_STAGE_ROTATION;
  }

  private row(entry: StageRotationEntry, index: number): HTMLElement {
    const preview = el("span", { class: "stage-preview-box" }, [stagePreview(entry.stage)]);
    const stage = el("select");
    for (const id of SELECTABLE_STAGES) {
      const option = el("option", { text: STAGE_NAMES[id] });
      option.value = id;
      stage.appendChild(option);
    }
    stage.value = entry.stage;
    stage.disabled = !this.editable;
    stage.setAttribute("aria-label", `Fase ${index + 1}`);
    stage.addEventListener("change", () => {
      if (!this.editable) return;
      entry.stage = stage.value as StageId;
      preview.replaceChildren(stagePreview(entry.stage));
    });
    const up = this.moveButton(index, -1);
    const down = this.moveButton(index, 1);
    const remove = button("✕", () => {
      if (!this.editable || this.draft.length === 1) return;
      this.draft.splice(index, 1);
      this.render();
      this.list.querySelector<HTMLSelectElement>("select")?.focus();
    }, "ghost");
    remove.disabled = !this.editable || this.draft.length === 1;
    remove.setAttribute("aria-label", `Remover fase ${index + 1}`);
    const handle = button("⠿", () => {}, "stage-drag-handle ghost");
    handle.disabled = !this.editable || this.draft.length < 2;
    handle.setAttribute("aria-label", `Arrastar fase ${index + 1} para reordenar`);
    handle.title = "Arraste para mudar a ordem; ou use as setas ao lado";
    const row = el("li", { class: "stage-rotation-row" }, [el("span", { class: "stage-order-box" }, [handle, el("span", { class: "stage-order", text: String(index + 1) })]), preview, stage,
      el("div", { class: "stage-row-actions" }, [up, down, remove])]);
    this.drag.bind(handle, row, index);
    return row;
  }

  private moveButton(index: number, direction: -1 | 1): HTMLButtonElement {
    const target = index + direction;
    const control = button(direction === -1 ? "↑" : "↓", () => {
      if (!this.editable || target < 0 || target >= this.draft.length) return;
      [this.draft[index], this.draft[target]] = [this.draft[target]!, this.draft[index]!];
      this.render();
      this.list.children[target]?.querySelector<HTMLSelectElement>("select")?.focus();
    }, "ghost");
    control.disabled = !this.editable || target < 0 || target >= this.draft.length;
    control.setAttribute("aria-label", `${direction === -1 ? "Subir" : "Descer"} fase ${index + 1}`);
    return control;
  }
}
