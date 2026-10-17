import { Application } from "pixi.js";
import { createMatch, step, TICK_RATE, type MatchState, type PlayerInput } from "@bombtopia/shared";
import { ARROWS, KeyboardInput, WASD } from "./input/keyboard";
import { FixedStep } from "./loop/fixed-step";
import { Renderer, TILE_PX, type PlayerPos } from "./render/renderer";

/** Local hot-seat prototype: two players on one keyboard. */
const LOCAL_PLAYERS = [
  { id: "p1", name: "Jogador 1", input: new KeyboardInput(WASD) },
  { id: "p2", name: "Jogador 2", input: new KeyboardInput(ARROWS) },
];

const app = new Application();
await app.init({ background: "#1b1b2f", antialias: false, roundPixels: true });
document.getElementById("app")!.appendChild(app.canvas);

const renderer = new Renderer();
app.stage.addChild(renderer.root);

let match: MatchState;
let prev = new Map<string, PlayerPos>();
let roundOver = false;
let roundOverAt = 0;
/** Ignore restart presses right after the round ends (players may still be mashing bomb). */
const RESTART_DELAY_MS = 1000;
const loop = new FixedStep(1000 / TICK_RATE);

function newRound(): void {
  match = createMatch({
    seed: (Math.random() * 2 ** 32) >>> 0,
    playerIds: LOCAL_PLAYERS.map((p) => p.id),
  });
  prev = new Map();
  roundOver = false;
  renderer.showBanner("");
  LOCAL_PLAYERS.forEach((p) => p.input.reset());
  if (import.meta.env.DEV) Object.assign(window, { __match: match });
  fit();
}

function fit(): void {
  const w = match.grid.width * TILE_PX;
  const h = match.grid.height * TILE_PX;
  const scale = Math.max(1, Math.floor(Math.min(window.innerWidth / w, window.innerHeight / h)));
  app.renderer.resize(w * scale, h * scale);
  app.stage.scale.set(scale);
}

function checkRoundEnd(): void {
  const alive = match.players.filter((p) => p.alive);
  if (alive.length > 1) return;
  roundOver = true;
  roundOverAt = performance.now();
  const winner = LOCAL_PLAYERS.find((p) => p.id === alive[0]?.id);
  renderer.showBanner(`${winner ? `${winner.name} venceu!` : "Empate!"}\n\nBomba ou R: nova partida`);
}

app.ticker.add((ticker) => {
  const ticks = loop.advance(ticker.deltaMS);
  for (let i = 0; i < ticks && !roundOver; i++) {
    prev = new Map(match.players.map((p) => [p.id, { px: p.px, py: p.py }]));
    const inputs: Record<string, PlayerInput> = {};
    for (const p of LOCAL_PLAYERS) inputs[p.id] = p.input.sample();
    step(match, inputs);
    checkRoundEnd();
  }
  renderer.draw(match, prev, roundOver ? 1 : loop.alpha);
});

window.addEventListener("keydown", (e) => {
  if (roundOver) {
    // Bomb keys also restart: some browser extensions swallow letter keys like R.
    const restartKeys = ["KeyR", WASD.bomb, ARROWS.bomb];
    if (restartKeys.includes(e.code) && performance.now() - roundOverAt > RESTART_DELAY_MS) {
      e.preventDefault();
      newRound();
    }
    return;
  }
  let handled = false;
  for (const p of LOCAL_PLAYERS) handled = p.input.keyDown(e.code) || handled;
  if (handled) e.preventDefault();
});
window.addEventListener("keyup", (e) => {
  for (const p of LOCAL_PLAYERS) p.input.keyUp(e.code);
});
window.addEventListener("blur", () => LOCAL_PLAYERS.forEach((p) => p.input.reset()));
window.addEventListener("resize", fit);

newRound();
