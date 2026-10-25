import { PeerLink, type LocalHost, type Wire } from "../net/local-host";
import { wifiUrl } from "../net/invite";
import { lanKnock, lanRooms, type LanPost, type LanRoom } from "../net/lan";
import { guestPairing, hostPairing, offerToHost } from "../net/rtc-pair";
import { backButton, button, el } from "./dom";

/** The pairing code as a QR code (our own generated SVG markup). */
async function qrCode(text: string): Promise<HTMLElement> {
  const { default: qrcode } = await import("qrcode-generator");
  const qr = qrcode(0, "L");
  qr.addData(text);
  qr.make();
  const box = el("div", { class: "pair-qr" });
  box.dataset.code = text;
  box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  return box;
}

/** Camera preview that resolves with the first QR code it reads; `stop()` frees the camera. */
async function scanner(): Promise<{ view: HTMLElement; result: Promise<string>; stop(): void }> {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
  const { default: jsQR } = await import("jsqr");
  const video = el("video", { class: "pair-cam" });
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  void video.play();
  const canvas = document.createElement("canvas");
  const g = canvas.getContext("2d", { willReadFrequently: true })!;
  let stopped = false;
  const stop = () => {
    stopped = true;
    for (const t of stream.getTracks()) t.stop();
  };
  const result = new Promise<string>((resolve) => {
    const look = () => {
      if (stopped) return;
      if (video.videoWidth) {
        // A smaller copy reads faster and QR codes survive it.
        const k = Math.min(1, 480 / video.videoWidth);
        canvas.width = Math.round(video.videoWidth * k);
        canvas.height = Math.round(video.videoHeight * k);
        g.drawImage(video, 0, 0, canvas.width, canvas.height);
        const found = jsQR(g.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
        if (found?.data) return resolve(found.data);
      }
      requestAnimationFrame(look);
    };
    look();
  });
  return { view: video, result, stop };
}

/** Typed or pasted code, for when there is no camera (or it was refused). */
function pasteBox(onCode: (code: string) => void): HTMLElement {
  const input = el("input", { class: "pair-paste" });
  input.placeholder = "…ou cole o código aqui";
  input.addEventListener("change", () => input.value.trim() && onCode(input.value.trim()));
  return input;
}

function copyButton(code: string, label = "Copiar código"): HTMLButtonElement {
  const b = button(label, () => {
    void navigator.clipboard?.writeText(code).then(() => (b.textContent = "Copiado!"));
  }, "ghost mini-ghost");
  return b;
}

/** How often the list of rooms on this network is asked again. */
const ROOMS_EVERY_MS = 2000;

/** One room on this network, a tap away. */
function roomRow(room: LanRoom, enter: (id: string) => void): HTMLElement {
  const full = room.players >= room.max;
  const state = room.playing ? "em partida" : full ? "cheia" : `${room.players}/${room.max}`;
  const b = button("", () => enter(room.id), "pair-room");
  b.replaceChildren(el("span", { class: "pair-room-name", text: `Sala de ${room.name || "alguém"}` }), el("span", { class: "pair-room-state", text: state }));
  b.disabled = room.playing || full;
  return b;
}

/**
 * Offline (Wi-Fi) pairing, one friend at a time, in a dialog over the game.
 * Two QR codes: the host shows one, the friend scans it and shows one back,
 * the host scans that, and the phones are connected (WebRTC, no server).
 */
export class Pairing {
  private readonly root: HTMLElement;
  private readonly title = el("h2");
  private readonly hint = el("p", { class: "pair-hint" });
  private readonly body = el("div", { class: "pair-body" });
  /** The room list's refreshes, stopped when the dialog closes. */
  private timers: ReturnType<typeof setTimeout>[] = [];
  /** Cameras to turn off when the dialog closes. */
  private cameras: (() => void)[] = [];
  /** Half-made connections to drop if the pairing is cancelled. */
  private pending: (() => void)[] = [];
  private onCancel: () => void = () => {};

  constructor(parent: HTMLElement) {
    this.root = el("div", { class: "screen pair" }, [
      el("div", { class: "card pair-card" }, [this.title, this.hint, this.body, backButton("Cancelar", () => this.cancel(), "ghost")]),
    ]);
    this.root.hidden = true;
    parent.appendChild(this.root);
  }

  /**
   * First screen: host here, pick a room open on this network (listed by the server, refreshed while shown), or
   * join a friend's by the two QR codes (no internet).
   */
  choose(host: () => void, enter: (id: string) => void, join: () => void, back: () => void, post: LanPost): void {
    this.open("Jogar offline", "Todos no mesmo Wi-Fi (ou no roteador de um dos celulares). Um celular cria a partida, os outros entram nele.", back);
    const list = el("div", { class: "pair-rooms" }, [el("p", { class: "pair-slot", text: "Procurando salas nesta rede…" })]);
    const go = (id: string) => (this.close(false), enter(id));
    const refresh = async () => {
      const rooms = await lanRooms(post);
      if (this.root.hidden || !list.isConnected) return;
      list.replaceChildren(
        ...(rooms.length
          ? rooms.map((r) => roomRow(r, go))
          : [el("p", { class: "pair-slot", text: "Nenhuma sala nesta rede ainda." })]),
      );
      this.timers.push(setTimeout(() => void refresh(), ROOMS_EVERY_MS));
    };
    void refresh();
    this.body.replaceChildren(
      button("Criar partida aqui", () => (this.close(false), host()), "primary big"),
      el("h3", { class: "pair-sub", text: "Salas nesta rede" }),
      list,
      button("Sem internet? Entrar por QR code", () => (this.close(false), join()), "ghost mini-ghost"),
    );
  }

  /**
   * The room's link as a QR code (a friend's camera opens it straight into the room) and its code `id`. On the
   * host's phone `host` also pairs by two QR codes, straight away when there is no internet (no code).
   */
  invite(id: string | null, host: LocalHost | null): void {
    if (!id) return void (host && this.hostPair(host));
    const url = wifiUrl(location.href, id);
    this.open(
      "Chamar amigos",
      "Os amigos apontam a câmera do celular pra este código, ou abrem Jogar offline e tocam na sua sala.",
      () => {},
    );
    void qrCode(url).then((qr) => {
      if (this.root.hidden) return;
      this.body.replaceChildren(
        qr,
        el("p", { class: "pair-code", text: id }),
        copyButton(url, "Copiar link"),
        ...(host ? [button("Sem internet? Parear por código", () => void this.hostPair(host), "ghost mini-ghost")] : []),
      );
    });
  }

  /** On a friend's phone: joins room `id` through the server (its link, or picked in the list). */
  joinRoom(id: string, name: string, character: string, post: LanPost): Promise<PeerLink> {
    return new Promise((resolve, reject) => {
      this.open("Entrar na sala", `Entrando na sala ${id}…`, () => reject(new Error("cancelado")));
      void (async () => {
        const pairing = await offerToHost();
        this.pending.push(pairing.cancel);
        const answer = await lanKnock(post, id, pairing.offer);
        if (this.root.hidden) return;
        this.hint.textContent = "Conectando pelo Wi-Fi…";
        const wire = await Promise.race([
          pairing.connect(answer),
          new Promise<never>((_, no) => setTimeout(() => no(new Error("Os celulares não se acharam: estão no mesmo Wi-Fi?")), 15_000)),
        ]);
        this.hint.textContent = "Conectado! Entrando…";
        const link = await PeerLink.join(wire, name, character);
        this.close(false);
        resolve(link);
      })().catch((err: Error) => {
        if (this.root.hidden) return;
        for (const drop of this.pending) drop();
        this.pending = [];
        this.hint.textContent = `Não deu pra entrar: ${err.message}.`;
      });
    });
  }

  /** On the host's phone: pair one more friend into `host`. */
  async hostPair(host: LocalHost): Promise<void> {
    this.open("Adicionar amigo", "Abrindo a câmera…", () => {});
    try {
      // The camera goes first: with it on, the browser shares this phone's real Wi-Fi address.
      // A permission prompt left unanswered doesn't hold the code up for long, though.
      const camera = scanner().catch(() => null);
      await Promise.race([camera, new Promise((r) => setTimeout(r, 4000))]);
      const pairing = await hostPairing();
      this.pending.push(pairing.cancel);
      const connect = async (answer: string) => {
        this.hint.textContent = "Conectando…";
        const wire = await pairing.accept(answer);
        host.addPeer(wire);
        this.close(false);
      };
      const fail = (err: unknown) => (this.hint.textContent = `${(err as Error).message}. Tente de novo.`);
      this.hint.textContent = "1. O amigo escaneia este código no celular dele.\n2. Depois, escaneie aqui o código que aparecer pra ele.";
      const camSlot = el("div", { class: "pair-slot" });
      this.body.replaceChildren(await qrCode(pairing.code), copyButton(pairing.code), camSlot, pasteBox((c) => void connect(c).catch(fail)));
      void camera.then((cam) => {
        if (!cam) return void (camSlot.textContent = "Sem câmera: cole o código do amigo.");
        if (this.root.hidden) return cam.stop();
        this.cameras.push(cam.stop);
        camSlot.replaceChildren(cam.view);
        void cam.result.then((c) => connect(c)).catch(fail);
      });
    } catch (err) {
      this.hint.textContent = `Não deu pra parear: ${(err as Error).message}`;
    }
  }

  /** On a friend's phone: scan the host's code, show ours back, and join once connected. */
  join(name: string, character: string): Promise<PeerLink> {
    return new Promise((resolve, reject) => {
      this.open("Entrar na partida", "Escaneie o código que aparece no celular de quem criou a partida.", () => reject(new Error("cancelado")));
      const answer = async (offer: string) => {
        this.hint.textContent = "Lendo…";
        const pairing = await guestPairing(offer);
        this.pending.push(pairing.cancel);
        this.hint.textContent = "Agora mostre este código pra quem criou a partida escanear.";
        this.body.replaceChildren(await qrCode(pairing.code), copyButton(pairing.code));
        const wire: Wire = await pairing.wire;
        this.hint.textContent = "Conectado! Entrando…";
        const link = await PeerLink.join(wire, name, character);
        this.close(false);
        resolve(link);
      };
      const fail = (err: unknown) => (this.hint.textContent = `${(err as Error).message}. Tente de novo.`);
      let read = false;
      const once = (c: string) => {
        if (read) return;
        read = true;
        for (const stop of this.cameras) stop();
        void answer(c).catch((err) => {
          read = false;
          fail(err);
        });
      };
      const camSlot = el("div", { class: "pair-slot" });
      this.body.replaceChildren(camSlot, pasteBox(once));
      void scanner()
        .then((cam) => {
          if (this.root.hidden || read) return cam.stop();
          this.cameras.push(cam.stop);
          camSlot.replaceChildren(cam.view);
          void cam.result.then(once);
        })
        .catch(() => (camSlot.textContent = "Sem câmera: cole o código de quem criou a partida."));
    });
  }

  private open(title: string, hint: string, onCancel: () => void): void {
    this.close(false);
    this.title.textContent = title;
    this.hint.textContent = hint;
    this.body.replaceChildren();
    this.onCancel = onCancel;
    this.root.hidden = false;
  }

  private cancel(): void {
    this.close(true);
  }

  /** Hides the dialog and frees the camera; `cancelled` also drops a half-made connection. */
  private close(cancelled = true): void {
    for (const stop of this.cameras) stop();
    this.cameras = [];
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    if (cancelled) {
      for (const drop of this.pending) drop();
      const cb = this.onCancel;
      this.onCancel = () => {};
      if (!this.root.hidden) cb();
    }
    this.pending = [];
    this.root.hidden = true;
  }
}
