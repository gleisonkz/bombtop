import "@fontsource/lilita-one/latin-400.css";
import { Application } from "pixi.js";
import { characterId, DEFAULT_CHARACTER } from "@bombtop/shared";
import { Sound, WebAudioBackend } from "./audio/sound";
import type { GameMode, ModeContext } from "./game/mode";
import { DemoGame } from "./game/demo-game";
import { introDue } from "./game/intro";
import { IntroMode } from "./game/intro-mode";
import { OnlineGame, SERVER_URL } from "./game/online-game";
import { fitScale } from "./render/fit";
import { Renderer, TILE_PX } from "./render/renderer";
import { SHEETS } from "./render/sprites";
import { LobbyPanel } from "./ui/lobby";
import { MatchMenu } from "./ui/match-menu";
import { controlStyle } from "./input/control-style";
import { codeFromUrl } from "./net/invite";
import { GuideRoute } from "./net/guide-route";
import { browserAddress, RoomRoute } from "./net/room-route";
import { SeatMemory, tabStore } from "./net/seat";
import { signInWithGoogle, signOut, supabase, watchAccount, type Account } from "./net/auth";
import { button, el, storage } from "./ui/dom";
import { Menu } from "./ui/menu";
import { isTouchDevice, TouchControls } from "./ui/touch-controls";

const app = new Application();
// Render at the device's pixel density: the arena is vector drawn, so any scale stays sharp.
await app.init({ backgroundAlpha: 0, antialias: false, resolution: window.devicePixelRatio || 1, autoDensity: true });
document.getElementById("app")!.appendChild(app.canvas);

const renderer = new Renderer();
app.stage.addChild(renderer.root);
if (import.meta.env.DEV) Object.assign(window, { __renderer: renderer });
// Art loads in the background; the intro waits for it so it never plays with placeholder shapes.
const art = Promise.allSettled([
  renderer.useSheet("ninja", SHEETS.ninja).catch((e) => console.error("sprite sheet", e)),
  renderer.useSheet("bomb", SHEETS.bomber).catch((e) => console.error("bomber sheet", e)),
  renderer.useSheet("captain", SHEETS.captain).catch((e) => console.error("captain sheet", e)),
  renderer.useMascots().catch((e) => console.error("mascot", e)),
  renderer.useBombArt().catch((e) => console.error("bomb art", e)),
  renderer.useFlameArt().catch((e) => console.error("flame art", e)),
  renderer.useSpiralArt().catch((e) => console.error("spiral art", e)),
  renderer.useItemArt().catch((e) => console.error("item art", e)),
  renderer.useTileArt().catch((e) => console.error("tile art", e)),
]);

let arena = { width: 13, height: 11, x: 0, y: 0 };
let mode: GameMode | null = null;

/** Fits the arena (or the window of it starting at tile x, y) to the screen. */
function fit(width: number, height: number, x = 0, y = 0): void {
  arena = { width, height, x, y };
  refit();
}

