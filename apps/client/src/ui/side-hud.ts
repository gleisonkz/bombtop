import { specialRecharge, TICK_RATE, type CharacterId } from "@bombtop/shared";
import { CHARACTER_GUIDE } from "./character-guide";
import { el } from "./dom";
import { isTouchDevice } from "./touch-controls";

/** Room the arena must leave at each side (CSS pixels) for the panels to show. */
export const SIDE_HUD_MIN = 200;

/** Computers only (touch screens have their buttons), and only beside the arena, never over it. */
export const sideHudFits = (gap: number, touch: boolean): boolean => !touch && gap >= SIDE_HUD_MIN;

/** The special's bar: how full it is (1 = ready) and what it says. */
export function specialMeter(ticks: number, character: CharacterId): { fill: number; ready: boolean; label: string } {
  if (ticks <= 0) return { fill: 1, ready: true, label: "PRONTO!" };
  return { fill: 1 - ticks / specialRecharge(character), ready: false, label: `${Math.ceil(ticks / TICK_RATE)} s` };
}

/** What each button does, with its keys on both keyboard layouts (WASD and the arrows). */
export const CONTROL_ROWS: { what: string; keys: string[]; note?: string }[] = [
  { what: "Andar", keys: ["W A S D", "Setas"] },
  { what: "Bomba", keys: ["Espaço", "Enter"], note: "com luva: segure para erguer, solte para jogar" },
  { what: "Ação", keys: ["Shift"], note: "soco, empurrão, detonar a remota" },
  { what: "Especial", keys: ["E", "Ctrl dir."] },
  { what: "Firmar", keys: ["Q", "Num 0"], note: "segure: ninguém te empurra nem te ergue" },
  { what: "Parar chute", keys: ["R", "Num 1"], note: "freia a bomba que você chutou" },
  { what: "Sair", keys: ["Esc"] },
];

/**
 * On a computer, the empty sides of a match: the keys on the left, our special recharging on the right.
 * Outside #ui (the menus' controller ring never lands here) and it never takes a click.
 */
export class SideHud {
  private readonly left: HTMLElement;
  private readonly right: HTMLElement;
  private readonly who = el("span", { class: "side-who" });
  private readonly specialName = el("strong", { class: "side-special-name" });
  private readonly fill = el("div", { class: "side-fill" });
  private readonly label = el("span", { class: "side-label" });
  private readonly hint = el("span", { class: "side-hint" });
  private inMatch = false;
  private room = false;
  private shown = "";

  constructor(parent: HTMLElement) {
    this.left = el("aside", { class: "side-hud side-keys" }, [
      el("h3", { text: "Controles" }),
      ...CONTROL_ROWS.map(({ what, keys, note }) =>
        el("div", { class: "side-row" }, [
          el("span", { class: "side-what", text: what }),
          el("span", { class: "side-keys-list" }, keys.map((k) => el("kbd", { text: k }))),
          note ? el("span", { class: "side-note", text: note }) : null,
        ]),
      ),
      el("p", { class: "side-pad", text: "🎮 Controle: A bomba · B/X ação · Y especial" }),
    ]);
    this.right = el("aside", { class: "side-hud side-special" }, [
      el("h3", { text: "Especial" }),
      this.who,
      this.specialName,
      el("div", { class: "side-bar" }, [this.fill]),
      this.label,
      this.hint,
    ]);
    for (const panel of [this.left, this.right]) {
      panel.setAttribute("aria-hidden", "true");
      panel.hidden = true;
      parent.appendChild(panel);
    }
  }

  /** In a match (with our own controls), or not. */
  setVisible(visible: boolean): void {
    this.inMatch = visible;
    this.show();
  }

  /** The room the arena leaves at each side, from the latest fit. */
  setRoom(gap: number): void {
    this.room = sideHudFits(gap, isTouchDevice());
    for (const panel of [this.left, this.right]) panel.style.setProperty("--side-w", `${Math.min(260, gap - 32)}px`);
    this.show();
  }

  /** Our special: its character and ticks left to recharge (no character: watching, the panel hides). */
  setSpecial(ticks: number, character?: CharacterId): void {
    const key = character ? `${character}:${Math.ceil(ticks / 6)}` : "";
    if (key === this.shown) return;
    this.shown = key;
    this.right.classList.toggle("none", !character);
    if (!character) return;
    const info = CHARACTER_GUIDE.find((c) => c.id === character)!;
    const meter = specialMeter(ticks, character);
    this.who.textContent = info.name;
    this.specialName.textContent = info.special.name;
    this.fill.style.width = `${Math.round(meter.fill * 100)}%`;
    this.label.textContent = meter.label;
    this.hint.textContent = meter.ready ? "aperte E (ou Ctrl dir.)" : "recarregando…";
    this.right.classList.toggle("ready", meter.ready);
  }

  private show(): void {
    this.left.hidden = this.right.hidden = !(this.inMatch && this.room);
  }
}
