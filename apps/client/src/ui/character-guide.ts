import { CHARACTERS, type CharacterId } from "@bombtop/shared";
import type { SoundName } from "../audio/sound";
import { voiceLine } from "../audio/voices";
import { PLAYER_COLORS } from "./art";
import { backButton, button, el } from "./dom";
import { CHARACTER_SHEETS, characterArt, characterMoves } from "./sheet-art";

interface Info {
  name: string;
  /** A few words on who they are. */
  title: string;
  story: string;
  special: { name: string; recharge: string; text: string; tips: string[] };
}

const INFO: Record<CharacterId, Info> = {
  bomb: {
    name: "Bomba",
    title: "O mascote explosivo",
    story:
      "Nasceu de um pavio aceso no fundo de uma fábrica de fogos e nunca mais apagou. A cabeça é uma bomba de verdade, e ele leva isso com muito orgulho: foi ele quem inventou as batalhas da arena, e não admite perder no próprio jogo. Calmo por fora, sempre a um segundo de explodir por dentro.",
    special: {
      name: "Bomba gigante",
      recharge: "25 s",
      text: "Planta uma bombona no próprio lugar: o fogo é perfurante (atravessa blocos, itens e bombas) e vai duas vezes mais longe que o fogo dele. Não ocupa nenhuma das suas bombas normais.",
      tips: [
        "Plante e saia de lado, nunca em linha reta: a explosão é uma cruz enorme.",
        "Cada item de fogo conta em dobro na bomba gigante: junte fogo antes de usar.",
        "Ela não gasta suas bombas: solte bombas normais junto para fechar as rotas de fuga.",
        "Ótima para limpar uma fileira de blocos de uma vez no começo da partida.",
      ],
    },
  },
  captain: {
    name: "Capitão América",
    title: "O sentinela da liberdade",
    story:
      "Um soldado que nunca desiste e um escudo que nunca quebra. Chegou à arena para proteger os novatos e acabou descobrindo que o escudo dele faz algo ainda melhor: devolve tudo o que mandam nele. Ele não começa a briga, mas termina.",
    special: {
      name: "Escudo",
      recharge: "20 s",
      text: "Ergue o escudo por 3 s, parado e virado para a frente. Fogo e golpes que vêm na direção do escudo param nele e voltam: o fogo de uma bomba à frente vai duas vezes mais longe do outro lado, e raios voltam em quem atirou.",
      tips: [
        "Vire para o perigo antes de apertar: com o escudo erguido você não gira.",
        "Só protege a frente: fogo pelos lados ou pelas costas ainda te pega.",
        "Devolve o raio do Thor, a teia do Homem-Aranha e o Kamehameha do Goku em quem mandou.",
        "O Naruto que bater no escudo fica tonto em vez de você.",
      ],
    },
  },
  thor: {
    name: "Thor",
    title: "O deus do trovão",
    story:
      "Veio de Asgard atrás de uma boa briga e achou a arena perfeita: barulho, fogo e adversários que não fogem. O martelo chama raios do céu, e ele não perde a chance de mostrar isso. Barulhento, confiante e sempre o primeiro a rir da própria vitória.",
    special: {
      name: "Raio do trovão",
      recharge: "20 s",
      text: "Ergue o martelo e solta um raio 5 casas em linha reta à frente. O primeiro jogador atingido fica tonto por 2 s, sem andar nem agir.",
      tips: [
        "É o alcance mais longo dos poderes que prendem: acerte de longe e chegue com a bomba.",
        "Tonto por 2 s dá tempo de soltar uma bomba e sair do caminho.",
        "Atire pelos corredores abertos: blocos, bombas e paredes param o raio.",
        "O escudo do Capitão manda o raio de volta: não atire nele de frente.",
      ],
    },
  },
  goku: {
    name: "Goku",
    title: "O saiyajin que só quer lutar",
    story:
      "Ouviu falar de um torneio onde todo mundo explode tudo e veio correndo, com fome e sorrindo. Treinou a vida inteira para ficar mais forte e enxerga cada rival como um novo desafio. Na arena, junta o ki nas mãos e deixa o Kamehameha falar por ele.",
    special: {
      name: "Kamehameha",
      recharge: "30 s",
      text: "Carrega o ki por um instante, parado (ficar tonto cancela), e dispara um raio 5 casas à frente que quebra os blocos no caminho. O primeiro jogador atingido fica tonto por 2 s, sem andar nem agir. Paredes param o raio.",
      tips: [
        "Use para abrir corredores e limpar blocos rapidamente.",
        "Enquanto carrega você fica parado: nunca use com fogo vindo na sua direção.",
        "Atravessa blocos: acerta quem se esconde atrás deles.",
        "O raio não detona bombas.",
        "A recarga é a mais longa (30 s): se errar, jogue com calma até voltar.",
      ],
    },
  },
  naruto: {
    name: "Naruto",
    title: "O ninja que nunca desiste",
    story:
      "O ninja mais barulhento da Vila da Folha quer ser reconhecido por todo mundo, e a arena é o palco perfeito. Erra, cai, levanta e tenta de novo, sempre gritando que vai ganhar. Quando corre com o Rasengan na mão, ninguém fica no caminho.",
    special: {
      name: "Rasengan",
      recharge: "20 s",
      text: "Avança 3 casas em linha reta com a esfera de chakra. O primeiro jogador que ele acertar é arremessado até 2 casas e fica tonto por 2 s. Um bloco no caminho quebra e para a corrida; paredes e bombas também param.",
      tips: [
        "Empurre o rival para dentro do fogo da sua bomba.",
        "É uma fuga rápida: 3 casas num piscar de olhos para sair da linha de uma explosão.",
        "Quebra um bloco à frente: bom para abrir caminho quando você está encurralado.",
        "Não corra contra o escudo do Capitão: quem fica tonto é você.",
      ],
    },
  },
  spider: {
    name: "Homem-Aranha",
    title: "O amigo da vizinhança",
    story:
      "Um garoto do Queens que ganhou os poderes de uma aranha e aprendeu cedo que grandes poderes trazem grandes responsabilidades. Na arena ele não para de falar nem de pular, e sempre tem uma piada pronta. Quando a coisa aperta, um jato de teia resolve: quem leva fica grudado esperando a bomba chegar.",
    special: {
      name: "Teia",
      recharge: "20 s",
      text: "Dispara teia 5 casas em linha reta à frente. O primeiro jogador atingido fica enrolado num casulo por 4 s: não anda nem solta bombas, mas o fogo ainda pega.",
      tips: [
        "Prenda e solte uma bomba do lado: enrolado não foge.",
        "Alcança 5 casas: acerte de longe e chegue com a bomba antes de a teia soltar.",
        "Blocos, bombas e paredes param a teia: atire pelos corredores abertos.",
        "O escudo do Capitão devolve a teia: quem fica grudado é você.",
      ],
    },
  },
  pikachu: {
    name: "Pikachu",
    title: "O ratinho elétrico",
    story:
      "Saiu da floresta atrás de um bom desafio e descobriu que a arena é cheia de rivais para chocar. Pequeno, rápido e teimoso, guarda eletricidade nas bochechas vermelhas e solta tudo de uma vez quando alguém chega perto demais. O lenço azul foi presente de um velho treinador, e ele não tira por nada.",
    special: {
      name: "Choque do Trovão",
      recharge: "20 s",
      text: "Solta uma descarga em volta de si: todo jogador até 2 casas de distância, para cima, para baixo e para os lados, fica tonto por 2 s. Blocos, bombas e paredes param o choque.",
      tips: [
        "Pega todo mundo ao redor de uma vez: ótimo quando te cercam.",
        "Não atravessa blocos: use nos corredores abertos.",
        "Tonto por 2 s dá tempo de soltar uma bomba do lado e sair.",
        "O escudo do Capitão virado para você devolve o choque: quem fica tonto é você.",
      ],
    },
  },
  static: {
    name: "Super Choque",
    title: "O herói elétrico de Dakota",
    story:
      "Virgil era só um garoto de Dakota até respirar o gás do Big Bang e sair de lá cheio de eletricidade. Agora controla o magnetismo, voa numa tampa de bueiro e não perde uma piada nem no meio da briga. Descobriu que a arena é o melhor treino que existe: tem metal, faísca e rival para todo lado.",
    special: {
      name: "Puxão Magnético",
      recharge: "20 s",
      text: "Lança um campo magnético em linha reta: o primeiro jogador até 5 casas à frente é arrastado até a casa colada nele e fica tonto por 2 s. Blocos, bombas e paredes param o campo.",
      tips: [
        "Puxe e solte uma bomba na hora: ele chega tonto bem do seu lado.",
        "Funciona de longe (5 casas): tire o rival de um esconderijo no fim do corredor.",
        "Só o primeiro da linha é puxado: quem vem atrás fica onde está.",
        "O escudo do Capitão devolve o campo: quem é arrastado até ele, tonto, é você.",
      ],
    },
  },
  flash: {
    name: "Flash",
    title: "O homem mais rápido do mundo",
    story:
      "Barry Allen era um perito criminal que vivia chegando atrasado, até um raio cair no laboratório dele numa noite de tempestade. Acordou ligado à Força de Aceleração e nunca mais se atrasou para nada. Na arena ele chega antes da bomba explodir, antes do rival perceber e às vezes antes até da partida começar.",
    special: {
      name: "Supervelocidade",
      recharge: "20 s",
      text: "Dispara num piscar até 5 casas em linha reta, atravessando quem estiver no caminho: todo jogador que ele passa fica tonto por 2 s. Para antes de blocos, bombas e paredes, e nunca termina em cima de alguém.",
      tips: [
        "Solte uma bomba e atravesse o rival: ele fica tonto bem na linha do fogo.",
        "É também a melhor fuga do jogo: 5 casas num piscar, para longe da explosão.",
        "Pega todo mundo da fileira de uma vez, não só o primeiro.",
        "O escudo do Capitão virado para você te para na frente dele, e quem fica tonto é você.",
      ],
    },
  },  bugs: {
    name: "Pernalonga",
    title: "O coelho mais esperto do pedaço",
    story:
      "Mora numa toca que ele mesmo cavou e passa os dias mastigando cenoura e fazendo caçador de bobo. Ouviu falar de uma arena cheia de bombas, achou que era um atalho para Pismo Beach e desceu cavando. Pegou a esquerda errada em Albuquerque, saiu bem no meio da partida e resolveu ficar. Ninguém consegue encurralar quem anda por baixo da terra.",
    special: {
      name: "Toca",
      recharge: "20 s",
      text: "Cava e some no chão: sai até 5 casas à frente, na casa livre mais longe, passando por baixo de paredes, blocos, bombas e jogadores. Nunca sai em cima de alguém, de uma bomba ou do fogo, e se não houver saída ele fica onde está e não gasta o especial.",
      tips: [
        "Encurralado? Solte a bomba e cave: ela explode onde você estava.",
        "Atravessa uma fileira de blocos inteira sem quebrar nenhum.",
        "Olhe para onde vai sair: ele escolhe a casa livre mais longe, não a mais segura.",
        "O escudo do Capitão não para quem está debaixo da terra.",
      ],
    },
  },  lantern: {
    name: "Lanterna Verde",
    title: "O fuzileiro com o anel mais poderoso do universo",
    story:
      "John Stewart era arquiteto e fuzileiro naval quando os Guardiões de Oa o escolheram para usar o anel: alguém sem medo e com uma vontade de ferro. Tudo o que ele imagina vira energia verde, e como bom arquiteto ele constrói com cuidado. Na arena, quando a bomba explode bem embaixo dele, ele só fecha a bolha e espera o fogo passar.",
    special: {
      name: "Bolha protetora",
      recharge: "25 s",
      text: "Ergue em volta de si uma bolha de energia verde por 3 s: fogo vindo de qualquer lado não entra, nem o da bomba embaixo dele. Dentro dela ele anda na metade da velocidade. A bolha não segura raio, teia nem os outros especiais.",
      tips: [
        "Plante a bomba no meio dos rivais e fique: a bolha te segura no fogo.",
        "Ative um instante antes da explosão: 3 s passam rápido.",
        "No último segundo ela pisca: saia do fogo antes de ela estourar.",
        "Dentro dela você fica lento, então não conte com fugir correndo.",
      ],
    },
  },
  donatello: {
    name: "Donatello",
    title: "O gênio do casco roxo",
    story:
      "O cérebro das Tartarugas Ninja: mora no esgoto de Nova York, conserta tudo o que quebra no esconderijo e inventa o que ainda não existe. Enquanto os irmãos usam espadas e nunchakus, ele confia no bo, um bastão comprido que mantém qualquer um à distância. Na arena, fez as contas: bomba que chega perto dele volta para quem mandou.",
    special: {
      name: "Giro do bastão",
      recharge: "20 s",
      text: "Gira o bo em volta de si: atordoa por 2 s quem estiver colado nele (nas 4 casas vizinhas ou na mesma casa) e rebate cada bomba vizinha 3 casas para longe, na direção em que foi batida, como um soco. O escudo do Capitão virado para ele segura aquele lado e quem fica tonto é ele.",
      tips: [
        "Bomba encostada em você? Gire e mande ela de volta para o rival.",
        "Rival colado: gire, ele fica tonto, e solte a bomba do lado dele.",
        "Rebate as bombas dos 4 lados de uma vez: ótimo quando te cercam.",
        "Bomba rebatida não explode no ar: ela cai e aí o pavio volta a correr.",
      ],
    },
  },
  penelope: {
    name: "Penélope Charmosa",
    title: "A pilota mais charmosa da corrida",
    story:
      "A única garota da Corrida Maluca, ao volante do seu carrinho cor-de-rosa. Vive sendo raptada pelo Tião Gavião, e enquanto a Quadrilha de Morte corre para salvá-la, ela quase sempre escapa sozinha, sem borrar a maquiagem. Na arena, troca o volante pelas bombas e descobriu que um beijinho no ar desarma qualquer rival.",
    special: {
      name: "Beijo charmoso",
      recharge: "20 s",
      text: "Manda um beijo no ar: um coração voa até 5 casas para a frente e o primeiro jogador que ele acerta fica encantado, com corações rodando na cabeça, sem se mexer por 2 s. Paredes, blocos e bombas param o coração. O escudo do Capitão devolve o beijo para ela.",
      tips: [
        "Encantou? Corra e solte uma bomba do lado dele: são 2 s parado.",
        "Mire pelos corredores: o coração não passa por blocos.",
        "Cuidado com o Capitão: com o escudo erguido, quem fica encantada é você.",
        "Beije quem vem correndo atrás de você e ganhe tempo para fugir.",
      ],
    },
  },
  panther: {
    name: "Pantera Cor-de-Rosa",
    title: "O felino mais elegante (e calado) dos desenhos",
    story:
      "Nasceu na abertura de um filme de detetive sobre um diamante rosa e escapou para os desenhos: um felino cor-de-rosa que quase nunca fala, resolve tudo com calma e anda na ponta dos pés ao som do próprio tema. Na arena, ninguém o vê chegar: quando você nota, a bomba já está do seu lado. O cachecol azul fica na cor do jogador.",
    special: {
      name: "Na ponta dos pés",
      recharge: "20 s",
      text: "Sai de fininho e some da tela dos rivais por 4 s (só um sopro de fumaça rosa onde ele estava). Anda na velocidade de sempre e pode soltar bombas; na sua tela ele aparece transparente. Os bots perdem ele de vista. O fogo continua pegando ele.",
      tips: [
        "Some, chegue perto e solte a bomba ao lado do rival antes de ele te ver.",
        "Use para fugir de quem te persegue: ele perde você de vista.",
        "Ele reaparece aos poucos no último meio segundo: já esteja longe.",
        "Invisível não é imortal: cuidado com o fogo das próprias bombas.",
      ],
    },
  },
  harry: {
    name: "Harry Potter",
    title: "O menino que sobreviveu",
    story:
      "Bruxo da Grifinória, apanhador do time de quadribol e dono da cicatriz em forma de raio mais famosa de Hogwarts. Aprendeu com o professor Lupin um feitiço que pouquíssimos alunos conseguem: o Patrono, um cervo prateado de pura luz. Na arena, troca os dementadores pelos rivais. A capa vermelha fica na cor do jogador.",
    special: {
      name: "Expecto Patronum",
      recharge: "25 s",
      text: "Conjura o Patrono: um cervo prateado sai galopando para a frente até bater numa parede ou bloco, pulando por cima das bombas, e deixa tonto por 2 s cada jogador que ele alcança no caminho, não só o primeiro. O escudo do Capitão virado para ele segura o cervo.",
      tips: [
        "Rivais enfileirados no corredor? Um cervo só pega todos.",
        "O cervo atravessa o mapa: mire num corredor comprido e pegue quem estiver lá no fundo.",
        "O cervo pula as bombas: mire por cima delas em quem está atrás.",
        "Atordoou? Corra e solte uma bomba do lado: são 2 s parado.",
        "O Capitão com o escudo erguido segura o cervo: espere ele baixar.",
      ],
    },
  },
  optimus: {
    name: "Optimus Prime",
    title: "O líder dos Autobots",
    story:
      "Líder dos Autobots, robôs vindos do planeta Cybertron que se disfarçam de veículos. Por baixo do capacete azul e da máscara prateada bate a centelha de um herói que defende quem não pode se defender, e ele leva a Matriz da Liderança no peito. Quando a coisa aperta, vira um caminhão vermelho e passa por cima. O azul da armadura fica na cor do jogador.",
    special: {
      name: "Autobots, rolar!",
      recharge: "25 s",
      text: "Se transforma no caminhão onde está e acelera reto por até 6 casas, sem obedecer o controle. Quem estiver na frente vai sendo empurrado pelo para-choque e fica tonto por 2 s; se não tiver para onde empurrar (parede, bloco, bomba ou outro jogador atrás), o caminhão para ali. Uma bomba no caminho sai deslizando, um bloco é esmagado e queima, e o escudo do Capitão virado para ele para o caminhão e deixa o Optimus tonto.",
      tips: [
        "Encurrale: empurre o rival até a parede e solte uma bomba do lado enquanto ele está tonto.",
        "Leva o rival junto: pode arrastar alguém para dentro do fogo de uma bomba prestes a explodir.",
        "Bomba na frente? O caminhão chuta ela para longe: use para mandar bombas no rival.",
        "Ele se transforma parado por um instante: não use com fogo chegando.",
        "Abre caminho: o caminhão esmaga um bloco na frente.",
      ],
    },
  },
  pele: {
    name: "Pelé",
    title: "O Rei do Futebol",
    story:
      "Edson Arantes do Nascimento, o Rei. Fez mais de mil gols, foi tricampeão do mundo com a seleção e transformou a camisa amarela e a 10 em lenda. Na arena ele troca a bomba pelo pé: domina, levanta a cabeça e manda a bola onde quer. O short azul fica na cor do jogador.",
    special: {
      name: "Chute de craque",
      recharge: "20 s",
      text: "Chuta uma bola reta para a frente, até 7 casas. O primeiro jogador que ela acerta cai tonto por 2 s. Se uma bomba estiver no caminho, a bola chuta a bomba e ela sai deslizando para longe. Paredes e blocos seguram a bola, e o escudo do Capitão devolve o chute em quem chutou.",
      tips: [
        "Alcance de 7 casas: acerte o rival lá do outro lado do corredor.",
        "Tem uma bomba entre vocês? Chute nela: a bola manda a bomba deslizando na direção do rival.",
        "Rival tonto? Corra e solte uma bomba do lado dele: são 2 s parado.",
        "Bloco no caminho segura a bola: limpe o corredor antes.",
        "Cuidado com o Capitão de escudo erguido: a bola volta em você.",
      ],
    },
  },
  lula: {
    name: "Lula",
    title: "O Companheiro da Picanha",
    story:
      "Luiz Inácio Lula da Silva, o metalúrgico do ABC que virou presidente do Brasil. Fala de churrasco como ninguém e vive prometendo picanha pra todo mundo. Na arena ele cumpre a promessa do jeito dele. A camiseta vermelha fica na cor do jogador.",
    special: {
      name: "Promessa de picanha",
      recharge: "20 s",
      text: "Deixa uma picanha na casa da frente. Ela parece um item como qualquer outro, mas quem pegar fica parado, decepcionado, por 2 s, e ainda perde um dos seus itens, sorteado, que cai em algum lugar da arena. O Lula passa por cima da própria picanha sem pegar, e o fogo queima ela como qualquer item. Só funciona numa casa livre: sem bloco, bomba, item ou jogador.",
      tips: [
        "Deixe a picanha no caminho do rival: quem vai atrás de item cai direitinho.",
        "Rival parado? Corra e solte uma bomba do lado dele: são 2 s sem sair do lugar.",
        "Bots adoram item: largue a picanha onde eles passam.",
        "Use num corredor apertado: o rival que quiser passar vai ter que pegar.",
        "Cuidado com o fogo: uma explosão queima a picanha antes de alguém pegar.",
      ],
    },
  },
};

