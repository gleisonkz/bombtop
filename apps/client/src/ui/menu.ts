import type { PublicView } from "@bombtop/shared";
import type { SoundName } from "../audio/sound";
import { specialShowcase } from "../game/showcase";
import { MASCOT_COLOR, PLAYER_COLORS } from "./art";
import { characterGuide } from "./character-guide";
import { connectingText } from "./connecting";
import { itemGuide } from "./item-guide";
import { ItemPreview } from "./item-preview";
import { freshReload, liteOn, toggleDebug, toggleLite, versionLabel, debugOn } from "./dev-tools";
import { button, el, storage } from "./dom";
import { characterArt, titleBomberArt } from "./sheet-art";
import { shrinkToFit } from "./shrink-to-fit";

/** `watch`: this screen only shows the room's match (TV mode), with no seat. */
export type OnlineChoice = { kind: "public" } | { kind: "create" } | { kind: "join"; code: string } | { kind: "watch"; code: string };

export interface MenuHandlers {
  online(choice: OnlineChoice, name: string): void;
  /** Watch bots play each other. */
  demo(): void;
  /** Play with friends nearby over Wi-Fi, no internet (the typed name is theirs). */
  offline(name: string): void;
  /** Play on this one screen, a controller per player (the TV mode). */
  couch(name: string): void;
  /** A guide (items or characters) was opened, or closed (null) from its buttons. */
  guide(open: Guide | null): void;
  /** A sound to play from the character guide: a voice line, or the scene shown. */
  hear(sound: SoundName): void;
  hearScene(view: PublicView): void;
  login(): void;
  logout(): void;
}

export type Guide = "items" | "characters";

const NAME_KEY = "bombtop.name";

/** Main menu overlay. */
export class Menu {
  private readonly root: HTMLElement;
  private readonly error = el("p", { class: "error" });
  private readonly status = el("p", { class: "status" });
  private statusTimer: ReturnType<typeof setInterval> | undefined;
  private readonly name: HTMLInputElement;
  private readonly code: HTMLInputElement;
  private readonly buttons: HTMLButtonElement[];
  private readonly account = el("div", { class: "account" });
  private readonly joinByCode: () => void;
  /** Shows a guide instead of the menu card, or the card again (null). */
  readonly showGuide: (guide: Guide | null) => void;

  private readonly handlers: MenuHandlers;

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
    const joinByCode = (this.joinByCode = () => {
      const code = this.code.value.trim();
      if (!code) return this.showError("Digite o código da sala.");
      go({ kind: "join", code });
    });
    this.code.addEventListener("keydown", (e) => e.key === "Enter" && joinByCode());
    // TV mode: this screen shows the room's match to the couch, with no seat.
    const watchByCode = () => {
      const code = this.code.value.trim();
      if (!code) return this.showError("Digite o código da sala para assistir na TV.");
      go({ kind: "watch", code });
    };

    this.buttons = [
      button("▶  Jogar agora", () => go({ kind: "public" }), "primary big play"),
      button("Criar sala com amigos", () => go({ kind: "create" }), "create"),
      button("Entrar", joinByCode),
      button("📺", watchByCode, "tv-btn"),
    ];
    const [publicBtn, createBtn, joinBtn, tvBtn] = this.buttons;
    tvBtn!.title = "Assistir na TV (só mostra a partida da sala)";
    tvBtn!.setAttribute("aria-label", "Assistir na TV");

    // Debug mode: a connection readout in game, also logged on the server for us to read.
    const debugLabel = (on: boolean) => `Modo debug: ${on ? "ligado" : "desligado"}`;
    const debugBtn = button(debugLabel(debugOn(location.search, storage)), () => {
      debugBtn.textContent = debugLabel(toggleDebug(storage));
    }, "link");
    // Lite mode (on by itself on smart TVs): applies on the reload it triggers.
    const liteLabel = `Modo leve: ${liteOn(navigator.userAgent, location.search, storage) ? "ligado" : "desligado"}`;
    const liteBtn = button(liteLabel, () => {
      toggleLite(navigator.userAgent, storage);
      location.reload();
    }, "link");

