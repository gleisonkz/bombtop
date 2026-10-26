import { RESULTS_TICKS, TICK_RATE, WINS_TO_WIN, type BattleTeam, type LobbyMember } from "@bombtop/shared";
import type { Placing } from "../game/standings";
import { el } from "./dom";
import { lobbySlots } from "./lobby-slots";
import { characterArt } from "./sheet-art";

const CONFETTI = ["#ffd23f", "#ff7a1a", "#ff6b6b", "#7fd8ff", "#45c25b", "#f5f5f5"];
const MEDALS = ["🥇", "🥈", "🥉"];

/** The results card's words: a round's winner and the next round coming, or the match's winner and back to the room. */
export function resultText(winner: string | null, mine: boolean, setOver: boolean, winnerTeam?: BattleTeam | null): { title: string; hint: string } {
  const what = setOver ? "a partida" : "o round";
  const title = winnerTeam
    ? mine ? `Sua equipe venceu ${what}!` : `Equipe ${winnerTeam === "red" ? "Vermelha" : "Azul"} venceu ${what}!`
    : mine ? `Você venceu ${what}!` : winner ? `${winner} venceu ${what}!` : "Empate!";
  return { title, hint: setOver ? "Voltando para a sala…" : "Próximo round…" };
}

/** End of a round, over the dimmed arena: the winner in their victory pose, then everyone's place. */
export class ResultScreen {
  private readonly root = el("div", { class: "screen results" });

  constructor(parent: HTMLElement) {
    this.root.hidden = true;
    parent.appendChild(this.root);
  }

  show(placings: Placing[], members: LobbyMember[], me: string, winnerId: string | null, setOver: boolean, winsToWin = WINS_TO_WIN, winnerTeam?: BattleTeam | null): void {
    // The seat's color, or null for the original colors of whoever picked their character first.
    const colors = new Map(lobbySlots(members, members.length).map(({ member, color }) => [member!.id, member!.ownColors ? null : color]));
    const byId = new Map(members.map((m) => [m.id, m]));
    const winner = winnerId ? byId.get(winnerId) : undefined;
    const mine = winnerTeam ? byId.get(me)?.team === winnerTeam : !!winner && winnerId === me;
    const { title, hint } = resultText(winner?.name ?? null, mine, setOver, winnerTeam);

    const rows = placings.flatMap(({ id, place }) => {
      const m = byId.get(id);
      if (!m) return [];
      const won = winnerTeam ? m.team === winnerTeam : id === winnerId;
      return [
        el("li", { class: ["placing", won && "won", id === me && "me"].filter(Boolean).join(" ") }, [
          el("span", { class: "place", text: MEDALS[place - 1] ?? `${place}º` }),
          characterArt(m.character, colors.get(id) ?? null, won ? "win" : "dizzy"),
          el("span", { class: "seat-name", text: id === me ? `${m.name} (você)` : m.name }),
          el("span", { class: "seat-sub", text: `${m.wins}/${winsToWin} 🏆` }),
        ]),
      ];
    });

    const card = el("div", { class: "card" }, [
      el("h2", { class: ["results-title", !winner && "draw"].filter(Boolean).join(" "), text: title }),
      ...(winner ? [el("div", { class: "champion" }, [characterArt(winner.character, colors.get(winner.id) ?? null, "win")])] : []),
      el("ol", { class: "placings" }, rows),
      el("div", { class: "results-timer" }, [el("i")]),
      el("p", { class: "hint", text: hint }),
    ]);
    card.style.setProperty("--results-s", `${RESULTS_TICKS / TICK_RATE}s`);
    this.root.replaceChildren(...(winner ? [confetti()] : []), card);
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
    this.root.replaceChildren();
  }
}

/** Paper bits falling over the screen, each with its own color, lane, delay and spin. */
function confetti(): HTMLElement {
  return el(
    "div",
    { class: "confetti" },
    Array.from({ length: 40 }, (_, i) => {
      const bit = el("i");
      bit.style.setProperty("--x", `${(i * 37) % 100}%`);
      bit.style.setProperty("--d", `${((i * 13) % 20) / 10}s`);
      bit.style.setProperty("--t", `${2.2 + ((i * 7) % 10) / 10}s`);
      bit.style.setProperty("--r", `${(i * 47) % 360}deg`);
      bit.style.background = CONFETTI[i % CONFETTI.length]!;
      return bit;
    }),
  );
}
