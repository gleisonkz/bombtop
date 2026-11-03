import { specialRecharge, TICK_RATE, type CharacterId } from "@bombtop/shared";
import { CHARACTER_GUIDE } from "./character-guide";
import { el } from "./dom";
import type { RailCard, RailPlace, RailSide, RailSpot } from "./player-rail";
import { headPortrait } from "./head-portrait";
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
  { what: "Firmar", keys: ["Q", "Num 0"], note: "segure: ninguém te empurra nem te ergue; erguido, aperte várias vezes pra se soltar" },
  { what: "Parar chute", keys: ["R", "Num 1"], note: "freia a bomba que você chutou" },
  { what: "Sair", keys: ["Esc"] },
];

const SVG = "http://www.w3.org/2000/svg";
/** The stat icons (bomb, flame, bolt), 16 x 16. */
const ICONS = {
  bomb: '<circle cx="7" cy="9.5" r="5"/><path d="M10 5l2.5-2.5" stroke="currentColor" stroke-width="1.8"/>',
  fire: '<path d="M8 1c1 3 4 4.5 4 8.5a4 4 0 0 1-8 0c0-2 1-3.2 2-4 0 1.8.8 2.4 1.3 2.4C7.3 5.5 8 4 8 1z"/>',
  speed: '<path d="M9.5 1L3 9h4.2L6.3 15 13 6.8H8.8z"/>',
};

function stat(kind: keyof typeof ICONS, value: HTMLElement, title: string): HTMLElement {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("fill", "currentColor");
  svg.innerHTML = ICONS[kind]; // static markup
  const chip = el("span", { class: `pc-stat ${kind}`, title }, [value]);
  chip.prepend(svg);
  return chip;
}

/** A player's card on a rail: who, rounds won, power-ups, out when dead. */
class PlayerCard {
  readonly root = el("div", { class: "pcard" });
  private readonly av = el("div", { class: "pc-av" });
  private readonly name = el("span", { class: "pc-name" });
  private readonly tag = el("span", { class: "pc-tag" });
  private readonly pips = el("div", { class: "pc-pips" });
  private readonly wins = el("span", { class: "pc-wins" });
  private readonly bombs = el("b");
  private readonly fire = el("b");
  private readonly speed = el("b");
  private look = "";
  private shown = "";

  constructor() {
    this.root.append(
      el("div", { class: "pc-head" }, [this.av, el("div", { class: "pc-id" }, [this.name, this.tag])]),
      el("div", { class: "pc-score" }, [
        el("div", { class: "pc-won" }, [el("span", { class: "pc-label", text: "VITÓRIAS" }), this.pips]),
        this.wins,
      ]),
      el("div", { class: "pc-stats" }, [stat("bomb", this.bombs, "Bombas"), stat("fire", this.fire, "Fogo"), stat("speed", this.speed, "Velocidade")]),
      el("span", { class: "pc-out", text: "ELIMINADO" }),
    );
  }

  update(c: RailCard, side: RailSide): void {
    const key = JSON.stringify([c, side]);
    if (key === this.shown) return;
    this.shown = key;
    const look = `${c.character}:${c.paint}`;
    if (look !== this.look) {
      this.look = look;
      this.av.replaceChildren(headPortrait(c.character, c.paint));
    }
    this.root.className = ["pcard", side, c.out && "out", c.me && "me", c.hidden && "secret"].filter(Boolean).join(" ");
    this.root.style.setProperty("--pc", c.accent);
    this.name.textContent = c.name;
    this.tag.textContent = c.tag;
    this.pips.replaceChildren(...c.pips.map((won) => el("i", { class: won ? "won" : "" })));
    this.wins.textContent = String(c.wins);
    this.bombs.textContent = c.hidden ? "?" : String(c.bombs);
    this.fire.textContent = c.hidden ? "?" : String(c.fire);
    this.speed.textContent = c.hidden ? "?" : String(c.speed);
  }
}

type Rail = Record<RailSpot, HTMLElement>;

/**
 * On a computer, the empty sides of a match (layout A): a rail each side with every player's card at the corner of
 * the arena they spawned in, the keys between the left's, our special recharging between the right's.
 * Outside #ui (the menus' controller ring never lands here); only the keys' "ver tudo" takes a click.
 */
export class SideHud {
  private readonly rails: Record<RailSide, Rail>;
  private readonly railEls: HTMLElement[];
  private readonly keys: HTMLElement;
  private readonly special: HTMLElement;
  private readonly specialAv = el("div", { class: "pc-av big" });
  private readonly ring = el("div", { class: "side-ring" }, [this.specialAv]);
  private readonly specialName = el("strong", { class: "side-special-name" });
  private readonly label = el("span", { class: "side-label" });
  private readonly hint = el("span", { class: "side-hint" });
  private readonly cards = new Map<string, PlayerCard>();
  private inMatch = false;
  private room = false;
  private specialKey = "";
  private specialLook = "";

