# Auditoria de itens, arenas e mecânicas — Bombtop × Super Bomberman 4

Data: 25/10/2026. Escopo principal: **Battle Game** de *Super Bomberman 4* (SNES, versão japonesa) comparado ao estado local do Bombtop. Este documento registra a auditoria inicial e os incrementos de implementação e validação; **não considera diferenças ainda não testadas como bugs confirmados**.

**Atualização de implementação:** Push, defesa contra Push e parada de bomba chutada pelo próprio jogador estão implementados no Bombtop com testes determinísticos e controles de teclado, gamepad e toque. Os tempos, prioridades e colisões ainda precisam de comparação direta com a ROM. O catálogo comunitário de 12 estágios está codificado em `packages/shared/src/sb4-stage-definitions.ts`, mas apenas os três layouts autorais `classic`, `conveyor` e `warp` são jogáveis; Tag, Champion, Maniac e demais mapas originais seguem pendentes.

## Fontes e níveis de certeza

- **B — executado no Bombtop:** código de `packages/shared/src`, testes Vitest, varredura de seeds descrita abaixo. A varredura não prova fidelidade ao SNES; prova apenas propriedades da implementação local.
- **O — observado por jogadores no original:** tabela japonesa de itens por arena de Battle Mode: <https://game.bad-person.net/gamenote/superbom4/superbom4_item_battle.html>. Configuração declarada pelo autor: cinco humanos, COM normal, BATTLE 3, tempo infinito e demais opções desligadas. Ovos não foram coletados nem queimados durante a contagem; o autor admite novos ovos após coleta/perda/queima.
- **M — descrição de itens do original:** <https://game.bad-person.net/gamenote/superbom4/superbom4_item.html>. Essa página se refere ao **Story Mode**; efeitos e limites citados nela devem ser reconfirmados em Battle Mode antes de mudar números da simulação.
- **R — referência contextual:** <https://bomberman.fandom.com/wiki/Super_Bomberman_4>, incluindo nomes dos 12 estágios, modalidades e variações. Wikis não substituem ROM/manual.
- **C — controles e poderes relatados:** <https://tadabomland.sakura.ne.jp/soft_sf4.html>. Informa A = bomba/luva, B = detonação remota e resistência a Push, X = parar bomba chutada, Y = Punch/Push/habilidade da montaria. Esses comandos exigem comprovação prática na ROM japonesa antes de virar especificação final.
- **J — manual japonês da Hudson:** <https://device.report/m/e7abfbb7124a6b665cb95cfbc97fefda226528c86e76322afdc191c15fb6818c.pdf>, páginas impressas 18–21. Confirma opções TIME 1/2/3/5/∞, BATTLE 1–5 vitórias, Sudden Death ON/OFF e início da pressão no Champion quando resta 1 minuto. Não fornece, no trecho examinado, ordem exata de eventos no tick final nem alcance preciso do fechamento com Sudden Death OFF.
- **T — armadilhas, modos, maldições e montarias:** <https://game.bad-person.net/gamenote/superbom4/superbom4_battlemode.html>, <https://game.bad-person.net/gamenote/superbom4/superbom4_skull.html>, <https://game.bad-person.net/gamenote/superbom4/enemy/superbom4_egglist.html> e páginas individuais `battle/superbom4_battleN.html`. São observações de terceiros; configuração e versão importam.
- **ROM — evidência estática limitada:** relatório preexistente `D:\Programação\rea\build\snes-verification\report.json`: ROM HiROM de 2 MiB, hash `bdd90b49bf08d0d0a80e4b4ec811084d470355c648c49a28a0e838cbf1ea8f92`, 36 segmentos e 357 procedimentos localizados por Ghidra 65816. **Não foram identificadas, nesta auditoria, as rotinas específicas responsáveis pelos inventários e regras de batalha.** Não atribuir a elas os números das fontes O/M.

## 1. Varredura automatizada de geração no Bombtop (B)

Método: **256 seeds consecutivas (`0..255`) para cada arena e densidade**, cinco jogadores, `createMatch`; duas gerações por seed comparadas. Densidades: 0, 0,3, padrão 0,75 e 1. Validado se cada item fica debaixo de um bloco, não se repete a coordenada, se o total não supera os blocos, se Picanha não nasce escondida e se a geração é reproduzível. O teste permanente `packages/shared/test/item-map-audit.test.ts` cobre 128 seeds/densidade/arena, todas as habilidades obtidas por coleta e variações do número de jogadores.