    this.handlers = handlers;
    const logo = el("h1", { class: "logo", text: "BOMB" });
    logo.append(el("span", { text: "TOP" }));
    const card = el("div", { class: "card" }, [
      el("h2", { class: "card-title", text: "Bora jogar?" }),
      this.account,
      this.name,
      publicBtn,
      createBtn,
      el("div", { class: "or", text: "ou entre com um código" }),
      el("div", { class: "row" }, [this.code, joinBtn, tvBtn]),
      this.status,
      this.error,
      el("div", { class: "row extras" }, [
        button("Ver itens", () => handlers.guide("items"), "ghost"),
        button("Personagens", () => handlers.guide("characters"), "ghost"),
      ]),
      button("Assistir demo", () => handlers.demo(), "ghost demo-btn"),
      button("📶 Jogar offline (Wi-Fi)", () => {
        storage.set(NAME_KEY, this.name.value.trim());
        handlers.offline(this.name.value);
      }, "ghost offline-btn"),
      // Shown on computers, and on touch screens once a controller is plugged in (index.html).
      button("🎮 Vários controles (mesma tela)", () => {
        storage.set(NAME_KEY, this.name.value.trim());
        handlers.couch(this.name.value);
      }, "ghost couch-btn"),
      el("p", { class: "hint keys-hint", text: "WASD ou setas • Espaço: bomba • Shift: ação" }),
      // Tools for us, kept small: version, debug readout, reload past a stale cache.
      el("div", { class: "menu-foot" }, [
        el("span", { text: versionLabel(__APP_VERSION__) }),
        debugBtn,
        liteBtn,
        button("Atualizar jogo", () => void freshReload(), "link"),
      ]),
    ]);
    const preview = new ItemPreview();
    const items = itemGuide({
      close: () => handlers.guide(null),
      show: (kind, stage) => void preview.play(kind, stage).catch((e) => console.error("item preview", e)),
    });
    // The characters' scenes are heard (their specials' sounds); the items' play silent.
    const charPreview = new ItemPreview((view) => handlers.hearScene(view));
    const characters = characterGuide({
      close: () => handlers.guide(null),
      show: (c, stage) => void charPreview.play(specialShowcase(c), stage).catch((e) => console.error("character preview", e)),
      hear: (sound) => handlers.hear(sound),
    });
    const guides = { items, characters };
    this.showGuide = (on: Guide | null) => {
      card.hidden = !!on;
      for (const [name, g] of Object.entries(guides)) g.root.hidden = name !== on;
      this.root.classList.toggle("guiding", !!on);
      if (on) guides[on].open();
      if (on !== "items") preview.pause();
      if (on !== "characters") charPreview.pause();
    };
    items.root.hidden = characters.root.hidden = true;
    const lineup = cast();
    const hero = el("div", { class: "hero" }, [
      lineup,
      logo,
      el("p", { class: "tagline", text: "Batalha de bombas online com até 5 amigos" }),
      el(
        "ul",
        { class: "perks" },
        ["Grátis", "Sem download", "PC, tablet e celular", "Bots para treinar"].map((t) => el("li", { text: t })),
      ),
    ]);
    // The lineup is wider than the hero beside the card on most computer screens: shrink it to fit.
    new ResizeObserver(() => {
      lineup.style.zoom = "";
      lineup.style.zoom = String(shrinkToFit(lineup.offsetWidth, hero.clientWidth));
    }).observe(hero);
    this.root = el("div", { class: "screen menu" }, [
      menuBackdrop(),
      hero,
      card,
      items.root,
      characters.root,
    ]);
    parent.appendChild(this.root);
  }

  /**
   * Shows the Google login state. `available` is false when Supabase is not
   * configured (guest-only build): the account row stays empty.
   */
  setAccount(account: { name: string } | null, available: boolean): void {
    this.name.hidden = !!account;
    if (!available) return this.account.replaceChildren();
    this.account.replaceChildren(
      ...(account
        ? [el("span", { text: `Olá, ${account.name}` }), button("Sair", () => this.handlers.logout())]
        : [button("Entrar com Google", () => this.handlers.login())]),
    );
  }

  /**
   * Opened from an invite link: fill in the room code and join right away when
   * we already know who is playing; otherwise ask only for the name.
   */
  acceptInvite(code: string, knownPlayer: boolean): void {
    this.code.value = code;
    if (knownPlayer) return this.joinByCode();
    const [publicBtn, , joinBtn] = this.buttons;
    publicBtn!.classList.remove("primary");
    joinBtn!.textContent = "Entrar na sala";
    joinBtn!.classList.add("primary");
    this.showError("Você foi convidado! Digite seu nome e toque em Entrar na sala.");
    this.error.className = "invite";
    this.name.focus();
  }

  hasName(): boolean {
    return this.name.value.trim() !== "";
  }

  show(message = ""): void {
    this.root.hidden = false;
    this.setBusy(false);
    this.showError(message);
  }

  hide(): void {
    this.root.hidden = true;
    this.setBusy(false);
  }

  /** While busy the buttons are off and a spinner tells how the connection is going. */
  setBusy(busy: boolean): void {
    for (const b of this.buttons) b.disabled = busy;
    clearInterval(this.statusTimer);
    this.status.textContent = "";
    if (!busy) return;
    this.showError("");
    const since = performance.now();
    const update = () => (this.status.textContent = connectingText(performance.now() - since));
    update();
    this.statusTimer = setInterval(update, 500);
  }

  showError(message: string): void {
    this.error.className = "error";
    this.error.textContent = message;
  }
}