/** What the special sounds like when the character has no line of their own (Goku and Naruto shout inside it; Static's crackles). */
const SPECIAL_SOUND: Partial<Record<CharacterId, SoundName>> = { goku: "kamehameha", naruto: "rasengan", static: "magnet" };

/** Every character with who they are, their story, their special with tips, and their voice lines. */
export const CHARACTER_GUIDE = CHARACTERS.map((id) => {
  const voice = (label: string, sound: SoundName | null) => (sound ? [{ label, sound }] : []);
  return {
    id,
    ...INFO[id],
    color: null,
    voices: [
      ...voice("Escolha", voiceLine(id, "pick")),
      ...voice("Especial", voiceLine(id, "special") ?? SPECIAL_SOUND[id] ?? null),
      ...voice("Vitória", voiceLine(id, "win")),
      ...voice("Derrota", voiceLine(id, "death")),
    ],
  };
});

export interface CharacterGuideHooks {
  close(): void;
  /** The selected character changed: show their special in use in `stage`. */
  show(character: CharacterId, stage: HTMLElement, color: string | null): void;
  colorChanged(color: string | null): void;
  /** Plays one of their voice lines. */
  hear(sound: SoundName): void;
}

/** The character guide from the menu: pick a character to see their special in use, their story, tips and every animation. */
export function characterGuide(hooks: CharacterGuideHooks): { root: HTMLElement; open(): void } {
  const stage = el("div", { class: "guide-stage" });
  const head = el("div", { class: "guide-head chars-head" });
  const story = el("p", { class: "guide-text" });
  const special = el("div", { class: "chars-special" });
  const tips = el("ul", { class: "guide-tips" });
  const voices = el("div", { class: "chars-voices" });
  const moves = el("div", { class: "chars-moves" });
  const portrait = el("div", { class: "chars-portrait" });
  const colors = el("div", { class: "chars-colors" });
  colors.setAttribute("role", "group");
  colors.setAttribute("aria-label", "Cor da prévia do personagem");
  const cards: HTMLButtonElement[] = [];
  let current = 0;
  let previewColor: string | null = null;

  const paintPreview = () => {
    const c = CHARACTER_GUIDE[current]!;
    portrait.replaceChildren(characterArt(c.id, previewColor, "walk"));
    moves.replaceChildren(
      ...characterMoves(CHARACTER_SHEETS[c.id]).map((m) =>
        el("figure", { class: "chars-move" }, [characterArt(c.id, previewColor, m), el("figcaption", { text: m.label })]),
      ),
    );
    for (const control of colors.querySelectorAll("button")) {
      control.setAttribute("aria-pressed", String(control.dataset.color === (previewColor ?? "original")));
    }
  };
  const colorNames = ["Branco", "Preto", "Vermelho", "Azul", "Verde"];
  [null, ...PLAYER_COLORS].forEach((color, i) => {
    const control = button(i === 0 ? "Original" : colorNames[i - 1]!, () => {
      previewColor = color;
      paintPreview();
      hooks.colorChanged(previewColor);
    }, "ghost chars-color");
    control.dataset.color = color ?? "original";
    if (color) control.style.setProperty("--swatch", color);
    control.setAttribute("aria-pressed", String(color === null));
    colors.appendChild(control);
  });

  const select = (i: number) => {
    current = i;
    const c = CHARACTER_GUIDE[i]!;
    cards.forEach((card, j) => {
      card.classList.toggle("on", i === j);
      card.setAttribute("aria-pressed", String(i === j));
    });
    head.replaceChildren(
      portrait,
      el("div", {}, [el("h3", { text: c.name }), el("p", { class: "chars-title", text: c.title })]),
    );
    story.textContent = c.story;
    special.replaceChildren(
      el("div", { class: "chars-special-head" }, [
        el("strong", { text: `Especial: ${c.special.name}` }),
        el("span", { class: "chip", text: `recarga ${c.special.recharge}` }),
      ]),
      el("p", { class: "guide-text", text: c.special.text }),
    );
    tips.replaceChildren(...c.special.tips.map((t) => el("li", { text: t })));
    voices.replaceChildren(...c.voices.map((v) => button(`🔊 ${v.label}`, () => hooks.hear(v.sound), "ghost voice")));
    paintPreview();
    hooks.show(c.id, stage, previewColor);
  };

  const list = el(
    "div",
    { class: "guide-list chars-list" },
    CHARACTER_GUIDE.map((c, i) => {
      const card = button("", () => select(i), "guide-card");
      card.append(characterArt(c.id, c.color, "idle"), el("span", { text: c.name }));
      cards.push(card);
      return card;
    }),
  );
  list.setAttribute("aria-label", "Selecionar personagem");
  const roster = el("section", { class: "chars-roster" }, [
    el("div", { class: "chars-roster-head" }, [
      el("h3", { text: "Escolha um personagem" }),
      el("span", { class: "chip", text: String(CHARACTER_GUIDE.length) }),
    ]),
    el("p", { class: "chars-scroll-hint", text: "Role a lista para ver todos" }),
    list,
  ]);
  const detail = el("div", { class: "guide-detail" }, [
    head,
    el("section", { class: "chars-palette" }, [el("h4", { text: "Cores da prévia" }), colors]),
    stage,
    story,
    special,
    el("strong", { class: "guide-tips-title", text: "Dicas do especial" }),
    tips,
    el("strong", { class: "guide-tips-title", text: "Voz" }),
    voices,
    el("strong", { class: "guide-tips-title", text: "Animações" }),
    moves,
  ]);
  const root = el("div", { class: "card guide chars" }, [
    el("h2", { text: "Personagens" }),
    el("div", { class: "guide-body" }, [roster, detail]),
    backButton("Voltar", hooks.close, "primary"),
  ]);
  return { root, open: () => select(current) };
}