| Arena Bombtop | Densidade | Blocos (média) | Itens (média) | Itens mínimo–máximo | Política de itens |
| --- | ---: | ---: | ---: | ---: | --- |
| `classic` | 0 | 0 | 0 | 0–0 | Sem blocos, sem itens |
| `classic` | 0,3 | 29,09 | 26,83 | 17–28 | Saco fixo truncado se faltarem blocos |
| `classic` | **0,75** | **72,04** | **28,00** | **28–28** | Saco fixo de 28 itens, incluindo 2 Push |
| `classic` | 1 | 96 | 28,00 | 28–28 | Saco fixo de 28 itens, incluindo 2 Push |
| `conveyor` | 0 | 0 | 0 | 0–0 | Sem blocos, sem itens |
| `conveyor` | 0,3 | 21,21 | 10,87 | 3–22 | Chance de 50% por bloco + pesos globais |
| `conveyor` | **0,75** | **52,36** | **26,37** | **16–38** | Chance de 50% por bloco + pesos globais |
| `conveyor` | 1 | 70 | 35,29 | 21–46 | Chance de 50% por bloco + pesos globais |
| `warp` | 0 | 0 | 0 | 0–0 | Sem blocos, sem itens |
| `warp` | 0,3 | 27,88 | 14,26 | 4–25 | Chance de 50% por bloco + pesos globais |
| `warp` | **0,75** | **69,04** | **34,78** | **22–45** | Chance de 50% por bloco + pesos globais |
| `warp` | 1 | 92 | 46,30 | 31–59 | Chance de 50% por bloco + pesos globais |

**Resultado da amostragem:** zero divergências entre duas gerações da mesma seed, zero coordenadas duplicadas, zero itens ocultos fora de blocos e zero arenas com mais itens que blocos nas 3.072 gerações inspecionadas. A varredura é determinística, não uma prova estatística de paridade com o original.

### Itens encontrados por arena na densidade padrão (média por partida)

| Item | `classic` | `conveyor` | `warp` |
| --- | ---: | ---: | ---: |
| Bomba adicional | 8,00 | 6,64 | 8,67 |
| Fogo | 5,00 | 6,77 | 8,90 |
| Fogo máximo | 0,00 | 0,55 | 0,75 |
| Velocidade | 3,00 | 2,21 | 2,95 |
| Ovo | 2,00 | 2,30 | 3,00 |
| Luva | 2,00 | 1,14 | 1,57 |
| Soco | 2,00 | 1,17 | 1,50 |
| Empurrão/Push | 2,00 | 1,07 | 1,46 |
| Chute | 3,00 | 1,18 | 1,59 |
| Caveira | 1,00 | 1,13 | 1,54 |
| Controle remoto | 0,00 | 1,10 | 1,41 |
| Bomba perfurante | 0,00 | 1,11 | 1,45 |
| Picanha (exclusiva de personagem) | 0,00 | 0,00 | 0,00 |
| Honey (original) | 0,00 | 0,00 | 0,00 |

As médias foram recalculadas com 256 seeds por arena após incluir Push; **não são quantidades garantidas por partida** nas arenas aleatórias. O resultado de `classic` é exato quando há pelo menos 28 blocos. Em `warp`, a média de ovos **3,00** já ultrapassa os dois ovos iniciais relatados em muitos mapas do original, indício claro de que a geração não está reproduzindo as tabelas por fase.

**Diagnóstico estrutural:** `arena.ts` monta a arena **15×13**, com pilares fixos, posições de entrada protegidas e blocos de densidade variável. `stage.ts` só oferece `classic`, `conveyor` (duas fileiras de esteiras) e `warp` (quatro portais emparelhados); `room/session.ts` alterna automaticamente os três IDs. O catálogo `sb4-stage-definitions.ts` registra inventários comunitários das fases 1–12, sem integrá-los às partidas exceto pelo estágio 1. Ainda faltam os layouts e a seleção de grupos/variantes. Os nomes `conveyor` e `warp` **não demonstram** correspondência 1:1 a qualquer fase do SNES.

## 2. Itens por estágio no original (O; Battle Game)

