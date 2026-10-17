import { createMatch, matchResult, STAGES, step, TICK_RATE, type MatchState, type PlayerInput } from "@bombtopia/shared";
import { GamepadInput, gamepadAt } from "../input/gamepad";
import { ARROWS, KeyboardInput, mergeInputs, WASD } from "../input/keyboard";
import { FixedStep } from "../loop/fixed-step";
import type { PlayerPos } from "../render/renderer";
import type { GameMode, ModeContext } from "./mode";

/** Ignore restart presses right after the round ends (players may still be mashing bomb). */
const RESTART_DELAY_MS = 1000;

/** Local hot-seat game: two players on one keyboard, simulated in the browser. */
export class LocalGame implements GameMode {
  private readonly players = [
    { id: "p1", name: "Jogador 1", input: new KeyboardInput(WASD), pad: new GamepadInput(gamepadAt(0)) },
    { id: "p2", name: "Jogador 2", input: new KeyboardInput(ARROWS), pad: new GamepadInput(gamepadAt(1)) },
  ];
  private match!: MatchState;
  private prev = new Map<string, PlayerPos>();
  private roundOver = false;
  private roundOverAt = 0;
  private round = 0;
  private readonly loop = new FixedStep(1000 / TICK_RATE);

  constructor(private readonly ctx: ModeContext) {
    this.newRound();
  }

  frame(deltaMs: number): void {
    const ticks = this.loop.advance(deltaMs);
    for (let i = 0; i < ticks && !this.roundOver; i++) {
      this.prev = new Map(this.match.players.map((p) => [p.id, { px: p.px, py: p.py }]));
      const inputs: Record<string, PlayerInput> = {};
      for (const p of this.players) inputs[p.id] = mergeInputs([p.input.sample(), p.pad.sample()]);
      step(this.match, inputs);
      this.checkRoundEnd();
    }
    this.ctx.renderer.draw(this.match, this.prev, this.roundOver ? 1 : this.loop.alpha);
  }

  keyDown(code: string): boolean {
    if (code === "Escape") {
      this.ctx.exit();
      return true;
    }
    if (this.roundOver) {
      // Bomb keys also restart: some browser extensions swallow letter keys like R.
      const restartKeys = ["KeyR", WASD.bomb, ARROWS.bomb];
      if (restartKeys.includes(code) && performance.now() - this.roundOverAt > RESTART_DELAY_MS) this.newRound();
      return restartKeys.includes(code);
    }
    let handled = false;
    for (const p of this.players) handled = p.input.keyDown(code) || handled;
    return handled;
  }

  keyUp(code: string): void {
    for (const p of this.players) p.input.keyUp(code);
  }

  blur(): void {
    for (const p of this.players) p.input.reset();
  }

  dispose(): void {
    this.ctx.renderer.showBanner("");
  }

  private newRound(): void {
    this.match = createMatch({
      seed: (Math.random() * 2 ** 32) >>> 0,
      playerIds: this.players.map((p) => p.id),
      stage: STAGES[this.round++ % STAGES.length]!,
    });
    this.prev = new Map();
    this.roundOver = false;
    this.ctx.renderer.showBanner("");
    this.blur();
    if (import.meta.env.DEV) Object.assign(window, { __match: this.match });
    this.ctx.fit(this.match.grid.width, this.match.grid.height);
  }

  private checkRoundEnd(): void {
    const result = matchResult(this.match);
    if (!result.over) return;
    this.roundOver = true;
    this.roundOverAt = performance.now();
    const winner = this.players.find((p) => p.id === result.winnerId);
    this.ctx.renderer.showBanner(
      `${winner ? `${winner.name} venceu!` : "Empate!"}\n\nBomba ou R: nova partida\nEsc: menu`,
    );
  }
}
