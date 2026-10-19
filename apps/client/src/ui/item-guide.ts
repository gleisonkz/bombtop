import { ItemKind } from "@bombtop/shared";
import { ITEMS, itemCell } from "../render/sprites";
import { button, el } from "./dom";

const INFO: Record<ItemKind, { name: string; text: string }> = {
  [ItemKind.Bomb]: { name: "Bomba extra", text: "Mais uma bomba no chão ao mesmo tempo (até 8)." },
  [ItemKind.Fire]: { name: "Fogo", text: "A explosão alcança um tile a mais (até 8)." },
  [ItemKind.FullFire]: { name: "Fogo máximo", text: "A explosão vai direto para o alcance máximo." },
  [ItemKind.Speed]: { name: "Velocidade", text: "Anda mais rápido (até o dobro)." },
  [ItemKind.Kick]: { name: "Chute", text: "Ande contra uma bomba para chutá-la: ela desliza até bater em algo." },
  [ItemKind.Remote]: {
    name: "Controle remoto",
    text: "Suas bombas só explodem quando você aperta ação (a mais antiga primeiro).",
  },
  [ItemKind.Pierce]: { name: "Bomba perfurante", text: "O fogo atravessa blocos, itens e bombas; só as paredes param." },
  [ItemKind.Punch]: {
    name: "Soco",
    text: "Aperte ação de frente para uma bomba: ela voa 3 tiles e atordoa quem acertar.",
  },
  [ItemKind.Glove]: {
    name: "Luva",
    text: "Aperte bomba em cima da sua bomba para levantá-la; aperte de novo para arremessar.",
  },
  [ItemKind.Skull]: {
    name: "Caveira",
    text: "Maldição por 10 s (lento, rápido, controles invertidos, bombas sem parar…). Passa para quem você encostar!",
  },
  [ItemKind.Egg]: {
    name: "Ovo",
    text: "Uma montaria que aguenta uma explosão por você. Cada uma tem um poder no botão de ação: pular, correr ou chutar.",
  },
};

/** Every item with its name, description and the left edge of its cell on the item sheet. */
export const ITEM_GUIDE = ITEMS.order.map((kind) => ({ kind, ...INFO[kind], cell: itemCell(kind) }));

/** The item list shown from the menu; `close` goes back. */
export function itemGuide(close: () => void): HTMLElement {
  const sheet = `url(${import.meta.env.BASE_URL}${ITEMS.url})`;
  const list = el(
    "ul",
    { class: "guide-list" },
    ITEM_GUIDE.map((item) => {
      const icon = el("span", { class: "guide-icon" });
      icon.style.backgroundImage = sheet;
      icon.style.setProperty("--cell", `${item.cell / ITEMS.size}`);
      return el("li", {}, [icon, el("div", {}, [el("strong", { text: item.name }), el("p", { text: item.text })])]);
    }),
  );
  return el("div", { class: "card guide" }, [el("h2", { text: "Itens" }), list, button("Voltar", close, "primary")]);
}