Abreviações: **B** bombas adicionais, **F** fogo, **FF** fogo máximo, **V** velocidade, **O** ovos, **L** luva, **S** soco/punch, **P** empurrão/push, **K** chute, **C** caveira, **H** Honey. Valores são quantidades relatadas na fonte O nas opções acima, **não dados extraídos da ROM**.

| Fase original e tema | B | F | FF | V | O | L | S | P | K | C | H | Total conhecido |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 · Usual (clássica) | 8 | 5 | 0 | 3 | 2 | 2 | 2 | 2 | 3 | 1 | 0 | **28** |
| 2 · Fast 'n Slow | 10 | 6 | 0 | 2 | 2 | 3 | 0 | 2 | 3 | 1 | 0 | **29** |
| 3 · Rolling Sugedama | 10 | 5 | 1 | 5 | 2 | 2 | 2 | 3 | 2 | 1 | 0 | **33** |
| 4 · Push and Fall | 6 | 5 | 0 | 3 | 0 | 3 | 2 | 5 | 2 | 0 | 0 | **26** |
| 5 · Numb Bomb | — | — | — | — | — | — | — | — | — | — | — | Sem valores na fonte |
| 6 · Surprise Floor | 10 | 6 | 1 | 3 | 2 | 2 | 2 | 2 | 3 | 1 | 0 | **32** |
| 7 · Hide and Blow Seek | 10 | 6 | 1 | 4 | 2 | 0 | 1 | 3 | 5 | 1 | 0 | **33** |
| 8 · Spinny Slots | — | — | — | — | — | — | — | — | — | — | — | Depende da roleta |
| 9 · Seesaw | 10 | 6 | 0 | 3 | 0 | 3 | 3 | 3 | 3 | 1 | 0 | **32** |
| 10 · Costume/Cosplay | 10 | 6 | 0 | 5 | 0 | 0 | 0 | 0 | 3 | 1 | 8 | **33** |
| 11 · Trolley | 10 | 6 | 0 | 3 | 2 | 3 | 2 | 3 | 3 | 1 | 0 | **33** |
| 12 · Flag Tag | 10 | 7 | 0 | 6 | 0 | 0 | 0 | 0 | 3 | 1 | 0 | **27** |

**Condições de leitura:** o traço da fase 5 é ausência de contagem na fonte, não prova de que todo mecanismo de item foi eliminado. A fase 8 usa uma roleta: não inventar inventário fixo. A tabela também **não lista controle remoto, bomba perfurante ou Picanha em nenhum desses 12 inventários de Battle Mode**. Isso não significa que tais habilidades não existam em outros modos/opções.

## 3. Inventário atual e divergências por tipo

| Item Bombtop | `classic` atual | `conveyor` / `warp` atual | Efeito local verificado | Comparação ao original |
| --- | --- | --- | --- | --- |
| `bomb` | **8** | Sorteio ponderado | +1 capacidade até 8 | Coincide no estágio 1 (O/M); outros mapas não usam contagens da fonte O |
| `fire` | **5** | Sorteio ponderado | +1 alcance até **8** | O estágio 1 coincide na quantidade; a fonte M descreve máximo de **9 casas** (Story), diferença que exige medição em Battle |
| `speed` | **3** | Sorteio ponderado | +4 unidades/tick até 32 | O estágio 1 coincide na quantidade; velocidade real SNES ainda não medida |
| `egg` | **2** | Sorteio ponderado | Ganha uma de três montarias locais | O estágio 1 coincide no início; original admite possível reposição após perda/queima (O) |
| `glove` | **2** | Sorteio ponderado | Levantar/carregar/arremessar bomba | Coincide na quantidade da fase 1; tempo e trajetória exatos pendentes |
| `punch` | **2** | Sorteio ponderado | Lança bomba à frente | Coincide no estágio 1, mas Punch não substitui Push |
| **`push`** | **2** | Sorteio ponderado | Avança 1 casa e tenta deslocar um rival 3 casas; defesa manual independente | Disponível no Bombtop; colisão, tempo e prioridade ainda não medidos na ROM |
| `kick` | **3** | Sorteio ponderado | Desliza bomba ao contato e permite interromper a própria bomba em movimento | Coincide na quantidade da fase 1; condições exatas de parada e temporização original a investigar |
| `skull` | **1** | Sorteio ponderado | Maldição aleatória, transmissível, curável | Coincide na quantidade da fase 1; cada doença original ainda requer teste comparativo |
| `fullFire` | 0 | Sorteio ponderado | Alcance máximo imediato | A fonte O só registra nas fases **3, 6 e 7**; sorteio global não replica essa seletividade |
| `remote` | 0 | Sorteio ponderado | Explosão acionada pelo jogador | Não listado nos inventários O de Battle; existe na fonte M de Story |
| `pierce` | 0 | Sorteio ponderado | Explosão atravessa blocos | Não listado nos inventários O de Battle; existe na fonte M de Story |
| `picanha` | 0 | 0 | Armadilha exclusiva do personagem Lula | Conteúdo autoral do Bombtop; não pertence ao original |
| **Honey** | **Ausente** | **Ausente** | Sem tipo/costume equivalente | A fase 10 contém 8 unidades (O); efeito de aparência e proteção indicado em M |

