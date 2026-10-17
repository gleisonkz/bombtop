import { button, el, storage } from "./dom";

export type OnlineChoice = { kind: "public" } | { kind: "create" } | { kind: "join"; code: string };

export interface MenuHandlers {
  local(): void;
  online(choice: OnlineChoice, name: string): void;
}

const NAME_KEY = "bombtopia.name";

/** Main menu overlay. */
export class Menu {
  private readonly root: HTMLElement;
  private readonly error = el("p", { class: "error" });
  private readonly name: HTMLInputElement;
  private readonly code: HTMLInputElement;
  private readonly buttons: HTMLButtonElement[];

  constructor(parent: HTMLElement, handlers: MenuHandlers) {
    this.name = el("input");
    this.name.placeholder = "Seu nome";
    this.name.maxLength = 16;
    this.name.value = storage.get(NAME_KEY) ?? "";

    this.code = el("input");
    this.code.placeholder = "Código da sala";
    this.code.autocapitalize = "off";

    const go = (choice: OnlineChoice) => {
      storage.set(NAME_KEY, this.name.value.trim());
      handlers.online(choice, this.name.value);
    };
    const joinByCode = () => {
      const code = this.code.value.trim();
      if (!code) return this.showError("Digite o código da sala.");
      go({ kind: "join", code });
    };
    this.code.addEventListener("keydown", (e) => e.key === "Enter" && joinByCode());

    this.buttons = [
      button("Jogar online", () => go({ kind: "public" }), "primary"),
      button("Criar sala privada", () => go({ kind: "create" })),
      button("Entrar", joinByCode),
      button("Jogo local (2 no teclado)", () => handlers.local()),
    ];
    const [publicBtn, createBtn, joinBtn, localBtn] = this.buttons;

    this.root = el("div", { class: "panel menu" }, [
      el("h1", { text: "Bombtopia" }),
      this.name,
      publicBtn,
      createBtn,
      el("div", { class: "row" }, [this.code, joinBtn]),
      el("hr"),
      localBtn,
      this.error,
      el("p", {
        class: "hint",
        text: "WASD ou setas • Espaço/Enter: bomba • Shift: ação",
      }),
    ]);
    parent.appendChild(this.root);
  }

  show(message = ""): void {
    this.root.hidden = false;
    this.setBusy(false);
    this.showError(message);
  }

  hide(): void {
    this.root.hidden = true;
  }

  setBusy(busy: boolean): void {
    for (const b of this.buttons) b.disabled = busy;
  }

  showError(message: string): void {
    this.error.textContent = message;
  }
}
