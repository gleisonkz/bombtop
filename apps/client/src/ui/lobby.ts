import type { LobbyInfo } from "@bombtop/shared";
import { inviteText, inviteUrl } from "../net/invite";
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
    const invite = button("Convidar", () => void this.invite(invite), "primary");
    this.root = el("div", { class: "panel lobby" }, [
      el("h2", { text: "Sala" }),
      el("div", { class: "row" }, [this.code, invite]),
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
      ? "Esperando mais jogadores… toque em Convidar e mande o link."
      : isHost
        ? `Próxima fase: ${STAGE_NAMES[info.stage]}`
        : "Esperando o anfitrião começar…";
  }

  /** Native share sheet (WhatsApp etc.) on phones; copies the message elsewhere. */
  private async invite(btn: HTMLButtonElement): Promise<void> {
    const url = inviteUrl(location.href, this.code.textContent ?? "");
    const text = inviteText(url);
    try {
      if (navigator.share) return await navigator.share({ title: "Bombtop", text });
      await navigator.clipboard.writeText(text);
      btn.textContent = "Link copiado!";
      setTimeout(() => (btn.textContent = "Convidar"), 2000);
    } catch {
      /* share sheet dismissed */
    }
  }

  hide(): void {
    this.root.hidden = true;
  }
}