O conjunto de **28** itens escondidos da `classic` cobre as quantidades relatadas para a fase 1 original, **incluindo os dois Push**. Para `conveyor` e `warp`, a média pode crescer com a densidade e os tipos possíveis incluem fogo máximo, remoto, Push e perfurante. Isso é comportamento válido no design atual do Bombtop, **mas não uma reprodução dos sacos fixos por fase listados em O**.

**Catálogo configurável do Maniac (T):** os quinze tipos relatados são Bomba, Fogo, Fogo máximo, Velocidade, Ovo, Luva, Soco, Push, Chute, **Bomb Pass**, **Block Pass**, Perfurante, **Fire Suit**, **Heart** e Caveira. O Bombtop implementa onze desses tipos diretamente, mas não tem os quatro destacados (**Bomb Pass, Block Pass, Fire Suit e Heart**) como itens independentes. A possibilidade de andar através de bombas/blocos, proteção temporária do Fire Suit e resistência extra do Heart **não é substituída** pelo poder de personagens convidados ou pela absorção de dano das montarias. `Remote` e `Picanha` existentes no Bombtop não fazem parte desses quinze itens.

## 4. Estado das mecânicas relacionadas ao inventário

| Sistema | O que existe no Bombtop (B) | O que falta comprovar/alinhar no original | Onde conferir |
| --- | --- | --- | --- |
| Grade, blocos e spawns | 15×13, 5 pontos possíveis, pilares, densidade opcional, tiles seguros ao redor dos spawns | Layout exato, tipos de obstáculos, posições e quatro variantes dos mapas originais | `arena.ts`, `stage.ts`, `test/arena.test.ts`, `test/stages.test.ts` |
| Itens escondidos/revelados | Todos os itens iniciais ficam sob bloco; bloco destruído revela o conteúdo após o fogo; item exposto pode ser queimado | Sequência de destruição/efeitos e políticas por mapa | `items.ts`, `bombs.ts`, `test/items.test.ts`, `test/bombs.test.ts` |
| Caps e troca de poderes | Bomba até 8; fogo até 8; cinco patamares de velocidade (inicial + quatro incrementos); Remote e Pierce se substituem | A fonte M descreve fogo até 9 casas e velocidade em até 5 níveis, mas é sobre Story Mode | `constants.ts`, `items.ts`, `test/items.test.ts` |
| Chute | Atingir bomba faz deslizar até obstáculo, outra bomba ou jogador; o botão PARAR interrompe bombas do próprio jogador, e o cliente prevê e suaviza movimento | Testar na ROM trava com X mantido, bombas de outros donos, velocidade, mudanças de direção e caso de bomba encadeada | `kick.ts`, `step.ts`, `test/kick-stop.test.ts`, `apps/client/src/net/kick-prediction.ts` |
| Controle das ações | `bomb` planta/carrega; `action` prioriza remoto, Punch/Push e montaria; `brace` defende e `stopKick` freia chute; `special` é poder do personagem | B, X e Y do controle SNES precisam de comparação contra combinações simultâneas, prioridades e duração dos comandos no emulador | `state.ts`, `step.ts`, `input/*`, `test/push.test.ts`, `test/kick-stop.test.ts` |
| Soco e luva | Soco lança bomba; luva permite carregar/arremessar; pavio pausa no ar/mãos | Distância, salto de borda, comandos e prioridade quando combinado com Push | `air.ts`, `test/punch.test.ts`, `test/glove.test.ts` |
| Bombas remotas/perfurantes | Acionamento manual, cadeia de explosões e fogo perfurante implementados | Disponibilidade no **Battle Mode** original (ausentes da tabela O) e comportamentos precisos após morte | `bombs.ts`, `test/remote.test.ts`, `test/pierce.test.ts` |
| Caveira | Uma entre seis maldições locais; passa por toque e outro item **inclusive ovo** cura | T relata **11** doenças, incluindo perda periódica de itens, invisibilidade, movimento obrigatório e pavios curtos/longos. Segundo T, **pegar ovo não cura** a maldição no SB4 | `curse.ts`, `items.ts`, `test/skull.test.ts` |
| Ovos/montarias | Três montarias (`hopper`, `dasher`, `pusher`); absorção de um dano e habilidade de ação | T documenta **7** montarias normalmente disponíveis em Battle e **mais 6** habilitadas pelo código 0164, com poderes biológicos e mecânicos distintos | `mount.ts`, `test/mount.test.ts`, `state.ts` |
| Itens ao morrer | O jogador deixa melhorias em posições livres e volta a atributos básicos | Política exata de drop no Battle Mode original e efeito sobre a contagem de itens | `items.ts`, `test/drop.test.ts` |
| Temporização e dano | 60 ticks/s; pavio normal de **180 ticks (3 s)**, fogo por 30 ticks; invulnerabilidade temporária após perda de montaria | T relata pavio normal de aproximadamente **2 s**, e doenças que o encurtam a ~1 s ou alongam a ~4 s. **Desvio provável importante; confirmar em frames** | `constants.ts`, `bombs.ts`, `pressure.ts`, `test/bombs.test.ts` |