/**
 * The lineup on the title screen: the mascot in front, players in their arena colors at its sides, Pikachu at its feet
 * and Static on his flying disc at its other side; pelé, harry, penelope (in her own pink), the green lantern and the flash at the far left, bugs munching his carrot,
 * donatello (in his own purple), the pink panther and optimus at the far right.
 */
function cast(): HTMLElement {
  const [white, , red, blue, green] = PLAYER_COLORS;
  const member = (art: HTMLElement, cls: string) => el("span", { class: `cast-member ${cls}` }, [art]);
  return el("div", { class: "cast" }, [
    member(characterArt("pele", blue, "walk"), "edge left"),
    member(characterArt("harry", red, "walk"), "edge left"),
    member(characterArt("penelope", null, "walk"), "edge left"),
    member(characterArt("lantern", green, "walk"), "edge left"),
    member(characterArt("flash", red, "walk"), "edge left"),
    member(characterArt("naruto", white, "walk"), "edge left"),
    member(characterArt("goku", green, "walk"), "far left"),
    member(characterArt("ninja", blue, "walk"), "near left"),
    member(titleBomberArt(), "star"),
    member(characterArt("pikachu", blue, "walk"), "front"),
    member(characterArt("static", blue, "walk"), "front left"),
    member(characterArt("captain", white, "walk"), "near right"),
    member(characterArt("thor", blue, "walk"), "far right"),
    member(characterArt("spider", red, "walk"), "edge right"),
    member(characterArt("bugs", blue, "walk"), "edge right"),
    member(characterArt("donatello", null, "walk"), "edge right"),
    member(characterArt("panther", blue, "walk"), "edge right"),
    member(characterArt("optimus", blue, "walk"), "edge right"),
  ]);
}

/** Behind the menu: embers drifting up (the light rays turn behind the hero). */
function menuBackdrop(): HTMLElement {
  const embers = Array.from({ length: 18 }, (_, i) => {
    const e = el("i");
    e.style.setProperty("--x", `${(i * 37) % 100}%`);
    e.style.setProperty("--d", `${-((i * 1.7) % 9)}s`);
    e.style.setProperty("--t", `${7 + (i % 5)}s`);
    return e;
  });
  const bg = el("div", { class: "menu-bg" }, embers);
  bg.setAttribute("aria-hidden", "true");
  return bg;
}
