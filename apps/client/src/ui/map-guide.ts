import { SELECTABLE_STAGES, type StageId } from "@bombtop/shared";
import { backButton, button, el } from "./dom";
import { STAGE_NAMES } from "./stage-names";

/** What each map does that the others don't (as the simulation plays it), and how to play it. */
const INFO: Record<string, { text: string; tips: string[] }> = {
  classic: {
    text: "A arena de sempre: blocos espalhados ao acaso a cada rodada, itens escondidos neles e nada mais no caminho. Todo mundo começa com 1 bomba e 1 de fogo.",
    tips: ["Abra caminho até o meio cedo: é onde estão mais blocos (e itens).", "Com pouco fogo no começo, dá pra ficar perto da própria bomba: só não na mesma linha."],
  },
  conveyor: {
    text: "Duas esteiras atravessam a arena de ponta a ponta: a de cima leva para a direita, a de baixo para a esquerda. Elas carregam quem pisa e as bombas paradas nelas, destruindo os itens por onde a bomba passa.",
    tips: ["Solte a bomba na esteira e deixe ela levar até o rival.", "Fugindo pela esteira você anda mais rápido no sentido dela; contra ela, bem mais devagar.", "Não fique parado numa esteira: ela te leva pra onde você não escolheu."],
  },
  warp: {
    text: "Quatro teleportes, dois pares em cantos opostos: pisou em um, sai no outro do outro lado da arena. Só jogadores viajam; as bombas ficam.",
    tips: ["Encurralado? Um teleporte perto é a melhor saída.", "Cuidado com quem espera na saída do teleporte com uma bomba pronta."],
  },
  "sb4-01": {
    text: "O mapa básico do Super Bomberman 4: blocos fixos, sempre no mesmo lugar, e 28 itens escondidos (bombas, fogo, chute, luva, soco, empurrão). Começa com 2 de fogo e as bombas explodem mais rápido.",
    tips: ["Como o mapa é sempre igual, decore por onde fugir.", "As bombas daqui estouram mais rápido: solte e já saia."],
  },
  "sb4-02": {
    text: "O tempo muda sozinho a cada 14 segundos: fica normal, lento (metade da velocidade) ou acelerado (o dobro). Andar, pavio das bombas e o fogo seguem o ritmo; as esteiras não.",
    tips: ["Na hora lenta dá pra encurralar com calma; na rápida, solte e corra antes.", "Fique de olho no aviso de ritmo: uma bomba solta no lento pode estourar no rápido."],
  },
  "sb4-03": {
    text: "Duas bolas gigantes ficam na arena. Uma explosão que chega nelas faz a bola rolar 8 casas na direção do fogo, virando nos obstáculos: esmaga quem estiver no caminho e detona as bombas que atropela.",
    tips: ["Mire a explosão na bola com o rival do outro lado.", "Ninguém passa por uma bola parada: use ela como parede.", "Ouviu explosão perto de uma bola? Saia da linha dela."],
  },
  "sb4-04": {
    text: "Buracos no meio e nas laterais da arena: quem pisa num buraco cai e está fora da rodada, e a bomba que cair nele some. Ideal pra empurrões, chutes e socos.",
    tips: ["Empurrar ou socar alguém pra perto do buraco vale mais que explodir.", "Quem está pulando, voando ou sendo carregado passa por cima sem cair."],
  },
  "sb4-05": {
    text: "Arena vazia, sem blocos e sem itens: todo mundo já começa forte, com 5 bombas, 6 de fogo, chute, soco, empurrão e luva. É briga direta desde o primeiro segundo.",
    tips: ["Sem blocos pra se esconder, o fogo vai longe: nunca fique na linha de uma bomba.", "Chute e soco decidem: mande as bombas de volta antes que estourem."],
  },
  "sb4-06": {
    text: "Todo o chão é de painéis surpresa: cada vez que o fogo passa, o painel vira normal, gelo (você escorrega até a próxima casa), cola (anda pela metade e as bombas chutadas param) ou invertido (os comandos ficam trocados por uns segundos).",
    tips: ["Depois de cada explosão olhe o chão antes de andar.", "Fuja da cola quando estiver fugindo de fogo; use ela pra frear bomba chutada."],
  },
  "sb4-07": {
    text: "Um jardim cheio de folhagem que esconde quem passa por baixo, com caminhos escondidos sob ela, e quatro setas que desviam as bombas chutadas, girando em volta da arena. Bom mapa pra emboscada.",
    tips: ["Debaixo das folhas os rivais não te veem bem: arme a armadilha ali.", "Tem bastante chute (5): chute uma bomba numa seta e ela vira pro lado que a seta aponta."],
  },
  "sb4-08": {
    text: "Sem blocos e sem itens no chão: três botões de caça-níquel na linha do meio. Acerte um com a explosão e as roletas giram; o resultado solta itens pela arena — ou uma caveira. Três setes dão o prêmio máximo, uma chuva de itens.",
    tips: ["Quem acerta o botão primeiro ganha a corrida pelos itens.", "Não dá pra soltar bomba em cima do botão: solte ao lado, com o fogo alcançando.", "Cuidado com as caveiras que a roleta também solta."],
  },
  "sb4-09": {
    text: "Quatro gangorras: pisar na ponta de baixo de qualquer uma vira todas, e quem estava na ponta de cima é lançado pelos ares (dá pra guiar pra esquerda e direita no voo, e até atravessar a borda). As bombas nas pontas também voam.",
    tips: ["Pise na ponta baixa quando um rival estiver na alta: ele voa pra longe.", "Coloque uma bomba na ponta alta e vire a gangorra pra lançar ela.", "No voo, procure um lugar livre pra cair: se não houver, você não sobrevive."],
  },
  "sb4-10": {
    text: "Oito blocos escondem máscaras de fantasia. Quem veste uma (abelha ou Kotetsu) aguenta uma explosão a mais, fica alguns segundos invencível depois e ainda se livra da caveira. O fogo queima a máscara solta no chão.",
    tips: ["Quebre blocos cedo: uma fantasia vale uma vida extra.", "Ao achar uma máscara, pegue rápido antes que uma explosão queime ela."],
  },
  "sb4-11": {
    text: "Um carrinho de mina percorre trilhos pela arena. Suba nele e ele te leva por uma rota: no caminho você não controla nada mas o fogo não te pega, e ele quebra blocos, detona bombas e atropela quem estiver na frente.",
    tips: ["Embarcar na hora certa atravessa a arena atropelando os rivais.", "Ouviu o carrinho vindo? Saia dos trilhos.", "Se quem pilota cair, o carrinho espera um pouco antes de levar outro."],
  },
  "sb4-12": {
    text: "Cada jogador tem uma bandeira num poste. Se o fogo alcançar a sua bandeira, você está fora — mesmo longe dela. Qualquer um pode pegar uma bandeira e carregá-la; com ela na mão não dá pra usar o especial, e Firmar solta a bandeira onde você está.",
    tips: ["Proteja a sua bandeira: leve-a pra longe das explosões.", "Pegue a bandeira de um rival e solte perto de uma bomba.", "Firmar (Q) larga a bandeira quando você precisar do especial."],
  },
};