### Modos, opções e personagens de Battle Mode

A fonte T documenta `COM LEVEL` fraco/normal/forte, condição de vitória de **1–5 vitórias**, tempo de **1, 2, 3, 5 minutos ou infinito**, Sudden Death, Bad Bomber e Dash Bomber com opções ON/OFF. Registra **10 estágios normalmente disponíveis**, passando a **12** por desbloqueio. Senhas de grupos mudam **layout**, não provam arenas totalmente novas.

| Função do original (T/R) | Bombtop no código atual | Lacuna ou cautela |
| --- | --- | --- |
| Battle Royale — Single | Livre para todos com até cinco participantes, bots e regras de vitórias/tempo configuráveis | Times e outros comportamentos oficiais de Battle ainda precisam de validação comparativa |
| Battle Royale — Tag | Não há equipes/vitória por grupo no protocolo de sessão | Introduzir times e alvos aliados, pontuação, reassociação e interface; T informa Dash Bomber desligado em Tag |
| Champion | Não existe sequência oficial de cinco chefes, fixada na fase 5 | T descreve cinco confrontos, **3 vitórias, 3 minutos, Bad Bomber ON e Sudden Death/Dash Bomber OFF** |
| Maniac | Não há escolha de inventário nem HP inicial individual | T descreve até **60 itens**, máximo de **9 por tipo**, catálogo de **15 tipos**, HP **1–5**, fase 1 fixa, Single e 3 minutos |
| TIME / BATTLE | O anfitrião seleciona TIME 1/2/3/5/∞ e BATTLE 1–5 vitórias; empate por prazo e placar compartilhado estão implementados | Início exato da pressão para todos os tempos e prioridade de morte no último tick ainda não têm trace ROM |
| Sudden Death | ON fecha a arena inteira; OFF limita as quedas ao anel exterior e espera pelo fim do prazo, em simulação e rede | A fonte secundária relata fechamento parcial no OFF, mas não comprova quantos blocos caem; limite escolhido é provisório |
| Bad Bomber | `revenge` existe na simulação, mas começa desativado por padrão | Confirmar habilitação no lobby, movimentos, cartuchos e vitória com participantes mortos |
| Dash Bomber | Ausente como modo/ação de batalha | T lista prêmios inclusive **Geta e Heart**, fora dos inventários fixos dos mapas padrão |
| Quatro Reis + Great Bomber | O Bombtop possui personagens e especiais autorais distintos | Não alegar equivalência; original usa habilidades e penalidades dos reis, alteráveis por senha |
| Grupos de layouts e arenas ocultas | O anfitrião pode configurar a sequência dos três layouts autorais já jogáveis | Seleção original 10→12, grupos alternativos, armadilhas e layouts oficiais ainda precisam ser implementados |

