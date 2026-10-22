import { ITEM_WEIGHTS, ItemKind } from "@bombtop/shared";
import { ITEMS, itemCell } from "../render/sprites";
import { button, el } from "./dom";

const INFO: Record<ItemKind, { name: string; text: string; tips: string[] }> = {
  [ItemKind.Bomb]: {
    name: "Bomba extra",
    text: "Mais uma bomba no chão ao mesmo tempo (até 8).",
    tips: ["Mais bombas = mais jeitos de encurralar alguém.", "Cuidado: suas bombas também te pegam."],
  },
  [ItemKind.Fire]: {
    name: "Fogo",
    text: "A explosão vai uma casa mais longe (até 8).",
    tips: ["Alcance longo abre caminho rápido entre os blocos.", "Mas fica mais difícil fugir da própria explosão."],
  },
  [ItemKind.FullFire]: {
    name: "Fogo máximo",
    text: "A explosão vai direto para o alcance máximo.",
    tips: ["É raro: vale a corrida para pegar.", "Antes de soltar a bomba, já saiba para onde vai fugir."],
  },
  [ItemKind.Speed]: {
    name: "Velocidade",
    text: "Anda mais rápido (até o dobro).",
    tips: ["Ajuda a fugir e a chegar primeiro nos itens.", "Rápido demais num corredor apertado pode te levar direto pro fogo."],
  },
  [ItemKind.Kick]: {
    name: "Chute",
    text: "Ande contra uma bomba para chutá-la: ela desliza até bater em algo.",
    tips: ["Chute bombas na direção dos rivais.", "A bomba para em blocos, outras bombas e jogadores."],
  },
  [ItemKind.Remote]: {
    name: "Controle remoto",
    text: "Suas bombas só explodem quando você aperta ação (a mais antiga primeiro).",
    tips: ["Solte, se afaste e exploda na hora certa.", "Se você morrer, suas bombas voltam a ter pavio normal."],
  },
  [ItemKind.Pierce]: {
    name: "Bomba perfurante",
    text: "O fogo atravessa blocos, itens e bombas; só as paredes param.",
    tips: ["Ótima para limpar uma fileira de blocos de uma vez.", "Só as paredes de pedra seguram o fogo."],
  },
  [ItemKind.Punch]: {
    name: "Soco",
    text: "Aperte ação de frente para uma bomba: ela voa 3 casas e atordoa quem acertar.",
    tips: ["A bomba voa por cima dos blocos e dá a volta pela borda da arena.", "Quem é atingido fica tonto por um instante."],
  },
  [ItemKind.Glove]: {
    name: "Luva",
    text: "Aperte bomba em cima da sua bomba e segure para carregá-la; solte o botão para arremessar.",
    tips: ["Jogue bombas por cima dos blocos em quem está encurralado.", "Enquanto você carrega, o pavio fica pausado: segure e escolha a hora."],
  },
  [ItemKind.Skull]: {
    name: "Caveira",
    text: "Maldição por 10 s (lento, rápido, controles invertidos, bombas sem parar…). Encoste em alguém e ela passa para ele: você fica livre!",
    tips: [
      "Pegou? Encoste num rival para passar a maldição, ou pegue qualquer outro item para se curar.",
      "Quem acabou de receber não consegue devolver na hora: precisa se afastar e encostar de novo.",
      "Dá para reconhecer quem está amaldiçoado: fica piscando roxo.",
    ],
  },
  [ItemKind.Egg]: {
    name: "Ovo",
    text: "Uma montaria que aguenta uma explosão por você. Cada uma tem um poder no botão de ação: pular, correr ou chutar.",
    tips: ["Leva um golpe por você e te deixa 2 s invencível.", "Use o botão de ação para o poder da montaria."],
  },
};

/** Every item in play with its name, description, tips and the left edge of its cell on the item sheet. */
export const ITEM_GUIDE = ITEMS.order.filter((kind) => ITEM_WEIGHTS[kind] > 0).map((kind) => ({ kind, ...INFO[kind], cell: itemCell(kind) }));

/** An item's plate from the sheet, as an element. */
function icon(cell: number, cls = "guide-icon"): HTMLElement {
  const span = el("span", { class: cls });
  span.style.backgroundImage = `url(${import.meta.env.BASE_URL}${ITEMS.url})`;
  span.style.setProperty("--cell", `${cell / ITEMS.size}`);
  span.style.setProperty("--cols", `${ITEMS.order.length}`);
  span.style.setProperty("--rows", `${ITEMS.frames}`);
  return span;
}

export interface ItemGuideHooks {
  close(): void;
  /** The selected item changed: show it in use in `stage`. */
  show(kind: ItemKind, stage: HTMLElement): void;
}

/** The item guide from the menu: pick an item on the grid to see it in use, with details and tips. */
export function itemGuide(hooks: ItemGuideHooks): { root: HTMLElement; open(): void } {
  const stage = el("div", { class: "guide-stage" });
  const head = el("div", { class: "guide-head" });
  const text = el("p", { class: "guide-text" });
  const tips = el("ul", { class: "guide-tips" });
  const cards: HTMLButtonElement[] = [];
  let current = 0;

  const select = (i: number) => {
    current = i;
    const item = ITEM_GUIDE[i]!;
    cards.forEach((c, j) => c.classList.toggle("on", i === j));
    head.replaceChildren(icon(item.cell, "guide-icon big"), el("h3", { text: item.name }));
    text.textContent = item.text;
    tips.replaceChildren(...item.tips.map((t) => el("li", { text: t })));
    hooks.show(item.kind, stage);
  };

  const list = el(
    "div",
    { class: "guide-list" },
    ITEM_GUIDE.map((item, i) => {
      const card = button("", () => select(i), "guide-card");
      card.append(icon(item.cell), el("span", { text: item.name }));
      cards.push(card);
      return card;
    }),
  );
  const detail = el("div", { class: "guide-detail" }, [stage, head, text, el("strong", { class: "guide-tips-title", text: "Dicas" }), tips]);
  const root = el("div", { class: "card guide" }, [
    el("h2", { text: "Itens" }),
    el("div", { class: "guide-body" }, [list, detail]),
    button("Voltar", hooks.close, "primary"),
  ]);
  return { root, open: () => select(current) };
}
