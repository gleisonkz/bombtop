import { ItemKind } from "@bombtop/shared";
import { ITEMS, itemCell } from "../render/sprites";
import { backButton, button, el } from "./dom";

/** The tray's groups, in order, with the color of their ring. */
export const ITEM_CATEGORIES = [
  { id: "power", label: "PODERES", short: "Poderes", color: "#ffd23f" },
  { id: "bomb", label: "TRUQUES COM BOMBA", short: "Bombas", color: "#7fd8ff" },
  { id: "defense", label: "DEFESA E MOVIMENTO", short: "Defesa", color: "#39d98a" },
  { id: "danger", label: "PERIGO", short: "Perigo", color: "#c78bff" },
] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number]["id"];

const INFO: Record<ItemKind, { cat: ItemCategory; badge: string; name: string; text: string; tips: string[] }> = {
  [ItemKind.Bomb]: {
    cat: "power",
    badge: "Acumula até 8",
    name: "Bomba extra",
    text: "Mais uma bomba no chão ao mesmo tempo (até 8).",
    tips: ["Mais bombas = mais jeitos de encurralar alguém.", "Cuidado: suas bombas também te pegam."],
  },
  [ItemKind.Fire]: {
    cat: "power",
    badge: "Acumula até 8",
    name: "Fogo",
    text: "A explosão vai uma casa mais longe (até 8).",
    tips: ["Alcance longo abre caminho rápido entre os blocos.", "Mas fica mais difícil fugir da própria explosão."],
  },
  [ItemKind.FullFire]: {
    cat: "power",
    badge: "Raro",
    name: "Fogo máximo",
    text: "A explosão vai direto para o alcance máximo.",
    tips: ["É raro: vale a corrida para pegar.", "Antes de soltar a bomba, já saiba para onde vai fugir."],
  },
  [ItemKind.Speed]: {
    cat: "power",
    badge: "Até 2×",
    name: "Velocidade",
    text: "Anda mais rápido (até o dobro).",
    tips: ["Ajuda a fugir e a chegar primeiro nos itens.", "Rápido demais num corredor apertado pode te levar direto pro fogo."],
  },
  [ItemKind.Kick]: {
    cat: "bomb",
    badge: "Andar contra a bomba",
    name: "Chute",
    text: "Ande contra uma bomba para chutá-la: ela desliza até bater em algo e destrói os itens por onde passa.",
    tips: ["Chute bombas na direção dos rivais.", "Segure PARAR (R/Numpad1, RB no controle) para frear uma bomba sua enquanto ela desliza.", "A bomba para em blocos, outras bombas e jogadores."],
  },
  [ItemKind.BombPass]: {
    cat: "bomb",
    badge: "Substitui o chute",
    name: "Passar bombas",
    text: "Atravesse bombas no chão, suas ou de outros jogadores. Substitui o poder de chute.",
    tips: ["Não permite colocar uma segunda bomba em cima de outra.", "Pegar Chute novamente substitui este poder.", "Disponível no inventário especial do Maniac."],
  },
  [ItemKind.BlockPass]: {
    cat: "defense",
    badge: "Atravessa blocos",
    name: "Passar blocos",
    text: "Atravesse blocos destrutíveis sem atravessar paredes de pedra.",
    tips: ["Enquanto estiver dentro de um bloco, o fogo comum não te atinge.", "Bombas continuam bloqueando a passagem sem Bomb Pass.", "Disponível no inventário especial do Maniac."],
  },
  [ItemKind.FireSuit]: {
    cat: "defense",
    badge: "Dura 16 s",
    name: "Traje anti-chamas",
    text: "Deixa você temporariamente imune às explosões.",
    tips: ["No Bombtop, o efeito dura 16 segundos; o valor exato da ROM ainda será conferido.", "Não evita ser esmagado pelas paredes da morte súbita.", "Disponível no inventário especial do Maniac."],
  },
  [ItemKind.Heart]: {
    cat: "defense",
    badge: "1 uso",
    name: "Coração",
    text: "Protege contra um golpe que seria fatal, uma única vez.",
    tips: ["Após gastar o coração, você recebe uma breve invulnerabilidade.", "Se estiver montado, a montaria é perdida primeiro.", "Disponível no inventário especial do Maniac."],
  },
  [ItemKind.Remote]: {
    cat: "bomb",
    badge: "Botão de ação",
    name: "Controle remoto",
    text: "Suas bombas só explodem quando você aperta ação (a mais antiga primeiro).",
    tips: ["Solte, se afaste e exploda na hora certa.", "Se você morrer, suas bombas voltam a ter pavio normal."],
  },
  [ItemKind.Pierce]: {
    cat: "bomb",
    badge: "Atravessa blocos",
    name: "Bomba perfurante",
    text: "O fogo atravessa blocos, itens e bombas; só as paredes param.",
    tips: ["Ótima para limpar uma fileira de blocos de uma vez.", "Só as paredes de pedra seguram o fogo."],
  },
  [ItemKind.Punch]: {
    cat: "bomb",
    badge: "Botão de ação",
    name: "Soco",
    text: "Aperte ação de frente para uma bomba: ela voa 3 casas e atordoa quem acertar.",
    tips: ["A bomba voa por cima dos blocos e dá a volta pela borda da arena.", "Quem é atingido fica tonto por um instante."],
  },
  [ItemKind.Push]: {
    cat: "defense",
    badge: "Botão de ação",
    name: "Empurrão (Push)",
    text: "Aperte ação para avançar uma casa e empurrar outro jogador por até três casas.",
    tips: ["Use o Push para jogar rivais na direção de armadilhas ou explosões.", "Segure DEF. (Q/Numpad0, LB no controle) para resistir ao empurrão. Soco e Push funcionam juntos."],
  },
  [ItemKind.Glove]: {
    cat: "bomb",
    badge: "Segure bomba",
    name: "Luva",
    text: "Aperte bomba em cima da sua bomba e segure para carregá-la; solte o botão para arremessar.",
    tips: ["Jogue bombas por cima dos blocos em quem está encurralado.", "Enquanto você carrega, o pavio fica pausado: segure e escolha a hora."],
  },
  [ItemKind.Skull]: {
    cat: "danger",
    badge: "Maldição",
    name: "Caveira",
    text: "Maldição (lento, rápido, controles invertidos, bombas sem parar…) que não passa sozinha: encoste em alguém e ela vai para ele, ou pegue outro item para se curar.",
    tips: [
      "Pegou? Encoste num rival para passar a maldição, ou pegue qualquer outro item para se curar.",
      "Quem acabou de receber não consegue devolver na hora: precisa se afastar e encostar de novo.",
      "Dá para reconhecer quem está amaldiçoado: fica piscando roxo.",
    ],
  },
  [ItemKind.Picanha]: {
    cat: "danger",
    badge: "Do Lula",
    name: "Picanha",
    text: "A promessa do Lula: parece um item, mas quem pega fica parado, decepcionado, por 2 s, e perde um dos seus itens, sorteado, que cai em algum lugar da arena. Só aparece quando o Lula usa o especial.",
    tips: ["O Lula passa por cima da própria picanha sem pegar.", "Fogo queima a picanha como qualquer item."],
  },
  [ItemKind.Egg]: {
    cat: "defense",
    badge: "Montaria",
    name: "Ovo",
    text: "Uma montaria que aguenta uma explosão por você. Cada uma tem um poder no botão de ação: pular, correr ou chutar.",
    tips: ["Leva um golpe por você e te deixa 2 s invencível.", "Use o botão de ação para o poder da montaria."],
  },
};