Referências de controles e modos: <https://tadabomland.sakura.ne.jp/soft_sf4.html> e <https://game.bad-person.net/gamenote/superbom4/superbom4_battlemode.html>. Há **divergência nas tabelas comunitárias sobre qual senha 4622/0520/0903 corresponde a cada grupo**; só associar senha→layout após execução controlada. A ROM alterada por hacks não serve como baseline dessa verificação.

**Importante sobre inventário de Battle versus Story:** a fonte M também descreve **Geta (reduzir velocidade), Bomb Pass, Block Pass, Timer, Fire Suit, Heart, 1UP, item secreto e alimentos de pontuação**. Eles **não constam das tabelas iniciais de arena do Battle Game em O**. Isso **não os torna todos exclusivos do Story**: T lista Bomb Pass, Block Pass, Fire Suit e Heart entre os 15 itens configuráveis no **Maniac**, além de Geta e Heart como possíveis prêmios do **Dash Bomber**. Não inseri-los cegamente no saque padrão. `Picanha` e poderes dos personagens convidados são conteúdo próprio do Bombtop.

## 5. Inventário de mapas e riscos de equivalência

| Estágio original | Estado no Bombtop | Trabalho de comparação antes de implementar |
| --- | --- | --- |
| 1 · Usual | `classic` reproduz as 28 contagens conhecidas, incluindo Push, mas ainda falta o layout exato | Registrar desenho dos blocos, posição real dos itens, temporização do Push e número de ovos ativos |
| 2 · Fast 'n Slow | Existe `conveyor`, mas não reproduz a regra descrita na página original | T descreve **fluxo do tempo que muda aleatoriamente**, não simples esteira. Medir relógio, física, variações e eventos |
| 3 · Rolling Sugedama | Sem mapa equivalente comprovado | Identificar bolas móveis, colisões, danos, spawns e layout |
| 4 · Push and Fall | Sem mapa equivalente | Confirmar abismos, regras de queda/empurrão e sequência dos itens Push |
| 5 · Numb Bomb | Sem mapa equivalente | Investigar paredes eletrificadas e **poder inicial elevado** descritos em T; fonte O não fornece contagens |
| 6 · Surprise Floor | Sem mapa equivalente comprovado | Registrar eventos/traps dos pisos sem supor que sejam os portais de `warp` |
| 7 · Hide and Blow Seek | Sem mapa equivalente | T menciona trepadeiras e pisos direcionais; confirmar obstáculos e armadilhas reais, sem presumir bombas ocultas pelo nome |
| 8 · Spinny Slots | Sem mapa equivalente | Medir seleção/roleta e inventário variável por rodada |
| 9 · Seesaw | Sem mapa equivalente | Observar plataformas e física/armadilhas |
| 10 · Costume/Cosplay | Sem mapa equivalente | Reproduzir Honey e a transformação de aparência/proteção |
| 11 · Trolley | Sem mapa equivalente | Investigar percurso, interação e colisões com carrinhos |
| 12 · Flag Tag | Sem mapa equivalente | T relata eliminação pela destruição da bandeira do dono e possibilidade de carregá-la; validar bandeiras, objetivos e reset |

Os nomes dos estágios acima vêm das fontes O/R. As mecânicas não verificadas em ROM/vídeo aparecem como **trabalho de investigação**, não como especificação já comprovada. O `warp` do Bombtop é uma arena autoral útil, mas nenhuma fonte consultada estabeleceu a qual dos 12 mapas ela corresponde.

## 6. Backlog de paridade (com status de integração parcial)