  constructor(parent: HTMLElement) {
    const more = el("button", { class: "side-more", text: "ver tudo" });
    more.type = "button";
    more.tabIndex = -1;
    this.keys = el("section", { class: "side-hud side-keys" }, [
      el("div", { class: "side-title" }, [el("h3", { text: "Controles" }), more]),
      ...CONTROL_ROWS.map(({ what, keys, note }) =>
        el("div", { class: "side-row" }, [
          el("span", { class: "side-what", text: what }),
          el("span", { class: "side-keys-list" }, keys.map((k) => el("kbd", { text: k }))),
          note ? el("span", { class: "side-note", text: note }) : null,
        ]),
      ),
      el("p", { class: "side-pad", text: "🎮 Controle: A bomba · B/X ação · Y especial" }),
    ]);
    more.addEventListener("click", () => {
      const full = this.keys.classList.toggle("full");
      more.textContent = full ? "menos" : "ver tudo";
      more.blur(); // the keyboard goes back to the game
    });
    this.special = el("section", { class: "side-hud side-special" }, [
      el("span", { class: "pc-label", text: "ESPECIAL" }),
      this.ring,
      this.specialName,
      this.label,
      this.hint,
    ]);
    const rail = (): Rail => ({
      top: el("div", { class: "rail-spot top" }),
      middle: el("div", { class: "rail-spot middle" }),
      bottom: el("div", { class: "rail-spot bottom" }),
    });
    this.rails = { left: rail(), right: rail() };
    this.rails.left.middle.appendChild(this.keys);
    this.rails.right.middle.appendChild(this.special);
    this.railEls = (["left", "right"] as const).map((side) => {
      const { top, middle, bottom } = this.rails[side];
      const r = el("aside", { class: `side-rail ${side}` }, [top, middle, bottom]);
      r.setAttribute("aria-hidden", "true");
      r.hidden = true;
      parent.appendChild(r);
      return r;
    });
  }

  /** In a match (with our own controls), or not. */
  setVisible(visible: boolean): void {
    this.inMatch = visible;
    this.show();
  }

  /** The room the arena leaves at each side, and its height on screen, from the latest fit. */
  setRoom(gap: number, height = window.innerHeight): void {
    this.room = sideHudFits(gap, isTouchDevice());
    for (const r of this.railEls) {
      r.style.setProperty("--side-w", `${Math.min(270, gap - 32)}px`);
      r.style.setProperty("--rail-h", `${Math.round(height)}px`);
    }
    this.show();
  }

  /** The rails are on screen (the arena's own score bar steps aside for them). */
  get shown(): boolean {
    return this.inMatch && this.room;
  }

  /** Every player's card and where it goes (null: no match). */
  setPlayers(rail: { cards: RailCard[]; places: Map<string, RailPlace> } | null): void {
    const ids = new Set(rail?.cards.map((c) => c.id));
    for (const [id, card] of this.cards) {
      if (ids.has(id)) continue;
      card.root.remove();
      this.cards.delete(id);
    }
    for (const c of rail?.cards ?? []) {
      const place = rail!.places.get(c.id);
      if (!place) continue;
      let card = this.cards.get(c.id);
      if (!card) this.cards.set(c.id, (card = new PlayerCard()));
      card.update(c, place.side);
      const spot = this.rails[place.side][place.spot];
      if (card.root.parentElement !== spot) spot.appendChild(card.root);
    }
  }

  /** Our special: its character and ticks left to recharge (no character: watching, the panel hides). */
  setSpecial(ticks: number, character?: CharacterId, paint: string | null = null): void {
    const key = character ? `${character}:${paint}:${Math.ceil(ticks / 6)}` : "";
    if (key === this.specialKey) return;
    this.specialKey = key;
    this.special.classList.toggle("none", !character);
    if (!character) return;
    const look = `${character}:${paint}`;
    if (look !== this.specialLook) {
      this.specialLook = look;
      this.specialAv.replaceChildren(headPortrait(character, paint));
    }
    const info = CHARACTER_GUIDE.find((c) => c.id === character)!;
    const meter = specialMeter(ticks, character);
    this.specialName.textContent = info.special.name;
    this.ring.style.setProperty("--fill", `${Math.round(meter.fill * 360)}deg`);
    this.label.textContent = meter.label;
    this.hint.textContent = meter.ready ? "aperte E ou Ctrl dir." : "recarregando…";
    this.special.classList.toggle("ready", meter.ready);
  }

  private show(): void {
    for (const r of this.railEls) r.hidden = !(this.inMatch && this.room);
  }
}
