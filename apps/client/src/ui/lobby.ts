import { BOT_LEVELS, MAX_PLAYERS, type BattleMode, type BattleTeam, type BattleTimeMinutes, type BotLevel, type BotPersona, type CharacterId, type LobbyInfo, type ManiacConfig } from "@bombtop/shared";
import { inviteText, inviteUrl } from "../net/invite";
import { MASCOT_COLOR } from "./art";
import { backButton, button, el } from "./dom";
import { LeaveConfirm } from "./leave-confirm";
import { lobbySlots, seatClass } from "./lobby-slots";
import { ResultScreen } from "./result-screen";
import { characterArt } from "./sheet-art";
import { cycleCharacter } from "./character-cycle";
import { StageRotationPanel } from "./stage-rotation-panel";
import { ManiacPanel } from "./maniac-panel";
import { STAGE_NAMES } from "./stage-names";
import type { StageRotationEntry } from "@bombtop/shared";
import type { Placing } from "../game/standings";

const CHARACTER_NAMES: Record<CharacterId, string> = { bomb: "Bomba", captain: "Capitão América", thor: "Thor", goku: "Goku", naruto: "Naruto", spider: "Homem-Aranha", pikachu: "Pikachu", static: "Super Choque", flash: "Flash", bugs: "Pernalonga", lantern: "Lanterna Verde", donatello: "Donatello", penelope: "Penélope Charmosa", panther: "Pantera Cor-de-Rosa", harry: "Harry Potter", optimus: "Optimus Prime", pele: "Pelé", lula: "Lula" };

export const LEVEL_NAMES: Record<BotLevel, string> = { easy: "Fácil", medium: "Médio", hard: "Difícil" };

/** Bot personalities, as shown on their seats. */
export const PERSONA_NAMES: Record<BotPersona, string> = {
  hunter: "Caçador",
  collector: "Coletor",
  demolisher: "Demolidor",
  cautious: "Cauteloso",
  wildcard: "Imprevisível",
};

export interface LobbyHandlers {
  start(): void;
  setBattleMode(mode: BattleMode): void;
  setTeam(id: string, team: BattleTeam): void;
  /** A guest says they are ready to play, or not yet. */
  setReady(ready: boolean): void;
  setManiac(config: ManiacConfig): void;
  setWinsToWin(wins: number): void;
  setTimeMinutes(minutes: BattleTimeMinutes): void;
  setSuddenDeath(enabled: boolean): void;
  setStageRotation(rotation: StageRotationEntry[]): void;
  leave(): void;
  addBot(level: BotLevel): void;
  removeBot(id: string): void;
  pickCharacter(character: CharacterId): void;
  /** The host has a bot play another character. */
  pickBotCharacter(id: string, character: CharacterId): void;
}

/** Lobby overlay: room code and invite, a seat per player, and the host's start button. */
export class LobbyPanel {
  private readonly root: HTMLElement;
  private readonly code = el("code");
  private readonly stage = el("span", { class: "chip" });
  private readonly seats = el("div", { class: "seats" });
  private readonly status = el("p", { class: "hint" });
  private readonly wins: HTMLButtonElement[];
  private readonly times: HTMLButtonElement[];
  private readonly winRules: HTMLElement;
  private readonly timeRules: HTMLElement;
  private readonly suddenDeathToggle: HTMLButtonElement;
  private currentSuddenDeath = true;
  private readonly stageRotation: StageRotationPanel;
  private readonly maniacPanel: ManiacPanel;
  private readonly modeButtons: HTMLButtonElement[];
  private readonly maniacNotice = el("span", { class: "lobby-maniac-notice", text: "Maniac: 3 vitórias, 3 minutos, fase Clássica e morte súbita OFF" });
  private readonly startBtn: HTMLButtonElement;
  private readonly leaveConfirm: LeaveConfirm;
  /** A guest's "ready" toggle, where the host has the start button. */
  private readonly readyBtn: HTMLButtonElement;
  private ready = false;
  private readonly results: ResultScreen;
  private readonly codeLabel = el("small", { text: "Código da sala" });
  private readonly inviteBtn: HTMLButtonElement;
  /**
   * Offline (Wi-Fi) room: no code to share; the host pairs friends instead (null on a guest's phone).
   * `couch`: players also join on this same screen with their controllers.
   */
  private offline: { pair: (() => void) | null; couch?: boolean } | null = null;
  private watching = false;

