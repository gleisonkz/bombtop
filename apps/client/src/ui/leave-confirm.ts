import { backButton, button, el } from "./dom";

/**
 * "Sair da sala?" over the lobby or the match: Esc asks here instead of leaving at once.
 * "Continuar" has the focus (Space or Enter, bomb keys, never leave by accident) and is the way back (B on a controller).
 */
export class LeaveConfirm {
  private readonly root: HTMLElement;
  private readonly stay: HTMLButtonElement;

  constructor(parent: HTMLElement, private readonly leave: () => void) {
    this.stay = backButton("Continuar", () => this.close(), "primary leave-stay");
    const go = button("Sair da sala", () => {
      this.close();
      this.leave();
    }, "leave-go");
    this.root = el("div", { class: "leave-confirm" }, [
      el("div", { class: "leave-card" }, [
        el("h2", { text: "Sair da sala?" }),
        el("p", { text: "Você sai da partida e volta pro menu." }),
        el("div", { class: "leave-actions" }, [this.stay, go]),
      ]),
    ]);
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-modal", "true");
    this.root.hidden = true;
    parent.appendChild(this.root);
  }

  get open(): boolean {
    return !this.root.hidden;
  }

  /** Esc: asks, or (asked already) goes back to the room. */
  toggle(): void {
    if (this.open) return this.close();
    this.root.hidden = false;
    this.stay.focus();
  }

  close(): void {
    this.root.hidden = true;
  }
}
