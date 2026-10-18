import { BOT_LEVELS, MAX_PLAYERS, type BotLevel, type LobbyInfo } from "@bombtop/shared";
import { inviteText, inviteUrl } from "../net/invite";
import { mascot, MASCOT_COLOR } from "./art";
import { button, el } from "./dom";
import { lobbySlots } from "./lobby-slots";

const STAGE_NAMES: Record<LobbyInfo["stage"], string> = {
  classic: "Clássica",
  conveyor: "Esteiras",
  warp: "Teleportes",
};

export const LEVEL_NAMES: Record<BotLevel, string> = { easy: "Fácil", medium: "Médio", hard: "Difícil" };

export interface LobbyHandlers {
  start(): void;
  leave(): void;
  addBot(level: BotLevel): void;
  removeBot(id: string): void;
}

/** Lobby overlay: room code and invite, a seat per player, and the host's start button. */
export class LobbyPanel {
  private readonly root: HTMLElement;
  private readonly code = el("code");
  private readonly stage = el("span", { class: "chip" });
  private readonly seats = el("div", { class: "seats" });
  private readonly status = el("p", { class: "hint" });
  private readonly startBtn: HTMLButtonElement;

  constructor(
    parent: HTMLElement,
    private readonly handlers: LobbyHandlers,
  ) {
    this.startBtn = button("Começar partida", handlers.start, "primary big");
    const invite = button("Convidar amigos", () => void this.invite(invite), "primary");
    const title = el("h2", { text: "Sala" });
    title.append(this.stage);
    this.root = el("div", { class: "screen lobby" }, [
      el("div", { class: "card" }, [
        title,
        el("div", { class: "code-box" }, [el("small", { text: "Código da sala" }), this.code]),
        invite,
        this.status,
        this.startBtn,
        button("Sair", handlers.leave, "ghost"),
      ]),
      this.seats,
    ]);
    this.root.hidden = true;
    parent.appendChild(this.root);
  }

  update(info: LobbyInfo, me: string): void {
    this.root.hidden = info.phase !== "lobby";
    this.code.textContent = info.code;
    this.stage.textContent = `Fase: ${STAGE_NAMES[info.stage]}`;
    const isHost = info.hostId === me;
    this.seats.replaceChildren(
      ...lobbySlots(info.members, MAX_PLAYERS).map(({ member, color }) => {
        if (!member && isHost) {
          return el("div", { class: "seat empty add-bot" }, [
            el("span", { class: "seat-sub", text: "+ Bot" }),
            ...BOT_LEVELS.map((level) => button(LEVEL_NAMES[level], () => this.handlers.addBot(level), `mini ${level}`)),
          ]);
        }
        if (!member) {
          return el("div", { class: "seat empty" }, [mascot({ color: MASCOT_COLOR }), el("span", { class: "seat-sub", text: "Vaga livre" })]);
        }
        const you = member.id === me;
        const cls = ["seat", you && "me", !member.connected && "away", member.bot && "bot"].filter(Boolean).join(" ");
        const sub = member.bot
          ? `🤖 ${LEVEL_NAMES[member.bot]} • ${member.wins} 🏆`
          : member.connected
            ? `${you ? "você • " : ""}${member.wins} 🏆`
            : "reconectando…";
        return el("div", { class: cls }, [
          member.id === info.hostId ? el("span", { class: "crown", text: "👑", title: "Anfitrião" }) : null,
          member.bot && isHost ? button("✕", () => this.handlers.removeBot(member.id), "kick-bot") : null,
          mascot({ color, mood: !member.connected ? "sad" : you ? "wink" : member.bot === "hard" ? "wow" : "happy" }),
          el("span", { class: "seat-name", text: member.name }),
          el("span", { class: "seat-sub", text: sub }),
        ]);
      }),
    );
    const enough = info.members.length >= 2;
    this.startBtn.hidden = !isHost;
    this.startBtn.disabled = !enough;
    this.status.textContent = !enough
      ? isHost
        ? "Convide a galera ou coloque bots nas vagas!"
        : "Esperando mais jogadores…"
      : isHost
        ? "Todo mundo pronto? Bora!"
        : "Esperando o anfitrião começar…";
  }

  /** Native share sheet (WhatsApp etc.) on phones; copies the message elsewhere. */
  private async invite(btn: HTMLButtonElement): Promise<void> {
    const url = inviteUrl(location.href, this.code.textContent ?? "");
    const text = inviteText(url);
    const label = btn.textContent;
    try {
      if (navigator.share) return await navigator.share({ title: "Bombtop", text });
      await navigator.clipboard.writeText(text);
      btn.textContent = "Link copiado!";
      setTimeout(() => (btn.textContent = label), 2000);
    } catch {
      /* share sheet dismissed */
    }
  }

  hide(): void {
    this.root.hidden = true;
  }
}