  constructor(
    parent: HTMLElement,
    private readonly handlers: LobbyHandlers,
  ) {
    this.startBtn = button("Começar partida", handlers.start, "primary big start");
    this.readyBtn = button("Estou pronto!", () => handlers.setReady(!this.ready), "primary big start ready-btn");
    this.stageRotation = new StageRotationPanel(parent, handlers.setStageRotation);
    this.maniacPanel = new ManiacPanel(parent, handlers.setManiac);
    this.modeButtons = (["single", "tag", "maniac"] as const).map((mode) => {
      const choice = button(mode === "single" ? "Single" : mode === "tag" ? "Tag" : "Maniac", () => handlers.setBattleMode(mode), "lobby-mode-option");
      choice.setAttribute("aria-label", `Modo Battle ${mode === "single" ? "Royale Single" : mode === "tag" ? "Tag em equipes" : "Maniac"}`);
      return choice;
    });
    this.wins = Array.from({ length: 5 }, (_, i) => {
      const value = i + 1;
      const choice = button(String(value), () => handlers.setWinsToWin(value), "lobby-win-option");
      choice.setAttribute("aria-label", `${value} ${value === 1 ? "vitória" : "vitórias"} para ganhar`);
      return choice;
    });
    this.winRules = el("div", { class: "lobby-rules" }, [
      el("span", { class: "lobby-rules-title", text: "Vitórias para ganhar" }),
      el("div", { class: "lobby-rules-options" }, this.wins),
    ]);
    this.times = ([1, 2, 3, 5, null] as const).map((value) => {
      const label = value === null ? "∞" : `${value}m`;
      const choice = button(label, () => handlers.setTimeMinutes(value), "lobby-win-option lobby-time-option");
      choice.setAttribute("aria-label", value === null ? "Tempo infinito" : `${value} ${value === 1 ? "minuto" : "minutos"} por rodada`);
      choice.dataset.timeMinutes = String(value);
      return choice;
    });
    this.timeRules = el("div", { class: "lobby-rules" }, [
      el("span", { class: "lobby-rules-title", text: "Tempo por rodada" }),
      el("div", { class: "lobby-rules-options" }, this.times),
    ]);
    this.suddenDeathToggle = button("Morte súbita: ON", () => handlers.setSuddenDeath(!this.currentSuddenDeath), "lobby-rule-toggle");
    const invite = (this.inviteBtn = button("Convidar amigos", () => void this.invite(invite), "primary invite-btn"));
    this.root = el("div", { class: "screen lobby" }, [
      el("div", { class: "lobby-shell" }, [
        el("header", { class: "lobby-head card" }, [
          backButton("← Sair", handlers.leave, "ghost leave"),
          el("div", { class: "lobby-title" }, [el("h2", { text: "Sala" }), this.stage]),
          el("div", { class: "code-box" }, [this.codeLabel, this.code]),
          invite,
        ]),
        this.seats,
        el("footer", { class: "lobby-foot" }, [
          el("div", { class: "lobby-settings" }, [
            el("div", { class: "lobby-rules" }, [el("span", { class: "lobby-rules-title", text: "Modo" }), el("div", { class: "lobby-rules-options" }, this.modeButtons)]),
            this.stageRotation.trigger, this.maniacPanel.trigger, this.winRules, this.timeRules, this.suddenDeathToggle,
          ]),
          this.maniacNotice, this.status, this.startBtn, this.readyBtn,
        ]),
      ]),
    ]);
    this.root.hidden = true;
    parent.appendChild(this.root);
    this.results = new ResultScreen(parent);
    this.leaveConfirm = new LeaveConfirm(parent, handlers.leave);
  }

  /** TV mode: this screen only shows the room (no seat): no start or invite, a word on what it is for. */
  setWatching(watching: boolean): void {
    this.watching = watching;
    this.inviteBtn.hidden = watching || (!!this.offline && !this.offline.pair);
  }

  /** An offline room (`pair` adds a friend, on the host's phone; `couch` on one screen), or back to an online one (null). */
  setOffline(offline: { pair: (() => void) | null; couch?: boolean } | null): void {
    this.offline = offline;
    this.codeLabel.textContent = offline?.couch ? "Mesma tela" : offline ? "Partida offline" : "Código da sala";
    this.inviteBtn.textContent = offline ? "Chamar amigos" : "Convidar amigos";
    this.inviteBtn.hidden = !!offline && !offline.pair;
  }