| ID / prioridade | Implementação planejada | Critério de aceite e regressão | Dependência |
| --- | --- | --- | --- |
| **P0-01** | Criar catálogo de `BattleStageDefinition` separado do `StageId` autoral, com metadados de mapa, seleção de grupo/variante e um inventário **por estágio original** | `createMatch` aceita o preset original por ID, gera saco exato para fases 1–4, 6–7, 9–12 sob densidade suficiente; fases 5 e 8 possuem políticas próprias documentadas. Seeds repetidas geram mesma grade/itens, sem duplicatas nem spawns bloqueados | Confirmar dados O em ROM/emulador; manter modo Bombtop atual compatível |
| **P0-02** | Introduzir `Push` de jogadores como poder separado de `Punch` de bombas, no inventário e na rede/UI | Testar empurrão, canto, parede, outro jogador, invulnerabilidade, colisão com bomba e combinação dos dois poderes; fase 1 contém 2 Push | Confirmar comando e prioridade de ação no manual/ROM |
| **P0-03** | Definir explicitamente **preset clássico SB4** versus **preset criativo Bombtop**, sem apagar `remote`, `pierce`, personagens ou especiais próprios | Preset SB4 não sorteia poderes ausentes do mapa original; preset autoral preserva o jogo atual. Host, snapshots, replay, IA e cliente concordam no mesmo preset | P0-01; alteração compatível do protocolo |
| **P0-04** | Separar comando **X: frear chute** e **B: resistir a Push** da ação Y (Punch/Push/montaria) e do comando A de bomba/luva | Casos com botões simultâneos, teclado, gamepad, toque, input em rede, explosão remota e habilidade equipada; um evento por pressão | Comparação C × ROM e P0-02 |
| **P0-05** | Implementar inventário de **11 doenças do Skull** e exceções de cura, mantendo opção de regra autoral | Um teste por doença, transmissão, cura por item comum versus **ovo**, tempo de pavio, perda de itens, desaparecimento e automovimento | Registros T e capturas ROM que confirmem disponibilidade normal |
| **P1-01** | Reproduzir mapas **1–4** com paredes, blocos e armadilhas reais; não reaproveitar `conveyor`/`warp` sem comparação | Para cada mapa: fixture de tiles/floors/spawns; golden visual emoludor × PWA, seed determinística, bots atravessam hazards corretamente | Catálogo e capturas controladas da ROM |
| **P1-02** | Reproduzir mapas **5–12** e suas regras próprias, incluindo 8 (roleta) e 10 (Honey) | Um teste por trap, inventário variável quando necessário, objetivo/vitória e reset corretos; sem inventar itens da fase 5 | P0-01/02, pesquisa ROM por fase |
| **P1-03** | Reproduzir ciclo dos ovos, limite de montarias em campo e catálogo de montarias do SNES | Conferir limite e reposição em 1/2/3+ jogadores; testes de coleta, perda, queima, nova aparição, dano e habilidades | Capturas e experimentos de Battle Mode com eggs |
| **P1-04** | Adicionar seletores e opções originais: arena/grupo de variantes, Battle Royale Single/Tag, Championship, Maniac, Sudden Death, Bad Bomber e Dash Bomber | Testes de times e vitórias, BATTLE 1–5, TIME 1/2/3/5/∞, Maniac 60 itens/9 por tipo/HP 1–5, Champion 5 confrontos na fase 5, estado de lobby e protocolo em multiplayer | Documentar e testar regras reais de cada modo antes de lançar |
| **P1-05** | Medir e corrigir apenas divergências **comprovadas** de fogo, velocidade, pavio, soco, luva, chute e maldições | Reproduzir passos, colisões e frames na ROM com cenário idêntico; snapshots determinísticos e benchmark aprovados; não ajustar cap de fogo com base apenas no Story Mode | Registro de inputs/frame da ROM + fixture de simulação |
| **P1-06** | Implementar as montarias biológicas/mecânicas do SB4 no preset de paridade (7 padrão e 6 opcionais) | Cada montaria com poder, dano, movimento, sprite e colisões testados; o código secreto 0164 fica separado do comportamento padrão | P1-03, T, artes e evidência das habilidades |
| **P1-07** | Fechar o catálogo configurável de 15 itens do Maniac: adicionar **Bomb Pass, Block Pass, Fire Suit e Heart**, além de Push (P0-02) | Testes de atravessar bomba/bloco sem atravessar parede, conflito Bomb Pass × Kick, proteção temporária, absorção de dano e geração limitada por tipo | P1-04, confirmação de efeitos M em Battle Mode |
| **P2-01** | Integrar apresentação visual das montarias, itens Push/Honey e armadilhas sem perder clareza ou desempenho | Arte por direção, som, efeitos, acessibilidade e testes com `?lite` e mobile; sem flashes inconsistentes | Regras de jogo aprovadas em P0/P1 |
| **P2-02** | Ampliar cobertura de navegação dos bots em esteiras, portais e armadilhas das fases novas | Bots não escolhem fugas inviáveis; seeds fixas, replays e p99 de tick sem regressão | Mapas implementados e pathfinding com transições especiais |
| **P3-01** | Avaliar um Story Mode separado, se virar requisito | Tabela independente de itens e fases: Geta, Bomb/Block Pass, Timer, Suit, Heart, 1UP, segredos, comidas, inimigos e checkpoints | Decisão de produto; **não** misturar itens de história no modo de batalha |