/** Every map a room can pick, in the lobby's order, with its name, what it does and tips. */
export const MAP_GUIDE = SELECTABLE_STAGES.map((id) => ({ id, name: STAGE_NAMES[id], ...INFO[id]! }));

/** The short label on a map's card: its number for the SB4 maps, a symbol for ours. */
const badge = (id: StageId): string => (id.startsWith("sb4-") ? id.slice(4) : id === "classic" ? "★" : id === "conveyor" ? "⇄" : "◎");

export interface MapGuideHooks {
  close(): void;
  /** The selected map changed: play it in `host`. */
  show(stage: StageId, host: HTMLElement): void;
}

/** The map guide from the menu: pick a map to watch bots play it, with what makes it different and tips. */
export function mapGuide(hooks: MapGuideHooks): { root: HTMLElement; open(): void } {
  const stage = el("div", { class: "guide-stage" });
  const head = el("div", { class: "guide-head" });
  const text = el("p", { class: "guide-text" });
  const tips = el("ul", { class: "guide-tips" });
  const cards: HTMLButtonElement[] = [];
  let current = 0;

  const select = (i: number) => {
    current = i;
    const map = MAP_GUIDE[i]!;
    cards.forEach((c, j) => c.classList.toggle("on", i === j));
    head.replaceChildren(el("span", { class: "map-badge big", text: badge(map.id) }), el("h3", { text: map.name }));
    text.textContent = map.text;
    tips.replaceChildren(...map.tips.map((t) => el("li", { text: t })));
    hooks.show(map.id, stage);
  };

  const list = el(
    "div",
    { class: "guide-list" },
    MAP_GUIDE.map((map, i) => {
      const card = button("", () => select(i), "guide-card");
      card.append(el("span", { class: "map-badge", text: badge(map.id) }), el("span", { text: map.name.replace(/^SB4 \d+ · /, "") }));
      cards.push(card);
      return card;
    }),
  );
  const detail = el("div", { class: "guide-detail" }, [stage, head, text, el("strong", { class: "guide-tips-title", text: "Dicas" }), tips]);
  const root = el("div", { class: "card guide maps" }, [
    el("h2", { text: "Mapas" }),
    el("div", { class: "guide-body" }, [list, detail]),
    backButton("Voltar", hooks.close, "primary"),
  ]);
  return { root, open: () => select(current) };
}