  update(info: LobbyInfo, me: string): void {
    this.root.hidden = info.phase !== "lobby";
    if (info.phase !== "results") this.results.hide();
    this.code.textContent = this.offline?.couch ? "🎮" : this.offline ? "Wi-Fi" : info.code;
    this.stage.textContent = `Fase: ${STAGE_NAMES[info.stage]}${info.watchers ? ` • 📺 ${info.watchers}` : ""}`;
    const isHost = info.hostId === me;
    const maniac = info.battleMode === "maniac";
    const tag = info.battleMode === "tag";
    const mayEdit = isHost && !this.watching;
    this.stageRotation.update(info, mayEdit && !maniac);
    this.stageRotation.trigger.hidden = maniac;
    this.maniacPanel.update(info, mayEdit && maniac);
    this.maniacPanel.trigger.hidden = !maniac;
    this.maniacNotice.hidden = !maniac;
    for (const [index, choice] of this.modeButtons.entries()) {
      choice.setAttribute("aria-pressed", String((["single", "tag", "maniac"][index] === (info.battleMode ?? "single"))));
      choice.disabled = !mayEdit;
    }
    for (const [index, choice] of this.wins.entries()) {
      const selected = info.winsToWin === index + 1;
      choice.setAttribute("aria-pressed", String(selected));
      choice.disabled = !mayEdit || maniac;
    }
    for (const choice of this.times) {
      choice.setAttribute("aria-pressed", String(choice.dataset.timeMinutes === String(info.timeMinutes)));
      choice.disabled = !mayEdit || maniac;
    }
    this.currentSuddenDeath = info.suddenDeath;
    this.suddenDeathToggle.textContent = `Morte súbita: ${info.suddenDeath ? "ON" : "OFF"}`;
    this.suddenDeathToggle.setAttribute("aria-pressed", String(info.suddenDeath));
    this.suddenDeathToggle.disabled = !mayEdit || maniac;
    this.seats.replaceChildren(
      ...lobbySlots(info.members, MAX_PLAYERS).map(({ member, color }, i) => {
        const slotTag = el("span", { class: "slot-tag", text: `P${i + 1}` });
        if (!member && isHost) {
          return el("div", { class: "seat empty add-bot" }, [
            slotTag,
            el("span", { class: "seat-name", text: "Vaga livre" }),
            el("span", { class: "seat-sub", text: this.offline?.couch ? "Aperte A num controle, ou chame um bot:" : "Chamar um bot:" }),
            ...BOT_LEVELS.map((level) => button(LEVEL_NAMES[level], () => this.handlers.addBot(level), `mini ${level}`)),
          ]);
        }
        if (!member) {
          return el("div", { class: "seat empty" }, [
            slotTag,
            characterArt("bomb", MASCOT_COLOR, "idle"),
            el("span", { class: "seat-name", text: "Vaga livre" }),
            el("span", { class: "seat-sub", text: "esperando alguém…" }),
          ]);
        }
        const you = member.id === me;
        // Your own character, and the host's bots': the arrows (or L1/R1 on a controller) step through the characters.
        const pick = you
          ? (c: CharacterId) => this.handlers.pickCharacter(c)
          : member.bot && isHost
            ? (c: CharacterId) => this.handlers.pickBotCharacter(member.id, c)
            : null;
        const cls = seatClass(member, me);
        const team = member.team === "blue" ? "blue" : "red";
        const nextTeam: BattleTeam = team === "red" ? "blue" : "red";
        const teamLabel = team === "red" ? "Vermelha" : "Azul";
        const teamButton = button(teamLabel, () => this.handlers.setTeam(member.id, nextTeam), `team-toggle team-${team}`);
        const canChangeTeam = !this.watching && (isHost || (you && !member.bot));
        teamButton.disabled = !canChangeTeam;
        teamButton.setAttribute("aria-label", canChangeTeam
          ? `Mover ${member.name} para equipe ${nextTeam === "red" ? "vermelha" : "azul"}`
          : `${member.name} na equipe ${teamLabel.toLowerCase()}`);
        const sub = member.bot
          ? `🤖 ${LEVEL_NAMES[member.bot]}${member.persona ? ` ${PERSONA_NAMES[member.persona]}` : ""} • ${member.wins} 🏆`
          : member.connected
            ? `${you ? "você • " : ""}${member.wins} 🏆`
            : "reconectando…";
        // Each human guest's say, for the host above all: ready, or still choosing.
        const guest = !member.bot && member.id !== info.hostId && member.connected;
        const readyChip = guest ? el("span", { class: member.ready ? "ready-chip on" : "ready-chip", text: member.ready ? "✓ Pronto" : "Escolhendo…" }) : null;
        return el("div", { class: guest && member.ready ? `${cls} is-ready` : cls }, [
          slotTag,
          member.id === info.hostId ? el("span", { class: "crown", text: "👑", title: "Anfitrião" }) : null,
          member.bot && isHost ? button("✕", () => this.handlers.removeBot(member.id), "kick-bot") : null,
          el("div", { class: "stage-spot" }, [
            characterArt(member.character, member.ownColors ? null : color, !member.connected ? "dizzy" : member.bot === "easy" ? "idle" : "walk"),
          ]),
          el("span", { class: "seat-name", text: member.name }),
          el("span", { class: "seat-sub", text: sub }),
          readyChip,
          tag ? teamButton : null,
          // Every seat keeps the picker's room (hidden on others' seats), so characters and names line up.
          // Arrows step through the characters, so any number of them fits on a narrow card.
          el("div", { class: pick ? "picker" : "picker spacer" }, [
            this.pickArrow("‹", "Personagem anterior", pick, member.character, -1),
            el("span", { class: "pick-name", text: CHARACTER_NAMES[member.character] }),
            this.pickArrow("›", "Próximo personagem", pick, member.character, 1),
          ]),
        ]);
      }),
    );
    const enough = info.members.length >= 2 && (!tag || new Set(info.members.map(member => member.team)).size === 2);
    // Guests still connected who have not said they are ready (the host starts; bots always are).
    const waiting = info.members.filter((m) => !m.bot && m.id !== info.hostId && m.connected && !m.ready);
    this.startBtn.hidden = !isHost;
    this.startBtn.disabled = !enough || waiting.length > 0;
    this.ready = !!info.members.find((m) => m.id === me)?.ready;
    this.readyBtn.hidden = isHost || this.watching || !info.members.some((m) => m.id === me);
    this.readyBtn.textContent = this.ready ? "✓ Pronto! (cancelar)" : "Estou pronto!";
    this.readyBtn.setAttribute("aria-pressed", String(this.ready));
    if (this.watching) {
      this.startBtn.hidden = true;
      this.status.textContent = "📺 Modo TV: esta tela mostra a partida. Cada um joga pelo seu celular (ou controle) com o código da sala.";
      return;
    }
    const couch = this.offline?.couch ? "🎮 Controles: A entra, Y troca o personagem, B sai, Start começa. " : "";
    this.status.textContent = couch + (tag && !enough && info.members.length >= 2
      ? "TAG precisa de jogadores nas duas equipes para começar."
      : !enough
      ? isHost
        ? "Convide a galera ou coloque bots nas vagas!"
        : "Esperando mais jogadores…"
      : waiting.length
      ? isHost
        ? `Esperando ${waiting.length === 1 ? waiting[0]!.name : `${waiting.length} jogadores`} ficar${waiting.length === 1 ? "" : "em"} pronto${waiting.length === 1 ? "" : "s"}…`
        : this.ready ? "Você está pronto! Esperando os outros…" : "Escolha seu personagem e aperte \"Estou pronto!\""
      : isHost
        ? tag ? "TAG: vence a última equipe com alguém vivo. Bora!" : "Todo mundo pronto? Bora!"
        : "Esperando o anfitrião começar…");
  }