/** Every item in play with its name, description, tips and the left edge of its cell on the item sheet. */
export const ITEM_GUIDE = ITEMS.order.filter((kind) => kind !== ItemKind.Picanha).map((kind) => ({ kind, ...INFO[kind], cell: itemCell(kind) }));

/** The guide's items by group, as the tray shows them (the arrows step through them in this order). */
export const ITEM_GROUPS = ITEM_CATEGORIES.map((c) => ({ ...c, items: ITEM_GUIDE.filter((i) => i.cat === c.id) }));
const TRAY = ITEM_GROUPS.flatMap((g) => g.items);
const category = (id: ItemCategory) => ITEM_CATEGORIES.find((c) => c.id === id)!;

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
  /** The phone's sheet with the item in use was closed: stop it. */
  hide(): void;
}

/**
 * The item guide from the menu, as a showcase: the item picked in the tray below, grouped by what it does, its details
 * on the left and in use on the right, arrows either side to step through them. On a phone upright it is a list with
 * filter pills by group instead, the item picked coming up from the bottom in a sheet (layout I).
 */
export function itemGuide(hooks: ItemGuideHooks): { root: HTMLElement; open(): void } {
  const stage = el("div", { class: "guide-stage ig-stage" });
  const pos = el("span", { class: "ig-pos" });
  const ring = el("span", { class: "ig-ring" });
  const tag = el("span", { class: "ig-cat" });
  const name = el("h3", { class: "ig-name" });
  const badge = el("span", { class: "ig-badge" });
  const text = el("p", { class: "ig-text" });
  const tips = el("ul", { class: "ig-tips" });
  const cards: HTMLButtonElement[] = [];
  let current = 0;

  const select = (i: number) => {
    current = (i + TRAY.length) % TRAY.length;
    const item = TRAY[current]!;
    const cat = category(item.cat);
    cards.forEach((c, j) => c.classList.toggle("on", current === j));
    cards[current]!.setAttribute("aria-pressed", "true");
    cards.forEach((c, j) => j !== current && c.setAttribute("aria-pressed", "false"));
    detail.style.setProperty("--cat", cat.color);
    pos.textContent = `${current + 1} / ${TRAY.length}`;
    ring.replaceChildren(icon(item.cell, "guide-icon big"));
    tag.textContent = cat.label;
    name.textContent = item.name;
    badge.textContent = item.badge;
    text.textContent = item.text;
    tips.replaceChildren(...item.tips.map((t) => el("li", { text: t })));
    root.classList.add("sheet-open");
    hooks.show(item.kind, stage);
  };
  const closeSheet = () => {
    root.classList.remove("sheet-open");
    cards.forEach((c) => c.classList.remove("on"));
    hooks.hide();
  };

  const shut = button("×", closeSheet, "ig-shut");
  shut.setAttribute("aria-label", "Fechar detalhes");
  const detail = el("div", { class: "ig-detail" }, [
    el("div", { class: "ig-head" }, [ring, el("div", { class: "ig-titles" }, [tag, name, badge]), shut]),
    text,
    el("div", { class: "ig-tipbox" }, [el("strong", { class: "ig-tips-title", text: "Dicas" }), tips]),
  ]);
  const prev = button("‹", () => select(current - 1), "ig-arrow prev");
  const next = button("›", () => select(current + 1), "ig-arrow next");
  prev.setAttribute("aria-label", "Item anterior");
  next.setAttribute("aria-label", "Próximo item");
  prev.dataset.padPrev = "";
  next.dataset.padNext = "";
  const show = el("div", { class: "ig-show" }, [stage, prev, next]);

  const tray = el(
    "div",
    { class: "ig-tray" },
    ITEM_GROUPS.map((g) => {
      const row = el("div", { class: "ig-row" });
      for (const item of g.items) {
        const card = button("", () => select(cards.indexOf(card)), "ig-item");
        card.setAttribute("aria-label", item.name);
        card.title = item.name;
        card.append(icon(item.cell), el("span", { class: "ig-item-name", text: item.name }));
        cards.push(card);
        row.append(card);
      }
      const group = el("div", { class: "ig-group" }, [el("span", { class: "ig-group-label", text: g.label }), row]);
      group.dataset.cat = g.id;
      group.style.setProperty("--cat", g.color);
      return group;
    }),
  );
  const pills: HTMLButtonElement[] = [];
  const filter = (id: ItemCategory | "all") => {
    root.dataset.filter = id;
    pills.forEach((p) => p.setAttribute("aria-pressed", String(p.dataset.cat === id)));
  };
  const pillBar = el(
    "div",
    { class: "ig-pills" },
    [{ id: "all" as const, short: "Todos", color: "#ffffff" }, ...ITEM_CATEGORIES].map((c) => {
      const pill = button(c.short, () => filter(c.id), "ig-pill");
      pill.dataset.cat = c.id;
      pill.style.setProperty("--cat", c.color);
      pills.push(pill);
      return pill;
    }),
  );
  const root: HTMLElement = el("div", { class: "card guide items" }, [
    el("div", { class: "ig-top" }, [
      backButton("← Voltar", hooks.close, "primary"),
      el("h2", { text: "Itens" }),
      pos,
      el("span", { class: "ig-count", text: `${TRAY.length} itens` }),
    ]),
    pillBar,
    el("div", { class: "ig-main" }, [detail, show]),
    tray,
  ]);
  filter("all");
  return { root, open: () => select(current) };
}
