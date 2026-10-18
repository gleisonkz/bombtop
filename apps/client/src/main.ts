import "@fontsource/lilita-one/latin-400.css";
import { Application } from "pixi.js";
import { Sound, WebAudioBackend } from "./audio/sound";
import type { GameMode, ModeContext } from "./game/mode";
import { OnlineGame } from "./game/online-game";
import { fitScale } from "./render/fit";
import { Renderer, TILE_PX } from "./render/renderer";
import { LobbyPanel } from "./ui/lobby";
import { codeFromUrl, withoutInvite } from "./net/invite";
import { signInWithGoogle, signOut, supabase, watchAccount, type Account } from "./net/auth";
import { button, storage } from "./ui/dom";
import { Menu } from "./ui/menu";
import { isTouchDevice, TouchControls } from "./ui/touch-controls";

const app = new Application();
// Render at the device's pixel density: the arena is vector drawn, so any scale stays sharp.
await app.init({ backgroundAlpha: 0, antialias: false, resolution: window.devicePixelRatio || 1, autoDensity: true });
document.getElementById("app")!.appendChild(app.canvas);

const renderer = new Renderer();
app.stage.addChild(renderer.root);

let arena = { width: 13, height: 11 };
let mode: GameMode | null = null;

function fit(width = arena.width, height = arena.height): void {
  arena = { width, height };
  const w = width * TILE_PX;
  const h = height * TILE_PX;
  const scale = fitScale(window.innerWidth, window.innerHeight, w, h);
  app.renderer.resize(Math.floor(w * scale), Math.floor(h * scale));
  app.stage.scale.set(scale);
}

/** Phones: hide the browser bars and hold landscape. Must run inside a tap handler. */
function goFullscreen(): void {
  if (!isTouchDevice() || document.fullscreenElement) return;
  document.documentElement
    .requestFullscreen?.({ navigationUI: "hide" })
    .then(() => (screen.orientation as ScreenOrientation & { lock?(o: string): Promise<void> }).lock?.("landscape"))
    .catch(() => undefined); // unsupported (iOS Safari) or refused: keep playing windowed
}

const sound = new Sound(new WebAudioBackend(import.meta.env.BASE_URL), storage);
// Audio may only start from a user gesture: the first tap or key press turns it on.
for (const type of ["pointerdown", "keydown"]) window.addEventListener(type, () => void sound.unlock(), { capture: true, once: true });
document.addEventListener("click", (e) => (e.target as Element).closest?.("button") && sound.play("click"), { capture: true });

const SPEAKER = '<path d="M3 9v6h4l5 4V5L7 9H3z" fill="#15152a"/>';
const muteIcon = (muted: boolean) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true">${SPEAKER}${
    muted
      ? '<path d="M16 9l5 6M21 9l-5 6" stroke="#e84a4a" stroke-width="2.5" stroke-linecap="round"/>'
      : '<path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="#15152a" stroke-width="2.2" stroke-linecap="round"/>'
  }</svg>`;
const muteBtn = button("", () => showMute(sound.toggleMute()), "mute");
function showMute(muted: boolean): void {
  muteBtn.innerHTML = muteIcon(muted); // static markup
  muteBtn.setAttribute("aria-label", muted ? "Ligar som" : "Desligar som");
}
showMute(sound.muted);
document.body.appendChild(muteBtn);

const ui = document.getElementById("ui")!;
const touch = new TouchControls(document.body);

function setMode(next: GameMode | null): void {
  mode?.dispose();
  mode = next;
  touch.setVisible(!!next);
}

const ctx: ModeContext = {
  renderer,
  sound,
  touch: touch.input,
  fit,
  exit: (message) => {
    setMode(null);
    menu.show(message);
  },
};

let online: OnlineGame | null = null;
const lobby = new LobbyPanel(ui, {
  start: () => {
    goFullscreen();
    online?.start();
  },
  leave: () => void online?.leave(),
  addBot: (level) => online?.addBot(level),
  removeBot: (id) => online?.removeBot(id),
});

let account: Account | null = null;

const menu = new Menu(ui, {
  login: () => void signInWithGoogle(),
  logout: () => void signOut(),
  online: async (choice, name) => {
    goFullscreen();
    menu.setBusy(true);
    try {
      const who = account ? { name: account.name, token: account.token } : { name };
      online = await OnlineGame.connect(choice, who, ctx, lobby);
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

let invite = codeFromUrl(location.href);
if (invite) history.replaceState(null, "", withoutInvite(location.href));

watchAccount((a) => {
  account = a;
  menu.setAccount(a, !!supabase);
  // First answer tells whether we already know the player: then the link joins directly.
  if (invite) menu.acceptInvite(invite, !!a || menu.hasName());
  invite = null;
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