  private pickArrow(
    text: string,
    label: string,
    pick: ((c: CharacterId) => void) | null,
    current: CharacterId,
    step: 1 | -1,
  ): HTMLButtonElement {
    const b = button(text, () => pick?.(cycleCharacter(current, step)), "mini pick-arrow");
    b.setAttribute("aria-label", label);
    // L1/R1 on a controller press these (PadMenus).
    if (pick) b.dataset[step < 0 ? "padPrev" : "padNext"] = "";
    return b;
  }

  /** Native share sheet (WhatsApp etc.) on phones; copies the message elsewhere. */
  private async invite(btn: HTMLButtonElement): Promise<void> {
    if (this.offline?.pair) return this.offline.pair();
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

  /** A round is over: who won and everyone's place, until the next round (or, the match won, the lobby). */
  showResults(placings: Placing[], info: LobbyInfo, me: string, winnerId: string | null, setOver: boolean, winnerTeam?: BattleTeam | null): void {
    this.results.show(placings, info.members, me, winnerId, setOver, info.winsToWin, winnerTeam);
  }

  /** Esc in the room: asks before leaving (Esc again goes back). */
  confirmLeave(): void {
    this.leaveConfirm.toggle();
  }

  hide(): void {
    this.leaveConfirm.close();
    this.stageRotation.close();
    this.root.hidden = true;
    this.results.hide();
  }
}
