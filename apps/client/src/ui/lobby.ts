import type { LobbyInfo } from "@bombtopia/shared";
import { button, el } from "./dom";

const STAGE_NAMES: Record<LobbyInfo["stage"], string> = {
  classic: "Clássica",
  conveyor: "Esteiras",
  warp: "Teleportes",
};

export interface LobbyHandlers {
  start(): void;
  leave(): void;
}

/** Lobby overlay: room code, members and the host's start button. */
export class LobbyPanel {
  private readonly root: HTMLElement;
  private readonly code = el("code");
  private readonly list = el("ul", { class: "members" });
  private readonly status = el("p", { class: "hint" });
  private readonly startBtn: HTMLButtonElement;

  constructor(parent: HTMLElement, handlers: LobbyHandlers) {
    this.startBtn = button("Começar partida", handlers.start, "primary");
    const copy = button("Copiar", () => void navigator.clipboard?.writeText(this.code.textContent ?? ""));
    this.root = el("div", { class: "panel lobby" }, [
      el("h2", { text: "Sala" }),
      el("div", { class: "row" }, [this.code, copy]),
      this.list,
      this.status,
      this.startBtn,
      button("Sair", handlers.leave),
    ]);
    this.root.hidden = true;
    parent.appendChild(this.root);
  }

  update(info: LobbyInfo, me: string): void {
    this.root.hidden = info.phase !== "lobby";
    this.code.textContent = info.code;
    this.list.replaceChildren(
      ...info.members.map((m) =>
        el("li", { class: m.id === me ? "me" : "" }, [
          el("span", { text: `${m.id === info.hostId ? "👑 " : ""}${m.name}${m.id === me ? " (você)" : ""}` }),
          el("span", { class: "wins", text: `${m.wins} 🏆${m.connected ? "" : " • reconectando…"}` }),
        ]),
      ),
    );
    const isHost = info.hostId === me;
    const enough = info.members.length >= 2;
    this.startBtn.hidden = !isHost;
    this.startBtn.disabled = !enough;
    this.status.textContent = !enough
      ? "Esperando mais jogadores… compartilhe o código."
      : isHost
        ? `Próxima fase: ${STAGE_NAMES[info.stage]}`
        : "Esperando o anfitrião começar…";
  }

  hide(): void {
    this.root.hidden = true;
  }
}
