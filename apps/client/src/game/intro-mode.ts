import { publicView, TICK_RATE } from "@bombtop/shared";
import { Listener } from "../audio/cues";
import { FixedStep } from "../loop/fixed-step";
import { button, el } from "../ui/dom";
import { Intro, INTRO_VIEW } from "./intro";
import type { GameMode, ModeContext } from "./mode";

/**
 * The title intro, played once per session before the menu: the scripted Intro match in the
 * arena with each character's name card over it, then the logo. Skippable (button, Esc, Enter,
 * Space); "Tocar com som" starts it over with sound (audio needs a tap first).
 */
export class IntroMode implements GameMode {
  private intro = new Intro();
  private readonly loop = new FixedStep(1000 / TICK_RATE);
  private listener = new Listener();
  private prev = new Map<string, { px: number; py: number }>();
  private readonly root: HTMLElement;
  private readonly card: HTMLElement;
  private readonly name: HTMLElement;
  private readonly line: HTMLElement;
  private readonly logo: HTMLElement;
  private readonly withSound: HTMLButtonElement;
  private shown: string | null = null;
  private finished = false;

  constructor(
    private readonly ctx: ModeContext,
    private readonly done: () => void,
  ) {
    this.name = el("b", { class: "intro-name" });
    this.line = el("span", { class: "intro-line" });
    this.card = el("div", { class: "intro-card" }, [this.name, this.line]);
    const logo = el("h1", { class: "logo", text: "BOMB" });
    logo.append(el("span", { text: "TOP" }));
    this.logo = el("div", { class: "intro-logo" }, [logo]);
    this.withSound = button("▶ Tocar com som", () => this.replayWithSound(), "intro-sound");
    this.root = el("div", { class: "intro" }, [
      this.card,
      this.logo,
      el("div", { class: "intro-actions" }, [this.withSound, button("Pular ⏭", () => this.finish(), "intro-skip")]),
    ]);
    this.card.hidden = true;
    this.logo.hidden = true;
    document.body.appendChild(this.root);
    const s = this.intro.state;
    ctx.fit(INTRO_VIEW.width, INTRO_VIEW.height, INTRO_VIEW.x, INTRO_VIEW.y);
    ctx.renderer.setCharacters(new Map(s.players.map((p) => [p.id, p.character])));
    ctx.renderer.showBanner("");
    ctx.renderer.showClock(false);
  }

  private replayWithSound(): void {
    if (this.ctx.sound.muted) this.ctx.sound.toggleMute();
    this.intro = new Intro();
    this.listener = new Listener();
    this.shown = null;
    this.withSound.hidden = true;
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.done();
  }

  frame(deltaMs: number): void {
    if (this.finished) return;
    for (let i = this.loop.advance(deltaMs); i > 0; i--) {
      this.prev = new Map(this.intro.state.players.map((p) => [p.id, { px: p.px, py: p.py }]));
      this.intro.advance();
    }
    const view = publicView(this.intro.state);
    this.ctx.sound.cues(this.listener.hear(view), view.grid.width);
    this.ctx.renderer.draw(view, this.prev, this.loop.alpha);
    this.showCard();
    if (this.intro.done) this.finish();
  }

  /** The current name card, restarting its animation when it changes. */
  private showCard(): void {
    const card = this.intro.card();
    const key = card?.name ?? (this.intro.logo() ? "logo" : null);
    if (key === this.shown) return;
    this.shown = key;
    this.card.hidden = !card;
    this.logo.hidden = key !== "logo";
    if (card) {
      this.name.textContent = card.name;
      this.line.textContent = card.line;
      this.card.classList.remove("in");
      void this.card.offsetWidth; // restart the CSS animation
      this.card.classList.add("in");
    }
  }

  keyDown(code: string): boolean {
    if (code !== "Escape" && code !== "Enter" && code !== "Space") return false;
    this.finish();
    return true;
  }

  keyUp(): void {}

  blur(): void {}

  dispose(): void {
    this.root.remove();
    this.ctx.renderer.showClock(true);
  }
}
