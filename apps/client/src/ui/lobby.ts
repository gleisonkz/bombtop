import { BOT_LEVELS, MAX_PLAYERS, type BotLevel, type CharacterId, type LobbyInfo } from "@bombtop/shared";
import { inviteText, inviteUrl } from "../net/invite";
import { MASCOT_COLOR } from "./art";
import { button, el } from "./dom";
import { lobbySlots, seatClass } from "./lobby-slots";
import { ResultScreen } from "./result-screen";
import { characterArt } from "./sheet-art";
import { cycleCharacter } from "./character-cycle";
import type { Placing } from "../game/standings";

const CHARACTER_NAMES: Record<CharacterId, string> = { bomb: "Bomba", ninja: "Ninja", captain: "Capitão América" };

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
  pickCharacter(character: CharacterId): void;
}

/** Lobby overlay: room code and invite, a seat per player, and the host's start button. */
export class LobbyPanel {
  private readonly root: HTMLElement;
  private readonly code = el("code");
  private readonly stage = el("span", { class: "chip" });
  private readonly seats = el("div", { class: "seats" });
  private readonly status = el("p", { class: "hint" });
  private readonly startBtn: HTMLButtonElement;
  private readonly results: ResultScreen;

  constructor(
    parent: HTMLElement,
    private readonly handlers: LobbyHandlers,
  ) {
    this.startBtn = button("Começar partida", handlers.start, "primary big start");
    const invite = button("Convidar amigos", () => void this.invite(invite), "primary invite-btn");
    this.root = el("div", { class: "screen lobby" }, [
      el("div", { class: "lobby-shell" }, [
        el("header", { class: "lobby-head card" }, [
          button("← Sair", handlers.leave, "ghost leave"),
          el("div", { class: "lobby-title" }, [el("h2", { text: "Sala" }), this.stage]),
          el("div", { class: "code-box" }, [el("small", { text: "Código da sala" }), this.code]),
          invite,
        ]),
        this.seats,
        el("footer", { class: "lobby-foot" }, [this.status, this.startBtn]),
      ]),
    ]);
    this.root.hidden = true;
    parent.appendChild(this.root);
    this.results = new ResultScreen(parent);
  }

  update(info: LobbyInfo, me: string): void {
    this.root.hidden = info.phase !== "lobby";
    if (info.phase !== "results") this.results.hide();
    this.code.textContent = info.code;
    this.stage.textContent = `Fase: ${STAGE_NAMES[info.stage]}`;
    const isHost = info.hostId === me;
    this.seats.replaceChildren(
      ...lobbySlots(info.members, MAX_PLAYERS).map(({ member, color }, i) => {
        const tag = el("span", { class: "slot-tag", text: `P${i + 1}` });
        if (!member && isHost) {
          return el("div", { class: "seat empty add-bot" }, [
            tag,
            el("span", { class: "seat-name", text: "Vaga livre" }),
            el("span", { class: "seat-sub", text: "Chamar um bot:" }),
            ...BOT_LEVELS.map((level) => button(LEVEL_NAMES[level], () => this.handlers.addBot(level), `mini ${level}`)),
          ]);
        }
        if (!member) {
          return el("div", { class: "seat empty" }, [
            tag,
            characterArt("bomb", MASCOT_COLOR, "idle"),
            el("span", { class: "seat-name", text: "Vaga livre" }),
            el("span", { class: "seat-sub", text: "esperando alguém…" }),
          ]);
        }
        const you = member.id === me;
        const cls = seatClass(member, me);
        const sub = member.bot
          ? `🤖 ${LEVEL_NAMES[member.bot]} • ${member.wins} 🏆`
          : member.connected
            ? `${you ? "você • " : ""}${member.wins} 🏆`
            : "reconectando…";
        return el("div", { class: cls }, [
          tag,
          member.id === info.hostId ? el("span", { class: "crown", text: "👑", title: "Anfitrião" }) : null,
          member.bot && isHost ? button("✕", () => this.handlers.removeBot(member.id), "kick-bot") : null,
          el("div", { class: "stage-spot" }, [
            characterArt(member.character, color, !member.connected ? "dizzy" : member.bot === "easy" ? "idle" : "walk"),
          ]),
          el("span", { class: "seat-name", text: member.name }),
          el("span", { class: "seat-sub", text: sub }),
          // Every seat keeps the picker's room (hidden on others' seats), so characters and names line up.
          // Arrows step through the characters, so any number of them fits on a narrow card.
          el("div", { class: you ? "picker" : "picker spacer" }, [
            this.pickArrow("‹", "Personagem anterior", you, member.character, -1),
            el("span", { class: "pick-name", text: CHARACTER_NAMES[member.character] }),
            this.pickArrow("›", "Próximo personagem", you, member.character, 1),
          ]),
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

  private pickArrow(text: string, label: string, you: boolean, current: CharacterId, step: 1 | -1): HTMLButtonElement {
    const b = button(text, () => you && this.handlers.pickCharacter(cycleCharacter(current, step)), "mini pick-arrow");
    b.setAttribute("aria-label", label);
    return b;
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

  /** The match is over: who won and everyone's place, until the room is back in the lobby. */
  showResults(placings: Placing[], info: LobbyInfo, me: string, winnerId: string | null): void {
    this.results.show(placings, info.members, me, winnerId);
  }

  hide(): void {
    this.root.hidden = true;
    this.results.hide();
  }
}
