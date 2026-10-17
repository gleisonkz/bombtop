import { Application } from "pixi.js";
import { LocalGame } from "./game/local-game";
import type { GameMode, ModeContext } from "./game/mode";
import { Renderer, TILE_PX } from "./render/renderer";

const app = new Application();
await app.init({ background: "#1b1b2f", antialias: false, roundPixels: true });
document.getElementById("app")!.appendChild(app.canvas);

const renderer = new Renderer();
app.stage.addChild(renderer.root);

let arena = { width: 13, height: 11 };
let mode: GameMode | null = null;

function fit(width = arena.width, height = arena.height): void {
  arena = { width, height };
  const w = width * TILE_PX;
  const h = height * TILE_PX;
  const scale = Math.max(1, Math.floor(Math.min(window.innerWidth / w, window.innerHeight / h)));
  app.renderer.resize(w * scale, h * scale);
  app.stage.scale.set(scale);
}

const ctx: ModeContext = {
  renderer,
  fit,
  exit: () => {
    mode?.dispose();
    mode = new LocalGame(ctx);
  },
};

app.ticker.add((ticker) => mode?.frame(ticker.deltaMS, performance.now()));

window.addEventListener("keydown", (e) => {
  if (mode?.keyDown(e.code)) e.preventDefault();
});
window.addEventListener("keyup", (e) => mode?.keyUp(e.code));
window.addEventListener("blur", () => mode?.blur());
window.addEventListener("resize", () => fit());

mode = new LocalGame(ctx);