### Portões de implementação e validação

1. Para cada diferença, obter **duas provas distintas**: origem identificável (manual/ROM/emulador com configuração e frame) e teste Bombtop que demonstre o desvio. As fontes O/C/T são pontos de partida, **não dumps da ROM**.
2. Antes de ativar um estágio novo na rotação, especificar **inventário + mapa + gimmicks + regras de vitória + opções + animação + IA**. Não inserir apenas a decoração.
3. Cobrir seeds `0,1,20,64,72,255` e uma varredura maior, várias densidades e 2–5 jogadores. Fases com roleta e itens ressurgidos exigem invariantes específicos, não fingerprints inventadas.
4. Validar `pnpm -C packages/shared test`, `pnpm typecheck`, `pnpm -C apps/client test`, build PWA, `pnpm -C packages/shared bench`, replays determinísticos e partida de verdade comparada ao emulador. Não atualizar snapshots só para esconder falhas.

**Critério para declarar paridade:** nunca declarar que uma mecânica está idêntica ao Super Bomberman 4 apenas porque os testes do Bombtop passam; ela precisa de comparação controlada do original nas mesmas condições. Push e a parada manual foram implementados e validados no Bombtop; P0–P3 continuam abertos quanto à reprodução fiel do jogo original, especialmente mapas, modos, efeitos especiais e dados extraídos da ROM.

## 7. Resultado dos testes executados nesta auditoria

| Verificação | Resultado |
| --- | --- |
| Varredura 256 seeds × 3 arenas × 4 densidades | **3.072 gerações** verificadas sem inconsistências locais de posicionamento ou determinismo |
| `pnpm -C packages/shared exec vitest run test/item-map-audit.test.ts test/items.test.ts test/arena.test.ts test/stages.test.ts test/mount.test.ts test/drop.test.ts` | **80/80 testes passaram** em 6 arquivos, dos quais 28 pertencem à nova auditoria |
| `pnpm test` — **execução após Push, regras de Battle e rotação configurável** | **1.609/1.609 testes passaram**: `packages/shared` **633/633** (62 arquivos), `apps/client` **933/933** (103 arquivos) e `apps/server` **43/43** (7 arquivos); resultados conferidos no log do comando |
| `pnpm typecheck` | Packages shared, client e server passaram (`tsc --noEmit`) |
| `pnpm -C apps/client exec vitest run test/item-guide.test.ts test/showcase.test.ts test/online-game.test.ts` | **25/25 testes passaram** em guia, vitrine e jogo online |
| `pnpm -C apps/server test` | **42/42 testes passaram** em 7 arquivos |
| `pnpm -C apps/client build` | **Build de produção/PWA passou**, com 225 entradas no precache |

**Falha transitória resolvida durante trabalhos simultâneos:** na primeira execução global, `apps/client/test/carried-bomb.test.ts` falhou no teste `covers every carry frame in the production roster and mirrors side grips`: posição X **80** contra **79,388** esperada (diferença **0,612 px**). Os arquivos de âncora/arte e esse teste estavam **não rastreados ou modificados por outras tarefas** e não foram editados nesta auditoria. Em uma nova execução isolada do mesmo arquivo (**7/7**) e depois no `pnpm test` completo (**1.258/1.258**), a falha não se reproduziu. O resultado final está verde; o episódio foi preservado para rastreabilidade de alterações concorrentes.

**Limitação de comparação dinâmica:** o acesso ao frame do emulador SNES por esta conexão retornou erro interno durante a auditoria; não foram produzidas novas medições de frames da ROM. As regras do original neste relatório vêm das fontes O/M/R/C/T ou de evidência de importação estática anterior, sempre identificadas pelo nível de certeza.