/** Fits the last arena again (the screen changed size). */
function refit(): void {
  const { width, height, x, y } = arena;
  const w = width * TILE_PX;
  const h = height * TILE_PX;
  const scale = fitScale(window.innerWidth, window.innerHeight, w, h);
  app.renderer.resize(Math.floor(w * scale), Math.floor(h * scale));
  app.stage.scale.set(scale);
  app.stage.position.set(-x * TILE_PX * scale, -y * TILE_PX * scale);
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
// Speaker button: opens a small panel with the volume slider and mute.
const silent = () => sound.muted || sound.volume === 0;
const muteBtn = button("", () => {
  soundPanel.hidden = !soundPanel.hidden;
}, "mute");
const volume = el("input");
volume.type = "range";
volume.min = "0";
volume.max = "100";
volume.value = String(Math.round(sound.volume * 100));
volume.setAttribute("aria-label", "Volume");
volume.addEventListener("input", () => {
  sound.setVolume(Number(volume.value) / 100);
  if (sound.muted && sound.volume > 0) sound.toggleMute(); // moving the slider means "I want sound"
  showMute();
});
volume.addEventListener("change", () => {
  sound.play("click");
  volume.blur(); // the game ignores keys typed into inputs: give the keyboard back
});
const muteToggle = button("", () => {
  sound.toggleMute();
  showMute();
}, "ghost");
const soundPanel = el("div", { class: "sound-panel" }, [el("span", { text: "Volume" }), volume, muteToggle]);
soundPanel.hidden = true;
document.addEventListener("pointerdown", (e) => {
  if (!soundPanel.hidden && !(e.target as Element).closest?.(".sound")) soundPanel.hidden = true;
});
function showMute(): void {
  muteBtn.innerHTML = muteIcon(silent()); // static markup
  muteBtn.setAttribute("aria-label", "Som");
  muteToggle.textContent = sound.muted ? "Ligar som" : "Sem som";
}
showMute();
document.body.appendChild(el("div", { class: "sound" }, [muteBtn, soundPanel]));

const ui = document.getElementById("ui")!;
const touch = new TouchControls(document.body);
// Touch steering (setas or joystick), switchable mid-match from the ☰ menu, which also leaves the match.
const CONTROLS_KEY = "bombtop.controls";
touch.setStyle(controlStyle(storage.get(CONTROLS_KEY)));
const matchMenu = new MatchMenu(document.body, controlStyle(storage.get(CONTROLS_KEY)), {
  style: (style) => {
    storage.set(CONTROLS_KEY, style);
    touch.setStyle(style);
  },
  leave: () => (online ? void online.leave() : ctx.exit()),
});

function setMode(next: GameMode | null, controls = !!next): void {
  mode?.dispose();
  mode = next;
  renderer.hide(); // the last frame of the previous mode must not linger behind menus
  touch.setVisible(controls);
  matchMenu.setVisible(controls);
}

// The room lives in the address (/sala/CODE) while the player is in it.
const route = new RoomRoute(browserAddress);
// So does the item guide (/itens), opened from the menu.
const guideRoute = new GuideRoute(browserAddress);
// This tab's seat, so a reload takes it back.
const seats = new SeatMemory(tabStore);

const ctx: ModeContext = {
  renderer,
  sound,
  touch: touch.input,
  fit,
  exit: (message) => {
    route.left();
    seats.forget();
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
  pickCharacter: (c) => {
    storage.set(CHARACTER_KEY, c);
    online?.pickCharacter(c);
  },
});

/** The character picked last time, used when joining the next room. */
const CHARACTER_KEY = "bombtop.character";
const savedCharacter = () => characterId(storage.get(CHARACTER_KEY)) ?? DEFAULT_CHARACTER;

let account: Account | null = null;

// The free server sleeps when idle: poke it now so it is awake by the time the player clicks.
fetch(SERVER_URL, { mode: "no-cors" }).catch(() => {});

const menu = new Menu(ui, {
  login: () => void signInWithGoogle(),
  demo: () => {
    menu.hide();
    setMode(new DemoGame(ctx), false);
  },
  logout: () => void signOut(),
  guide: (open) => {
    if (open) guideRoute.opened();
    else guideRoute.closed();
    menu.showGuide(open);
  },
  online: async (choice, name) => {
    goFullscreen();
    menu.setBusy(true);
    try {
      const character = savedCharacter();
      const who = account ? { name: account.name, token: account.token, character } : { name, character };
      const seat = choice.kind === "join" ? seats.tokenFor(choice.code) : null;
      online = await OnlineGame.connect(choice, who, ctx, lobby, seat);
      route.entered(online.code);
      seats.remember(online.code, online.seatToken);
      menu.hide();
      setMode(online);
    } catch (err) {
      console.error(err);
      route.left();
      seats.forget();
      menu.show(
        choice.kind === "join"
          ? "Não foi possível entrar: confira o código (a sala pode estar cheia ou em partida)."
          : "Não foi possível conectar ao servidor.",
      );
    }
  },
});

// An invite link, or a reload inside a room: join it.
let invite = codeFromUrl(location.href);
// Back button while in a room: leave it.
window.addEventListener("popstate", () => {
  if (route.wentBack()) void online?.leave();
  else menu.showGuide(guideRoute.isOpen());
});
if (guideRoute.isOpen()) menu.showGuide(true);

// Once per session the title intro plays before the menu (not when arriving by an invite link or on the guide).
if (!invite && !guideRoute.isOpen() && introDue(tabStore)) {
  menu.hide();
  void art.then(() => {
    if (mode) return; // the player got somewhere else meanwhile
    setMode(
      new IntroMode(ctx, () => {
        setMode(null);
        menu.show();
      }),
      false,
    );
  });
}

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
window.addEventListener("resize", refit);

refit();
