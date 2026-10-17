import { Application } from "pixi.js";
import { LocalGame } from "./game/local-game";
import type { GameMode, ModeContext } from "./game/mode";
import { OnlineGame } from "./game/online-game";
import { Renderer, TILE_PX } from "./render/renderer";
import { LobbyPanel } from "./ui/lobby";
import { Menu } from "./ui/menu";

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

function setMode(next: GameMode | null): void {
  mode?.dispose();
  mode = next;
}

const ui = document.getElementById("ui")!;

const ctx: ModeContext = {
  renderer,
  fit,
  exit: (message) => {
    setMode(null);
    menu.show(message);
  },
};

let online: OnlineGame | null = null;
const lobby = new LobbyPanel(ui, {
  start: () => online?.start(),
  leave: () => void online?.leave(),
});

const menu = new Menu(ui, {
  local: () => {
    menu.hide();
    setMode(new LocalGame(ctx));
  },
  online: async (choice, name) => {
    menu.setBusy(true);
    try {
      online = await OnlineGame.connect(choice, name, ctx, lobby);
      menu.hide();
      setMode(online);
    } catch (err) {
      console.error(err);
      menu.show(
        choice.kind === "join"
          ? "Não foi possível entrar: confira o código (a sala pode estar cheia ou em partida)."
          : "Não foi possível conectar ao servidor.",
      );
    }
  },
});

app.ticker.add((ticker) => mode?.frame(ticker.deltaMS, performance.now()));

window.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement) return; // typing in the menu
  if (mode?.keyDown(e.code)) e.preventDefault();
});
window.addEventListener("keyup", (e) => mode?.keyUp(e.code));
window.addEventListener("blur", () => mode?.blur());
window.addEventListener("resize", () => fit());

fit();
