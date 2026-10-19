import { Application } from "pixi.js";
import { publicView, TICK_RATE, type ItemKind } from "@bombtop/shared";
import { SHOWCASE_VIEW, Showcase } from "../game/showcase";
import { FixedStep } from "../loop/fixed-step";
import { Renderer, TILE_PX } from "../render/renderer";
import { SHEETS } from "../render/sprites";

/**
 * A small arena that plays an item's showcase scene, for the item guide. Made on
 * first use; paused while the guide is closed.
 */
export class ItemPreview {
  private app: Application | null = null;
  private renderer: Renderer | null = null;
  private show: Showcase | null = null;
  private readonly loop = new FixedStep(1000 / TICK_RATE);
  private prev = new Map<string, { px: number; py: number }>();
  private ready: Promise<void> | null = null;

  /** Plays `kind` in `host` (the canvas moves there if it was elsewhere). */
  async play(kind: ItemKind, host: HTMLElement): Promise<void> {
    await (this.ready ??= this.init());
    const app = this.app!;
    if (app.canvas.parentElement !== host) host.appendChild(app.canvas);
    this.show = new Showcase(kind);
    this.resize(host);
    app.ticker.start();
  }

  pause(): void {
    this.app?.ticker.stop();
  }

  private async init(): Promise<void> {
    const app = (this.app = new Application());
    await app.init({ backgroundAlpha: 0, antialias: false, resolution: window.devicePixelRatio || 1, autoDensity: true });
    const r = (this.renderer = new Renderer());
    app.stage.addChild(r.root);
    r.setCharacters(new Map([["you", "bomb"], ["rival", "ninja"]]));
    await Promise.all([
      r.useTileArt(),
      r.useItemArt(),
      r.useBombArt(),
      r.useFlameArt(),
      r.useSheet("bomb", SHEETS.bomber),
      r.useSheet("ninja", SHEETS.ninja),
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

  private frame(deltaMs: number): void {
    const show = this.show;
    if (!show) return;
    for (let i = this.loop.advance(deltaMs); i > 0; i--) {
      this.prev = new Map(show.state.players.map((p) => [p.id, { px: p.px, py: p.py }]));
      show.advance();
    }
    this.renderer!.draw(publicView(show.state), this.prev, this.loop.alpha);
  }
}
