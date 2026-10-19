import { publicView, TICK_RATE } from "@bombtop/shared";
import { Listener } from "../audio/cues";
import { FixedStep } from "../loop/fixed-step";
import { button } from "../ui/dom";
import { DemoMatch } from "./demo";
import type { GameMode, ModeContext } from "./mode";

/** Watch bots play each other, match after match, until the player leaves (Esc or the button). */
export class DemoGame implements GameMode {
  private readonly demo = new DemoMatch();
  private readonly loop = new FixedStep(1000 / TICK_RATE);
  private readonly listener = new Listener();
  private readonly leaveBtn: HTMLButtonElement;
  private prev = new Map<string, { px: number; py: number }>();

  constructor(private readonly ctx: ModeContext) {
    this.leaveBtn = button("Sair da demo", () => ctx.exit(), "demo-leave");
    document.body.appendChild(this.leaveBtn);
    this.start();
  }

  private start(): void {
    const s = this.demo.state;
    this.ctx.fit(s.grid.width, s.grid.height);
    this.ctx.renderer.setCharacters(new Map(s.players.map((p) => [p.id, p.character])));
    this.ctx.renderer.showBanner("");
  }

  frame(deltaMs: number): void {
    for (let i = this.loop.advance(deltaMs); i > 0; i--) {
      const before = this.demo.state;
      const playing = this.demo.winner === undefined;
      this.prev = new Map(before.players.map((p) => [p.id, { px: p.px, py: p.py }]));
      this.demo.advance();
      if (this.demo.state !== before) this.start();
      else if (playing && this.demo.winner !== undefined) {
        const n = this.demo.winner ? Number(this.demo.winner.replace("bot", "")) : 0;
        this.ctx.renderer.showBanner(n ? `Bot ${n} venceu!` : "Empate!");
        this.ctx.sound.play("end");
      }
    }
    const view = publicView(this.demo.state);
    this.ctx.sound.cues(this.listener.hear(view), view.grid.width);
    this.ctx.renderer.draw(view, this.prev, this.loop.alpha);
  }

  keyDown(code: string): boolean {
    if (code !== "Escape") return false;
    this.ctx.exit();
    return true;
  }

  keyUp(): void {}

  blur(): void {}

  dispose(): void {
    this.leaveBtn.remove();
    this.ctx.renderer.showBanner("");
  }
}
