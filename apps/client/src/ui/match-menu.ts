import { otherStyle, type ControlStyle } from "../input/control-style";
import { button, el } from "./dom";
import { isTouchDevice } from "./touch-controls";

const STYLE_NAMES: Record<ControlStyle, string> = { dpad: "Setas", stick: "Joystick" };

export interface MatchMenuHandlers {
  /** The player switched how touch steering works. */
  style(style: ControlStyle): void;
  /** Leave the match for the main menu. */
  leave(): void;
}

/**
 * The ☰ button in a match's corner: switch touch controls (setas / joystick) and leave the match.
 * Leaving asks for a second tap, so a stray touch never throws a match away.
 */
export class MatchMenu {
  private readonly root: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly styleBtn: HTMLButtonElement;
  private readonly leaveBtn: HTMLButtonElement;
  private confirmTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    parent: HTMLElement,
    private style: ControlStyle,
    private readonly handlers: MatchMenuHandlers,
  ) {
    const toggle = button("☰", () => this.open(this.panel.hidden), "match-menu-btn");
    toggle.setAttribute("aria-label", "Menu da partida");
    this.styleBtn = button("", () => this.switchStyle(), "ghost");
    this.leaveBtn = button("Sair da partida", () => this.leave(), "match-leave");
    this.panel = el("div", { class: "match-panel" }, [
      isTouchDevice() ? el("span", { text: "Controles" }) : null,
      isTouchDevice() ? this.styleBtn : null,
      this.leaveBtn,
    ]);
    this.root = el("div", { class: "match-menu" }, [toggle, this.panel]);
    this.root.hidden = true;
    this.open(false);
    this.showStyle();
    document.addEventListener("pointerdown", (e) => {
      if (!this.panel.hidden && !(e.target as Element).closest?.(".match-menu")) this.open(false);
    });
    parent.appendChild(this.root);
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
    if (!visible) this.open(false);
  }

  private open(open: boolean): void {
    this.panel.hidden = !open;
    clearTimeout(this.confirmTimer);
    this.leaveBtn.textContent = "Sair da partida";
    this.leaveBtn.classList.remove("sure");
  }

  private switchStyle(): void {
    this.style = otherStyle(this.style);
    this.showStyle();
    this.handlers.style(this.style);
  }

  private showStyle(): void {
    this.styleBtn.textContent = `🎮 ${STYLE_NAMES[this.style]} (trocar)`;
  }

  private leave(): void {
    if (!this.leaveBtn.classList.contains("sure")) {
      this.leaveBtn.textContent = "Toque de novo pra sair";
      this.leaveBtn.classList.add("sure");
      this.confirmTimer = setTimeout(() => this.open(!this.panel.hidden), 3000);
      return;
    }
    this.open(false);
    this.handlers.leave();
  }
}
