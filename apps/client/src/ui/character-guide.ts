import { CHARACTERS, type CharacterId } from "@bombtop/shared";
import type { SoundName } from "../audio/sound";
import { voiceLine } from "../audio/voices";
import { MASCOT_COLOR, PLAYER_COLORS } from "./art";
import { backButton, button, el } from "./dom";
import { CHARACTER_SHEETS, characterArt, characterMoves } from "./sheet-art";

const [white, , red, blue, green] = PLAYER_COLORS;

interface Info {
  name: string;
  /** A few words on who they are. */
  title: string;
  story: string;
  /** Their color in the guide, the same as in the title lineup (null: the character's own colors). */
  color: string | null;
  special: { name: string; recharge: string; text: string; tips: string[] };
}

const INFO: Record<CharacterId, Info> = {
  bomb: {
    name: "Bomba",
    title: "O mascote explosivo",
    color: MASCOT_COLOR,
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
  ninja: {
    name: "Ninja",
    title: "O guerreiro do gelo",
    color: blue,
    story:
      "Treinado num templo escondido nas montanhas geladas, aprendeu a esfriar o ar com as mãos antes de aprender a andar. Fala pouco, observa muito e ataca uma vez só. Entrou na arena para provar que paciência e sangue frio vencem qualquer explosão.",
    special: {
      name: "Raio de gelo",
      recharge: "20 s",
      text: "Lança gelo 4 casas em linha reta à frente. O primeiro jogador atingido fica congelado por 5 s: não anda nem solta bombas, mas o fogo ainda pega.",
      tips: [
        "Congele e solte uma bomba do lado: congelado não foge.",
        "Fique na mesma linha do rival, a até 4 casas, antes de apertar.",
        "Cuidado com o Capitão: o escudo devolve o gelo para você.",
        "Use para segurar quem está fugindo pela linha de fogo de uma bomba.",
      ],
    },
  },
  captain: {
    name: "Capitão América",
    title: "O sentinela da liberdade",
    color: white,
    story:
      "Um soldado que nunca desiste e um escudo que nunca quebra. Chegou à arena para proteger os novatos e acabou descobrindo que o escudo dele faz algo ainda melhor: devolve tudo o que mandam nele. Ele não começa a briga, mas termina.",
    special: {
      name: "Escudo",
      recharge: "20 s",
      text: "Ergue o escudo por 3 s, parado e virado para a frente. Fogo e gelo que vêm na direção do escudo param nele e voltam: o fogo de uma bomba à frente vai duas vezes mais longe do outro lado, e raios voltam em quem atirou.",
      tips: [
        "Vire para o perigo antes de apertar: com o escudo erguido você não gira.",
        "Só protege a frente: fogo pelos lados ou pelas costas ainda te pega.",
        "Devolve o gelo do Ninja, o raio do Thor e o Kamehameha do Goku em quem mandou.",
        "O Naruto que bater no escudo fica tonto em vez de você.",
      ],
    },
  },
  thor: {
    name: "Thor",
    title: "O deus do trovão",
    color: blue,
    story:
      "Veio de Asgard atrás de uma boa briga e achou a arena perfeita: barulho, fogo e adversários que não fogem. O martelo chama raios do céu, e ele não perde a chance de mostrar isso. Barulhento, confiante e sempre o primeiro a rir da própria vitória.",
    special: {
      name: "Raio do trovão",
      recharge: "20 s",
      text: "Ergue o martelo e solta um raio 5 casas em linha reta à frente. O primeiro jogador atingido fica tonto por 3 s, sem andar nem agir.",
      tips: [
        "É o alcance mais longo dos poderes que prendem: acerte de longe e chegue com a bomba.",
        "Tonto por 3 s dá tempo de soltar uma bomba e sair do caminho.",
        "Atire pelos corredores abertos: blocos, bombas e paredes param o raio.",
        "O escudo do Capitão manda o raio de volta: não atire nele de frente.",
      ],
    },
  },
  goku: {
    name: "Goku",
    title: "O saiyajin que só quer lutar",
    color: green,
    story:
      "Ouviu falar de um torneio onde todo mundo explode tudo e veio correndo, com fome e sorrindo. Treinou a vida inteira para ficar mais forte e enxerga cada rival como um novo desafio. Na arena, junta o ki nas mãos e deixa o Kamehameha falar por ele.",
    special: {
      name: "Kamehameha",
      recharge: "30 s",
      text: "Carrega o ki por um instante, parado (ficar tonto ou congelado cancela), e dispara um raio 5 casas à frente que quebra os blocos no caminho. O primeiro jogador atingido fica tonto por 3 s, sem andar nem agir. Paredes param o raio.",
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
    color: white,
    story:
      "O ninja mais barulhento da Vila da Folha quer ser reconhecido por todo mundo, e a arena é o palco perfeito. Erra, cai, levanta e tenta de novo, sempre gritando que vai ganhar. Quando corre com o Rasengan na mão, ninguém fica no caminho.",
    special: {
      name: "Rasengan",
      recharge: "20 s",
      text: "Avança 3 casas em linha reta com a esfera de chakra. O primeiro jogador que ele acertar é arremessado até 2 casas e fica tonto por 3 s. Um bloco no caminho quebra e para a corrida; paredes e bombas também param.",
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
    color: red,
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
    color: blue,
    story:
      "Saiu da floresta atrás de um bom desafio e descobriu que a arena é cheia de rivais para chocar. Pequeno, rápido e teimoso, guarda eletricidade nas bochechas vermelhas e solta tudo de uma vez quando alguém chega perto demais. O lenço azul foi presente de um velho treinador, e ele não tira por nada.",
    special: {
      name: "Choque do Trovão",
      recharge: "20 s",
      text: "Solta uma descarga em volta de si: todo jogador até 2 casas de distância, para cima, para baixo e para os lados, fica tonto por 3 s. Blocos, bombas e paredes param o choque.",
      tips: [
        "Pega todo mundo ao redor de uma vez: ótimo quando te cercam.",
        "Não atravessa blocos: use nos corredores abertos.",
        "Tonto por 3 s dá tempo de soltar uma bomba do lado e sair.",
        "O escudo do Capitão virado para você devolve o choque: quem fica tonto é você.",
      ],
    },
  },
  static: {
    name: "Super Choque",
    title: "O herói elétrico de Dakota",
    color: blue,
    story:
      "Virgil era só um garoto de Dakota até respirar o gás do Big Bang e sair de lá cheio de eletricidade. Agora controla o magnetismo, voa numa tampa de bueiro e não perde uma piada nem no meio da briga. Descobriu que a arena é o melhor treino que existe: tem metal, faísca e rival para todo lado.",
    special: {
      name: "Puxão Magnético",
      recharge: "20 s",
      text: "Lança um campo magnético em linha reta: o primeiro jogador até 5 casas à frente é arrastado até a casa colada nele e fica tonto por 3 s. Blocos, bombas e paredes param o campo.",
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
    color: red,
    story:
      "Barry Allen era um perito criminal que vivia chegando atrasado, até um raio cair no laboratório dele numa noite de tempestade. Acordou ligado à Força de Aceleração e nunca mais se atrasou para nada. Na arena ele chega antes da bomba explodir, antes do rival perceber e às vezes antes até da partida começar.",
    special: {
      name: "Supervelocidade",
      recharge: "20 s",
      text: "Dispara num piscar até 5 casas em linha reta, atravessando quem estiver no caminho: todo jogador que ele passa fica tonto por 3 s. Para antes de blocos, bombas e paredes, e nunca termina em cima de alguém.",
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
    color: blue,
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
    color: green,
    story:
      "John Stewart era arquiteto e fuzileiro naval quando os Guardiões de Oa o escolheram para usar o anel: alguém sem medo e com uma vontade de ferro. Tudo o que ele imagina vira energia verde, e como bom arquiteto ele constrói com cuidado. Na arena, quando a bomba explode bem embaixo dele, ele só fecha a bolha e espera o fogo passar.",
    special: {
      name: "Bolha protetora",
      recharge: "25 s",
      text: "Ergue em volta de si uma bolha de energia verde por 3 s: fogo vindo de qualquer lado não entra, nem o da bomba embaixo dele. Dentro dela ele anda na metade da velocidade. A bolha não segura gelo, raio, teia nem os outros especiais.",
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
    color: null,
    story:
      "O cérebro das Tartarugas Ninja: mora no esgoto de Nova York, conserta tudo o que quebra no esconderijo e inventa o que ainda não existe. Enquanto os irmãos usam espadas e nunchakus, ele confia no bo, um bastão comprido que mantém qualquer um à distância. Na arena, fez as contas: bomba que chega perto dele volta para quem mandou.",
    special: {
      name: "Giro do bastão",
      recharge: "20 s",
      text: "Gira o bo em volta de si: atordoa por 3 s quem estiver colado nele (nas 4 casas vizinhas ou na mesma casa) e rebate cada bomba vizinha 3 casas para longe, na direção em que foi batida, como um soco. O escudo do Capitão virado para ele segura aquele lado e quem fica tonto é ele.",
      tips: [
        "Bomba encostada em você? Gire e mande ela de volta para o rival.",
        "Rival colado: gire, ele fica tonto, e solte a bomba do lado dele.",
        "Rebate as bombas dos 4 lados de uma vez: ótimo quando te cercam.",
        "Bomba rebatida não explode no ar: ela cai e aí o pavio volta a correr.",
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
  show(character: CharacterId, stage: HTMLElement): void;
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
  const cards: HTMLButtonElement[] = [];
  let current = 0;

  const select = (i: number) => {
    current = i;
    const c = CHARACTER_GUIDE[i]!;
    cards.forEach((card, j) => card.classList.toggle("on", i === j));
    head.replaceChildren(
      el("div", { class: "chars-portrait" }, [characterArt(c.id, c.color, "walk")]),
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
    moves.replaceChildren(
      ...characterMoves(CHARACTER_SHEETS[c.id]).map((m) =>
        el("figure", { class: "chars-move" }, [characterArt(c.id, c.color, m), el("figcaption", { text: m.label })]),
      ),
    );
    hooks.show(c.id, stage);
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
  const detail = el("div", { class: "guide-detail" }, [
    head,
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
    el("div", { class: "guide-body" }, [list, detail]),
    backButton("Voltar", hooks.close, "primary"),
  ]);
  return { root, open: () => select(current) };
}
