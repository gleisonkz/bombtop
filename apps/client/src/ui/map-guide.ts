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
  "sb2-01": {
    text: "A arena básica do Super Bomberman 2: blocos fixos, sempre no mesmo lugar, e itens sorteados de uma bolsa a cada rodada (nem todo bloco tem item). Aos 0:33 do relógio as paredes começam a fechar em espiral.",
    tips: ["O mapa não muda: decore as rotas de fuga dos cantos.", "Fique de olho no relógio: aos 0:33 as bordas começam a fechar."],
  },
  "sb2-02": {
    text: "O chão todo é gelo: você acelera aos poucos e demora a parar. Seis círculos de lançamento ficam ligados por um trilho: pise num círculo livre e você é levado pelo trilho até outro círculo, que te solta pelo ar. No caminho não dá pra controlar nem soltar bomba.",
    tips: ["Comece a frear antes: no gelo você escorrega além do que quer.", "O trilho atravessa a arena rápido: bom pra fugir, mas você não escolhe onde sai.", "As bombas param o seu corpo: use-as como parede no gelo."],
  },
  "sb2-03": {
    text: "Arena cercada de água, com quatro túneis nas bordas (colunas 3 e 11, em cima e embaixo): entre num deles e você sai do lado oposto da arena. Com só dois jogadores vivos na mesma coluna e colados, quem está embaixo e anda pra cima empurra o de cima.",
    tips: ["Os túneis são a saída mais rápida de uma emboscada.", "Um túnel só deixa passar quando a saída está livre: não conte com ele com alguém do outro lado."],
  },
  "sb2-04": {
    text: "Uma canaleta de pólvora forma um anel no meio da arena e todos começam dentro dele. Se uma explosão alcança qualquer casa da canaleta, o anel inteiro pega fogo de uma vez por um instante, e quem estiver em cima dele queima.",
    tips: ["Nunca espere em cima da canaleta quando houver bomba perto dela.", "Uma bomba com o fogo chegando na canaleta acerta quem está do outro lado do anel."],
  },
  "sb2-05": {
    text: "Placas vermelhas no chão, algumas escondidas sob blocos: uma bomba solta em cima de uma placa explode com fogo 10, cruzando a arena, sem mudar o seu fogo normal.",
    tips: ["Leve o rival pra linha de uma placa e solte a bomba nela.", "Viu bomba numa placa? Saia da linha e da coluna inteiras."],
  },
  "sb2-06": {
    text: "Dois pares de teleportes em cantos opostos do meio da arena: pisou em um, sai no outro. Só jogadores viajam (bombas e itens não), não dá pra soltar bomba em cima de um teleporte e ele não funciona enquanto há fogo nele.",
    tips: ["Para usar de novo, saia da casa de chegada primeiro.", "Fogo no teleporte bloqueia a fuga: não conte com ele no meio da explosão."],
  },
  "sb2-07": {
    text: "Quase sem blocos. No centro, um painel de pausa: quem pisa fica parado uns 2,5 segundos (o fogo ainda pega). Nas laterais, dois painéis com números de 1 a 5: pisar define a sua velocidade pelo número mostrado (1 bem lento, 5 muito rápido) e o painel sorteia outro número.",
    tips: ["Olhe o número antes de pisar: um 1 pode te deixar lento a rodada toda.", "Não pise no painel do centro com bomba por perto."],
  },
  "sb2-08": {
    text: "Uma esteira em anel no meio da arena, girando no sentido horário: leva quem está parado em cima e carrega as bombas, que param ao encontrar alguém. Dois botões no centro: um inverte o sentido da esteira, o outro alterna entre lenta e rápida.",
    tips: ["Solte a bomba na esteira e deixe ela chegar no rival.", "Inverta a esteira quando uma bomba estiver indo na sua direção.", "Na velocidade rápida, a bomba atravessa o anel num instante."],
  },
  "sb2-09": {
    text: "Setas no chão desviam as bombas chutadas: a bomba deslizando vira para onde a seta aponta. Só as setas dos cantos começam à vista; as outras estão sob blocos. Os jogadores passam por elas normalmente.",
    tips: ["Pegue o chute cedo: aqui ele vale muito.", "Estude onde cada seta manda a bomba antes de chutar."],
  },
  "sb2-10": {
    text: "O botão de ação faz pular: o pulo passa por cima de paredes e blocos (uma casa pro lado, ou ajustando pra cima e pra baixo) e no ar o fogo não te pega. Caiu em cima de algo, você escorrega até o chão livre; pulou pra fora da borda, aparece do outro lado.",
    tips: ["Encurralado? Pule por cima da parede.", "Pular no ar escapa do fogo, mas veja onde vai cair."],
  },
  "sb2-11": {
    text: "Arena aberta, sem blocos: todo mundo começa com 6 bombas, fogo 7, chute, luva e mais velocidade, e uma caveira no centro. Empurre contra a borda por um instante e você é lançado para dentro da arena, a salvo do fogo durante o voo. Bombas chutadas batem na borda e voltam.",
    tips: ["O lançamento é a fuga mais rápida, mas durante a preparação o fogo ainda pega.", "Com fogo 7 e sem blocos, nenhuma linha é segura perto de uma bomba."],
  },
  "sb2-12": {
    text: "Dois tipos de piso no meio da arena. As molas (azuis) te lançam na direção que você segura, por cima de tudo e sem levar fogo no ar. Os alçapões (dourados) prendem quem pisa no lugar, arrancam de 1 a 3 itens, que voam pela arena, e pegam fogo; cada um funciona uma vez.",
    tips: ["Nunca pise num alçapão dourado.", "Use as molas para atravessar a arena e escapar de cercos."],
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

/** The short label on a map's card: its number for the SB4 and SB2 maps, a symbol for ours. */
const badge = (id: StageId): string => (id.startsWith("sb4-") || id.startsWith("sb2-") ? id.slice(4) : id === "classic" ? "★" : id === "conveyor" ? "⇄" : "◎");

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
      card.append(el("span", { class: "map-badge", text: badge(map.id) }), el("span", { text: map.name.replace(/^SB4 \d+ · /, "").replace(/^SB2 \d+ · /, "SB2 · ") }));
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
