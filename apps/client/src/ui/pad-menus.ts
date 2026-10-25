import { PadNav } from "../input/pad-nav";
import { nextFocus } from "./spatial-focus";

const FOCUSABLE = "button, input, select, [tabindex]:not([tabindex='-1'])";
/** Where the ring starts on a screen, first match wins: its big button ("Jogar agora", "Começar partida"), any main one, anything but its way back. */
const START = [".primary.big:not([data-pad-back])", ".primary:not([data-pad-back])", ":not([data-pad-back])"];

/**
 * The menus with a controller (the couch, the TV): d-pad or stick moves a ring between the buttons on screen, A presses
 * the one ringed, B presses the screen's way back (`data-pad-back`). Only the screens under `root` count, so in a match
 * (nothing shown there) the controller is the game's alone.
 */
export class PadMenus {
  private ringed: HTMLElement | null = null;
  /** Where the ring is among the screen's buttons, to put it back when the screen is redrawn. */
  private ringedAt = 0;

  constructor(
    private readonly root: HTMLElement,
    private readonly nav = new PadNav(),
  ) {
    // Mouse, touch or keyboard back in use: the ring goes.
    for (const type of ["pointerdown", "keydown"]) window.addEventListener(type, () => this.ring(null), { capture: true });
  }

  /** One poll (each frame). */
  tick(now: number): void {
    const cmd = this.nav.sample(now);
    const lost = !!this.ringed && !this.ringed.isConnected;
    // Nothing pressed and no ring to put back: the buttons on screen are not looked up (every frame, that cost a phone
    // seconds on the menu).
    if (!cmd && !lost) return;
    const targets = this.targets();
    if (targets.length === 0) {
      this.nav.reset(); // the press that ends a match must not also press a button on the screen after it
      return this.ring(null);
    }
    // The screen was redrawn (the lobby rebuilds its seats on every change): the ring goes back to the same place.
    if (lost) this.ring(targets[Math.min(this.ringedAt, targets.length - 1)]!);
    if (!cmd) return;
    const at = targets.indexOf(document.activeElement as HTMLElement);
    if (cmd === "back") return targets.find((t) => t.matches("[data-pad-back]"))?.click();
    if (cmd === "prev" || cmd === "next") return this.step(targets, cmd);
    // Nothing ringed yet on this screen: start on its main button (a guide's first card), never on its way back.
    if (at < 0) return this.ring(START.map((s) => targets.find((t) => t.matches(s))).find(Boolean) ?? targets[0]!);
    if (cmd === "confirm") {
      if (!(targets[at] instanceof HTMLInputElement)) targets[at]!.click();
      return;
    }
    const next = nextFocus(at, targets.map((t) => t.getBoundingClientRect()), cmd);
    if (next !== null) this.ring(targets[next]!);
  }

  /**
   * L1/R1: presses the `data-pad-prev`/`data-pad-next` button of the card the ring is on (a seat's character), or of
   * the player's own card (`.me`) when the ring is elsewhere.
   */
  private step(targets: HTMLElement[], cmd: "prev" | "next"): void {
    const want = cmd === "prev" ? "[data-pad-prev]" : "[data-pad-next]";
    for (let box = this.ringed?.parentElement; box && box !== this.root; box = box.parentElement) {
      const hit = targets.find((t) => t.matches(want) && box.contains(t));
      if (hit) return hit.click();
    }
    targets.find((t) => t.matches(want) && t.closest(".me"))?.click();
  }

  private targets(): HTMLElement[] {
    return [...this.root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (t) => !(t as HTMLButtonElement).disabled && t.getClientRects().length > 0,
    );
  }

  private ring(target: HTMLElement | null): void {
    this.ringed?.classList.remove("pad-focus");
    this.ringed = target;
    if (!target) return;
    this.ringedAt = this.targets().indexOf(target);
    target.classList.add("pad-focus");
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
}
