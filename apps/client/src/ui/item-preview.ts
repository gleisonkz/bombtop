import { Application } from "pixi.js";
import { CHARACTERS, publicView, TICK_RATE, type ItemKind, type PublicView } from "@bombtop/shared";
import { SHOWCASE_VIEW, Showcase } from "../game/showcase";
import { FixedStep } from "../loop/fixed-step";
import { Renderer, TILE_PX } from "../render/renderer";
import { CHARACTER_SHEETS } from "./sheet-art";
import { PLAYER_COLORS } from "./art";
import { ORIGINAL } from "../render/per-color";

/**
 * A small arena that plays a showcase scene (an item or a special in use), for the
 * guides. Made on first use; paused while the guide is closed.
 */
export class ItemPreview {
  private app: Application | null = null;
  private renderer: Renderer | null = null;
  private show: Showcase | null = null;
  private readonly loop = new FixedStep(1000 / TICK_RATE);
  private prev = new Map<string, { px: number; py: number }>();
  private ready: Promise<void> | null = null;
  private playback = 0;
  private characterColor = ORIGINAL;

  /** `onView` sees every frame drawn (to hear the scene). */
  constructor(private readonly onView: (view: PublicView) => void = () => {}, private readonly options: { characterColors?: boolean } = {}) {}

  setCharacterColor(color: string | null): void {
    if (!this.options.characterColors) return;
    this.characterColor = PLAYER_COLORS.findIndex(choice => choice === color);
    this.applyColors();
    if (this.show && this.renderer) this.frame(0, false);
  }

  private applyColors(): void {
    if (!this.show || !this.renderer) return;
    const colors = new Map(this.show.colors);
    if (this.options.characterColors) colors.set("you", this.characterColor);
    this.renderer.setColors(colors);
  }

  /** Plays `scene` (an item's, or any showcase) in `host` (the canvas moves there if it was elsewhere). */
  async play(scene: ItemKind | Showcase, host: HTMLElement): Promise<void> {
    const playback = ++this.playback;
    this.app?.ticker.stop();
    await (this.ready ??= this.init());
    if (playback !== this.playback) return;
    const app = this.app!;
    if (app.canvas.parentElement !== host) host.appendChild(app.canvas);
    const show = (this.show = scene instanceof Showcase ? scene : new Showcase(scene));
    this.renderer!.setCharacters(new Map(show.state.players.map((p) => [p.id, p.character])));
    this.applyColors();
    this.resize(host);
    app.ticker.start();
  }

  pause(): void {
    this.playback++;
    this.app?.ticker.stop();
  }

  private async init(): Promise<void> {
    const app = (this.app = new Application());
    await app.init({ backgroundAlpha: 0, antialias: false, resolution: window.devicePixelRatio || 1, autoDensity: true });
    const r = (this.renderer = new Renderer(false));
    app.stage.addChild(r.root);
    await Promise.all([
      r.useTileArt(),
      r.useItemArt(),
      r.useBombArt(),
      r.useFlameArt(),
      r.useKameArt(),
      r.useRasenganArt(),
      r.useBubbleArt(),
      r.usePatronusArt("menu"),
      r.useTruckArt(),
      r.useBallArt(),
      r.useSpiralArt(),
      ...CHARACTERS.map((c) => r.useSheet(c, CHARACTER_SHEETS[c])),
    ]).catch((e) => console.error("item preview art", e));
    app.ticker.add((t) => this.frame(t.deltaMS));
    window.addEventListener("resize", () => app.canvas.parentElement && this.resize(app.canvas.parentElement));
  }

  /** Fits the scene's window of the arena to the host's width. */
  private resize(host: HTMLElement): void {
    const app = this.app!;
    const w = SHOWCASE_VIEW.width * TILE_PX;
    const h = SHOWCASE_VIEW.height * TILE_PX;
    const scale = Math.max(1, host.clientWidth) / w;
    app.renderer.resize(Math.floor(w * scale), Math.floor(h * scale));
    app.stage.scale.set(scale);
    app.stage.position.set(-SHOWCASE_VIEW.x * TILE_PX * scale, -SHOWCASE_VIEW.y * TILE_PX * scale);
  }

  private frame(deltaMs: number, emitAudio = true): void {
    const show = this.show;
    if (!show) return;
    for (let i = this.loop.advance(deltaMs); i > 0; i--) {
      this.prev = new Map(show.state.players.map((p) => [p.id, { px: p.px, py: p.py }]));
      show.advance();
    }
    const view = publicView(show.state);
    if (this.options.characterColors) {
      const caster = view.players.find(player => player.id === "you");
      if (caster) {
        if (this.characterColor === ORIGINAL) caster.ownColors = true;
        else delete caster.ownColors;
      }
    }
    if (emitAudio) this.onView(view);
    this.renderer!.draw(view, this.prev, this.loop.alpha);
  }
}
