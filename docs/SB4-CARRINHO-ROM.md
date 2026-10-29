# Carrinho SB4: execução controlada e integração parcial

Investigação de 26/10/2026 no root `D:\Programação\Jogos\New folder\bombtop`, HEAD `01b77bb3f09f7d756c15326f46970b9bb93b7e15`, com alterações locais concorrentes preservadas.

## Fonte e preparação

ROM Japan HiROM de 2 MiB, SHA256 `bdd90b49bf08d0d0a80e4b4ec811084d470355c648c49a28a0e838cbf1ea8f92`. Execução pelo núcleo instalado do MCP SNES, em instância isolada, sem alteração dos bytes da ROM. A navegação inicial usou o servidor MCP com `load_rom({romPath})`; a instrumentação posterior instanciou a mesma classe `SNESEmulator` para observar CPU/RAM e controlar também o segundo joypad.

Desbloqueio observado: no título, 90 pulsos de X com quatro frames pressionado e quatro solto liberaram as fases 11 e 12. Pulsos de um frame e X continuamente pressionado não haviam liberado as extras nas tentativas anteriores; isso não estabelece a condição mínima do código secreto.

Partida de laboratório: dois jogadores MAN, demais OFF, tempo infinito. Estados, capturas e medições estão em `.agent/sb4-rom/`. Estado-base: `stage11-controlled-initial.json`, frame 7985. Os estados JSON são específicos do núcleo instalado, não saves universais de outros emuladores.

Para isolar embarque, o experimento escreveu **apenas a posição inicial** do jogador em WRAM `0x312=128`, `0x316=112`. A preparação está em `cart-boarding-fixture.json`; nenhuma rotina, colisão ou controle foi substituído. Portanto o experimento prova a resposta da ROM ao jogador nesse ponto, mas não documenta um percurso jogado desde o spawn. A extração das outras duas rotas também controlou a semente de 16 bits em `0xAE`; não comprova a distribuição natural das escolhas.

## Evidência específica REA e CPU

- REA confirmou leitura de controles em `C0:FBD7`; evidência `ev_d60847160592aefebafd755682051bb3f55d472e94c5462ace5795b7efefefcb`.
- O objeto do carrinho observado ocupa WRAM `0x14C0`; suas posições são `+0x12` e `+0x16`. O estado parado aponta para `C3:0385`. O trace preservado registra essa rotina executando com X=`0x14C0`, em vez de depender de uma suposição de direct page.
- Transições observadas: carrinho `C3:0385 → C3:042C → C3:045A → C3:056C → C3:0352 → C3:0385`; jogador `C2:141C → C2:2321 → C2:2342 → C2:2454 → C2:2475 → C2:2578 → C2:141C`.
- Leitura REA de `C3:0300..06FF`: `ev_1c672006f7c3097a2c84f4ecd7ffdbc4a9f0a105e6ca5f807d8c0f2745c01993`, preservada em `rea-cart-bytes.json`.
- Descritor `C3:95DC`: `ev_4a8b4ff1e419174f27606298231c8308c46f2838ed117a0e985e81960bbc2e0c`, preservado em `rea-cart-route-pointer.json`.
- REA leu o sorteador em `C3:54B3`, usando a semente em `0xAE`, multiplicador `0x0383` e limite recebido em Y. Evidência `ev_3a3f691f93a6f59717787509a2ced19680786a05d70067be7b54cbf5bc3568ce`.

Os endereços C2 executados não estavam todos definidos como procedimentos pela análise automática do Ghidra. Bytes e trace com contexto real foram usados; nenhuma descompilação integral de todas as mecânicas é alegada.

## Rota A integrada

Medição sem comandos, a partir do frame 7985:

- Embarque automático no centro: coordenadas nativas `(128,112)`, equivalentes ao tile Bombtop `(7,5)`.
- Carrinho parado nos primeiros 43 frames; primeiro deslocamento no frame 8029.
- Retas: 2 pixels nativos por frame. Curvas: seis frames, dois com avanço de 1 pixel na direção anterior, dois diagonais de 1 pixel por eixo, dois na direção seguinte. Raio de quatro pixels.
- Vértices nativos: `(128,112) → (128,48) → (32,48) → (32,208) → (64,208) → (64,176) → (96,176) → (96,144) → (128,144) → (128,112)`.
- A viagem móvel leva 272 frames. O controle normal retorna no frame 8352, 367 atualizações após o estado-base. Jogador termina próximo de `(127,95)`, tile `(7,4)`; carrinho permanece no ponto inicial.
- RIGHT, LEFT, DOWN, UP, A, B e X mantidos durante a viagem não alteraram as coordenadas do carrinho, comparadas frame a frame até o frame 400. DOWN permitiu novo embarque após o desembarque. Não há base para manter o cooldown arbitrário de 60 ticks após uma viagem normal.
- Capturas mostram blocos destruídos e itens expostos no trajeto; o trilho não exige um corredor inicialmente vazio.

Implementação: `sb4-trolley-route.ts`, `stage-trolley.ts`, fases serializáveis de transporte e teste `sb4-trolley-rom.test.ts`. O modelo preserva o mesmo deslocamento medido do carrinho, não a animação completa dos sprites SNES. O cliente desenha somente a trajetória selecionada durante boarding/riding/leaving e a oculta sem fase ativa; esse comportamento tem testes, mas a validação visual Bridge segue pendente.

Controle complementar de colisão: na fixture original, o carrinho em movimento atingiu P2 em `(127,95)` no frame 8034, com carrinho em torno de `(128,102)`; a escrita de função em `C2:4BC0` mudou `$0400` de `C2:141C` para `C2:10F9`. Com o carrinho parado, a mesma posição não produziu essa transição. Uma bomba normal também iniciou explosão antecipada em t8039, ainda com 74 unidades no contador `$087A`, após a escrita de função `C1:3CC2` para `C1:3DB8`; com o carrinho parado, continuou contando normalmente. O REA leu a vizinhança de `C2:4BC0` (`ev_24532d8390ec84d676f957e0c8a5133fd4fd50e74b93fe2fbf379a4bbe5f4875`). O Bombtop já eliminava o oponente e zerava imediatamente o pavio em `trolleyHits` quando ocupavam o mesmo tile; os controles corroboravam **os efeitos**, mas não demonstravam a mesma caixa de colisão, proteção, ordem de resolução ou regra de danos completa.

Em sondagens adicionais com P2 inicialmente em X nativo 120–135, o jogo o alinhou para X127 antes do contato; ao iniciar em X136, alinhou para X143 e não houve atropelamento nesse percurso. Portanto a posição inicial em tile adjacente, isoladamente, **não prova que a ROM detecte contato entre tiles distintos**. A extensão espacial exata do contato e as interações com itens permanecem pendentes; o objeto transitório observado durante a passagem não foi confirmado como item coletável.

### Momento do atropelamento e contato na fronteira (27/10/2026)

Repetição controlada da fixture no frame 7985, com P1 embarcado em `(128,112)` e P2 mantido distante até a atualização 46. Ao colocar P2 em `(127,119)` nesse instante, o carrinho passa de Y106 para Y104 na atualização 47 e `C2:5A1A` grava o bit `$04` em P2+`$C0` (`WRAM $04C0`). A função normal do jogador ainda é `C2:141C`. Na atualização 48, `C2:4BC0` escreve `C2:10F9` no ponteiro de função de P2, depois do contato registrado no frame anterior. Em `(127,103)`, a marcação ocorre na atualização 48 e a morte na 49. Em `(127,120)`, nenhuma marcação ou morte ocorreu até a atualização 50. A leitura REA de `C2:4B4E` é `ev_3ad3ad32bd173c85f2cd6553136f32a2a4eec50500ef4cbed3f6c80ed8eec857`: `C2:4B75` consulta o bit `$04` em P2+`$C0`, e a passagem subsequente por `C2:4BC0` troca a rotina de P2.

A marcação é persistente: após P2 tocar o carrinho na atualização 47 e ser reposicionado distante antes da 48, ele ainda passa a `C2:10F9` na 48. No controle inverso, P2 permaneceu distante até o fim da 47, entrou no tile de contato na 48 e apenas recebeu a marcação nessa atualização, mantendo `C2:141C` até a seguinte. Esse experimento separa detecção e resolução da colisão.

Uma segunda varredura registrou as áreas atingidas nos quatro sentidos da rota `C3:9A6A`, com P2 colocado apenas no frame observado e o bit `$04C0` lido depois da execução:

| Movimento | Atualização e posição nativa ao final | Tiles com contato marcado |
| --- | --- | --- |
| Cima | 47 `(128,104)`; 48 `(128,102)` | Na 47, apenas linha Y104–119; na 48, Y88–103 e Y104–119. |
| Esquerda | 82 `(118,48)`; 83 `(116,48)` | Na 82, apenas coluna nativa X120–135; na 83, apenas X104–119. |
| Baixo | 131 `(32,56)` | Linhas Y40–55 e Y56–71, simultaneamente. |
| Direita | 213 `(40,208)` | Colunas X24–39 e X40–55, simultaneamente. |

`stage-trolley.ts` agora identifica o contato nos tiles que a movimentação efetivamente percorre, preservando na fronteira à esquerda somente o tile anterior naquele frame, conforme o controle. Os IDs atingidos ficam em `StageTrolley.pendingHitIds`, um campo serializável, até a atualização seguinte. O teste `sb4-trolley-rom.test.ts` confronta frames positivos, controles negativos e serialização do estado com a execução da ROM. A regra está sustentada pelos quatro trechos medidos da rota central; **colisão completa com montarias, proteção, diagonais, itens, explosões e os demais grupos continua não comprovada**. Blocos e bombas continuam usando o tile de chegada, sem supor uma área espacial maior sem medição específica.

### Bomba atingida pelo carrinho: marcação antes da explosão (27/10/2026)

Nova reprodução a partir do estado controlado do mapa 11 no frame 7985: P1 foi posicionado em `(128,96)` e colocou uma bomba comum segurando A por oito frames; a bomba surgiu no objeto `$0860` em `(127,95)` na atualização 2. P2 foi posicionado em `(128,112)` para embarcar, com semente inicial `$AE=24`. P1 foi afastado para `(32,48)` na atualização 12. Essas edições de coordenadas e semente foram fixtures explícitas; **a bomba foi criada por controle real e nenhuma rotina da ROM foi alterada**. O carrinho seguiu a rota central `C3:9A6A`.

Na atualização **48** (frame 8033), com o carrinho chegando a `(128,102)`, a escrita executada em `C3:04E3` alterou **bomba+$2E**, `$088E`, de `0→1`, sem explodir. Na atualização **49** (frame 8034), antes de deslocar o carrinho de Y102, `C1:3CC2` escreveu o ponteiro da bomba `C1:3BE5→C1:3DB8`, apesar de o contador de pavio ainda estar positivo (`$087A` baixo = 79). No frame 50, a rotina passou para `C1:5051`. Com as mesmas posições da bomba e controle A, mas P2 afastado e carrinho parado, não houve detonação antecipada. Outro posicionamento natural em `(127,63)` confirmou `$088E=0` no tick63, `$088E=1` no **tick64** com carrinho `(128,70)`, e mudança para `C1:3DB8` no **tick65** com carrinho `(128,68)`.

O ensaio instrumentado e a repetição sem hooks produziram os **mesmos 131072 bytes de WRAM**, verificados por SHA256 nos ticks 48, 49, 50 e 52, respectivamente: `654cc44ad822467cc355c15be893015ddf6f26a1d29d501df9844dfe2327e689`, `35557ba701d3f0db6b8a89ff0e18593df1d79867cb709c46b4ea4f7247f3c353`, `13942dc72d26d90dc6e21a00c7fbf0b2b0a878353a1d0521d403794ec25c7481` e `b967629f8d213e83ea29c1d211c1ed89e31527d1890daf28d0f4619d06f03e76`. O REA leu os trechos executados `C3:04C0` (`ev_dbd7e1b1fce6554fdbb50841e1c724d0f2d7665b6fc4b4d090341ccda6b1aaf0`) e `C1:3C30` (`ev_1ef3668887c6f08de59cab40b7796b87b5f4a223267eff362af9f8a8e25df843`). A escrita em `$088E` é a evidência direta da separação entre contato e início da explosão, não uma inferência baseada no sprite.

No Bombtop, o campo serializável `Bomb.trolleyContactPending` registra o contato no primeiro tick e é consumido na atualização seguinte para zerar o pavio. O `step` então detona a bomba na fase normal de explosões, reproduzindo a ordem nativa nas duas posições medidas. A regressão `sb4-trolley-rom.test.ts` cobre os ticks `48→49` e `64→65`, controle com carrinho parado e round-trip JSON entre marcação e detonação. O arquivo soma **32 testes verdes** após a correção. A regra não valida automaticamente bombas chutadas/carregadas, explosões em cadeia, interações com blocos, nem os grupos ainda não extraídos.

## Três rotas centrais integradas

Mesmo ponto de embarque, com sementes de laboratório:

| Script observado | Semente WRAM | Vértices nativos após `(128,112)` | Retorno do controle |
| --- | --- | --- | --- |
| `C3:96CA` | 0 | `(96,112),(96,80),(64,80),(64,176),(96,176),(96,208),(192,208),(192,176),(224,176),(224,112),(128,112)` | tick402, jogador `(111,111)` |
| `C3:9A6A` | 24 | rota A acima | tick367, jogador `(127,95)` |
| `C3:9D9A` | 48 | `(128,176),(192,176),(192,80),(96,80),(96,48),(32,48),(32,112),(128,112)` | tick407, jogador `(143,111)` |

Artefatos: `cart-three-route-replays.json`, `cart-three-route-vertices.json`, `cart-three-route-exits.json`. A fixture em `packages/shared/test/fixtures/sb4-trolley-centre.json` deriva desses replays e confere 500 posições por rota, o tick exato de devolução do controle, o tile de saída e o estado seguinte do sorteador.

REA `C3:54B3` e `C3:54F4` (`ev_bae5fef0e1f2e98875e31791bcc98913774bb2ca545d729382cf41800958d17e`) mais medição WRAM confirmam `next=((seed|1)*0x383)&0xFFFF`, escolha `floor(next*3/65536)`. As sementes 0/24/48 produzem 899/22475/44051. O Bombtop mantém `routeRng` serializável no carrinho e sorteia a cada embarque. A operação foi reproduzida; a agenda global de todos os sorteios da ROM não foi portada. A semente inicial vem do seed da partida local.

As saídas levam 51/52/62 ticks depois do último deslocamento, respectivamente esquerda/cima/direita. O trajeto fica dentro de estado compartilhado autoritativo; o cliente não sorteia resultados.

## Nove rotas Group 1 integradas

As três estações Group 1 estão no runtime, com três trajetos cada. `sb4-trolley-paths.ts` conserva vértices nativos e scripts; `sb4-trolley-nine-routes.json` conserva posições observadas, sem frames parados de vídeo, como fixture independente do gerador de curvas.

Os **nove desembarques** agora são verificados também pelas coordenadas exatas do jogador, além do tile e tick: estação central `(111,111)/(127,95)/(143,111)`, direita `(175,143)/(191,127)/(191,127)` e inferior `(111,207)` nas três rotas. As referências são `cart-three-route-exits.json`, `station-right-report.md` e `station-bottom-report.md`. Em `stage-trolley.ts`, a saída usa o deslocamento nativo de 1 pixel em X e Y abaixo do centro geométrico anterior (`TILE/16` em cada eixo), confirmado por nove testes de regressão. A regra está comprovada para as três estações Group 1; demais grupos permanecem sem evidência suficiente.

| Estação nativa | Descritor | Scripts C3 | Atualizações móveis | Retorno do controle em atualizações lógicas |
| --- | --- | --- | --- | --- |
| `(128,112)` | `C3:95DC` | `96CA / 9A6A / 9D9A` | `308 / 272 / 302` | `402 / 367 / 407` |
| `(192,144)` | `C3:95F0` | `A102 / A402 / A7D2` | `268 / 336 / 374` | `362 / 431 / 469` |
| `(128,208)` | `C3:9604` | `AC2A / AFF2 / B332` | `312 / 274 / 308` | `406 / 368 / 402` |

Contagem por entradas CPU do objeto `0x14C0`, separada de frames de vídeo: `cart-centre-logic-entry-trace.json`, `station-bottom-logic-controlled.json`, `station-right-evidence.json`. As 42 chamadas de boarding somam-se à atualização que inicia o embarque. Há chamadas móveis sem deslocamento em algumas rotas e diferenças reais na saída; elas não foram reduzidas indiscriminadamente a 51. O runtime reproduz as trajetórias medidas do passageiro nas nove rotas Group 1, mas as interações com obstáculos, itens, outras entidades e frames de vídeo continuam exigindo controles adicionais.

### Trajetória nativa do passageiro: embarque, viagem e desembarque (27/10/2026)

Replays da ROM japonesa (SHA256 `bdd90b49bf08d0d0a80e4b4ec811084d470355c648c49a28a0e838cbf1ea8f92`) a partir de `stage11-controlled-initial.json`, com P1 em `(128,112)`, P2 afastado e três sementes de rota `0/24/48`. As **43 primeiras atualizações** movem apenas o passageiro na animação de embarque, com o carrinho parado. Os três vetores completos de offsets foram idênticos, SHA256 do JSON: `b9a7411ac228f055cec84d03c2c292e76a8c37d7e828e3da10b7fbb586ae65bd`. Exemplos relativos à estação: tick3 `(1,-2)`, tick9 `(7,-4)`, ticks26–31 `(7,-28)`, ticks42–43 `(7,-5)`; a primeira atualização de deslocamento do carrinho (tick44) põe P1 em `(-1,-1)` independentemente da rota. `stage-trolley.ts` reproduz esses offsets pelo contador serializável `phaseTicks`, sem criar um RNG secundário.

Durante a fase `C2:2475`, em toda atualização que move o carrinho, a posição nativa de P1 é **a posição anterior do carrinho menos 8 pixels em Y**: `P1.x = cart.previousX`, `P1.y = cart.previousY - 8`. Foram confrontadas sem divergências **307 + 271 + 301 = 879 atualizações** das três rotas centrais, mais **206 da estação direita e 209 da inferior** em controles isolados. O primeiro frame móvel usa a posição transitória `(stationX-1,stationY-1)` de `C2:2454`. O runtime agora mantém essa posição do passageiro no estado autoritativo, em vez de fixá-lo ao centro do carrinho. Os três hashes completos das sequências centrais de P1 entre o tick44 e o último tick em `C2:2475` são `7149c82d17f71894ac57906362a13a051f08280a603b4c0ed46e01b7a43e6de4`, `e536d4bfeabcdcee5ce5a5bb767856f62f4a62727f237b922284a7855e694df8` e `23f05f5e5f17e62eccaae4c947398eea977f67431013b1cfab3f35bacd10e1b2` para sementes 0, 24 e 48. A rota da semente 24 inclui uma atualização sem deslocamento do carrinho.

O trace de `C3:045A` possui **uma atualização adicional sem deslocamento** para a rota central `C3:9A6A` e as rotas da estação direita `C3:A402`/`C3:A7D2`, ausente nas outras seis. `FINAL_RIDER_FOLLOW` registra essas três ocorrências antes de iniciar o desembarque; a contagem final de retorno do controle permanece a mesma.

Na fase de saída `C2:2578`, P1 executa uma trajetória aérea relativa à estação com duração de **50 atualizações à esquerda, 50 para cima e 61 à direita** antes de recuperar o controle no frame seguinte. As trajetórias completas, como JSON de pares relativos, resultam nos hashes `a200d35fb06ac68336b2ab2fbcdffbe23cf76cfe43d0f79e7905d1676cf24f16` (esquerda), `022ed8a92982f4b085519c8b71825bf9798e27ed988997ccdac9230943a9f5e8` (cima) e `bddb4538ec7474b3c293b72018239ed0c122aff72a0c8577fab9628997d17948` (direita). O mesmo hash de saída à esquerda foi obtido na estação central, na direita e, em nova execução controlada do estado `stage11-live-state.json`, na inferior (**51 entradas CPU de `C2:2578` e 50 posições pós-primeira entrada**). Os dois trajetos da direita com desembarque superior também reproduziram exatamente o hash da estação central. O código usa esses keyframes compartilhados por direção e preserva os nove ticks e tiles de saída medidos anteriormente. O teste `sb4-trolley-rom.test.ts` agora valida os nove arcos por hashes, além de coordenadas e restauração de snapshots.

O REA leu os trechos originais `C2:2342` (`ev_1959efad3d6e6755cd841d19409aa2258733cb4cd93ddeb72f4ce14d631dd1e9`), `C2:2454` (`ev_c2743a8bfe56065ad8ecef1878df1f564bf83b9d343d299a254ab9ef6f0bdeca`), `C2:2475` (`ev_77944fc196c8f58b8f3c4f2d5c9242144bd651fe47e188a5f30088fb908dbb55`) e `C2:2578` (`ev_1b9cd81fbe02c147e050cc42122e1383f51280301978681f0a02edc833ca295c`). Esta paridade é de **posições e temporização lógica nas fixtures Group 1**, não uma garantia de que colisão do passageiro com itens, explosões, montaria, obstáculos na saída, animação de sprites, pausa real de vídeo ou grupos restantes esteja concluída.

### Embarque fora do centro e prioridade de candidatos (27/10/2026)

Uma segunda auditoria do estado `stage11-controlled-initial.json` percorreu 64 posições válidas dentro do contato da estação central, com P2 afastado e semente 24. **A animação não é um deslocamento fixo a partir do centro:** em `(128,112)` P1 aproxima-se da direita; em `(127,111)` desloca-se verticalmente; em `(120,111)` permanece na borda esquerda; em `(127,112)` começa descendo. Fora da faixa nativa X120–135/Y104–119 não ocorreu embarque nos controles amostrados. A entrada simultânea de P1 e P2 na estação, inclusive um deles em `(127,111)`, selecionou P1; o segundo só recebeu o bit de atropelamento no primeiro movimento do carrinho (tick44), entrando em morte no tick45.

O REA identificou `C2:2342` (`ev_4efb3c9c1626d166e0672a476b3fcff0a1e6348e537115af19c80c7e3b368ead`) chamando `C2:35FB` (`ev_2507bad9c877243507f251d6dac14d96176771ec37fd46a967dcd181253cbb17`). A rotina usa os nibbles de `(rawX-8)` e `(rawY-8)` como índice de uma matriz 16×16 na ROM `C3:2DB0` (`ev_71b0bc0563a9294444f346755eea604808dabde3d2d6c352fcc1fdb16bea71d3`), de SHA256 `5d9221a737608cac21ea1f16f3c83b8e07d27da2d95b0599c1c6e8ae363778e3`. As entradas 0–8 selecionam os vetores da tabela `C2:363C` (`ev_a737a4730dd1363bfe34d9552c16ae06e620c38ea6cf6c86fe2770ede2eff6a1`); a posição visual acrescenta um deslocamento vertical de animação independente do vetor. Foi conferido que a sequência desse deslocamento vertical tem o mesmo SHA256 `d4774d428bda38c56c0d6a444561dcbf3cebbe33810b7283c0a5fc7d29660559` nos dez pontos de entrada inicialmente comparados.

Com os bytes originais, o vetor escolhido e a oscilação vertical reproduziram **2.624 atualizações de embarque**, amostradas em 64 entradas válidas, sem divergência de X/Y. `stage-trolley.ts` passou a consultar o mesmo campo de direções para movimentar o passageiro, em vez de pressupor sempre a curva central. Os testes `sb4-trolley-rom.test.ts` confrontam os hashes de **13 entradas não centrais**, a ausência de embarque em quatro posições fora da estação e restauração JSON no meio do arco. Nas estações direita e inferior, seis replays adicionais por atualização lógica confirmaram a mesma regra depois do ajuste inicial de posição.

**Limite importante:** a posição do jogador pode ser empurrada por colisão normal **antes** de iniciar o embarque: na estação inferior, `(128,208)` tornou-se `(128,207)` na atualização inicial em uma fixture. Essa correção de colisão não é executada por `C2:2342` e não foi atribuída artificialmente ao carrinho; os testes de embarque fora do centro partem de posições já normalizadas. Prioridade com montaria, salto, jogador carregado e situações de bloqueio continua pendente.

### Célula anômala da matriz de embarque (27/10/2026)

O byte `0x40` de `C3:2DB0[159]` não seleciona o vetor neutro. Em `C2:35FB`, a ROM usa seu valor como índice multiplicado por quatro para carregar dois words da tabela iniciada em `C2:363C`; índice 64 acessa `C2:373C`, já dentro de código 65816, cujos bytes `01 6B C2 20` são interpretados como deslocamentos **`0x6B01` (27393)** e **`0x20C2` (8386)**. Leituras REA: `C2:35FB` (`ev_323cca821f4b33afffcb2aaff856686e8851617ae22c92ac214a121941a7c901`), `C2:3738` (`ev_a6089f73f2ebf5b6489a3586345869f7d7242bdec42bfea4ac6915ee5589b7e5`) e `C3:2E40` (`ev_15d52426667ab6f6354ffcfb12a4e2bfb30c8f6cd33d727d26f1700bdc7b705b`).

A partir de `stage11-controlled-initial.json`, após dois ticks de embarque central, a fixture escreveu `(135,113)` simultaneamente em `$0312/$0316` (posição visível) e `$0358/$035A` (posição interna) antes do tick 3. O trace observou Y=159 e A=64 na consulta, e P1 passou de `(135,113)` a `(27528,8498)`; o hash dos 131.072 bytes da WRAM foi **`2b3c115fa22a4c52bf22a2ba7bd4dd79d2cb3d6c4bbb48a131d7b58cbc3540d6`** com e sem hook. Controles vizinhos `(134,113)` e `(135,112)` resultaram em `(134,111)` e `(135,110)`. `stage-trolley.ts` agora reproduz esse resultado extremo, coberto por três regressões.

O replay até o fim do embarque isolou outro detalhe: de t3 a t43, as **41 posições** após a célula `0x40` têm SHA256 `0757272846e66eb6617ed98b439d1f0e688d65945b592bb2f50bebbc47ef75ba`. Em t44, a ROM alinha as coordenadas internas pela operação `((posição + 8) & 0x01F0) - 1` para cada eixo, chegando a `(399,303)` em vez da posição habitual `(127,111)`. A rotina está em `C2:2378` (`ev_48e73653eff960395bf4de1a892a03d62624f3d42d5957bb978a144407d66114`), com o mesmo SHA256 de WRAM `bf81d61d98be1c8ee475ec41d56e0373761def322b02dbe88f0b96f3dae4d229` com ou sem hook após t44. Em t45, o personagem retoma o seguimento do carrinho em `(128,102)` e chega a `(128,68)` no t62, para a rota de semente 24. A transição em `stage-trolley.ts` passou a alinhar as coordenadas do passageiro pelo mesmo bitmask; o teste agora cobre t3–62 e preserva os replays normais das nove rotas.

Uma varredura adicional executou **todas as 256 posições iniciais X120–135/Y104–119** no controle da estação central, sem botões, com o mesmo estado de partida. Houve embarque nos 256 casos, **10.496 consultas** à matriz (`41` por caso) e nenhuma leitura do índice `159` ou do valor `0x40`. Em 60 casos, a colisão normal alterou Y na primeira atualização; `(135,113)` tornou-se `(135,111)` antes da leitura do campo. Assim, a divergência anterior de fallback foi corrigida para a situação forçada, mas **não foi demonstrada sua ocorrência em gameplay normal**. Restam cenários com movimento, colisão por outros atores, itens e efeitos durante a aproximação.

A escrita nativa do alinhamento inferior foi isolada em **`C2:5807`**, com `$0316:208→207` enquanto a função de P1 permanecia `C2:141C`. O replay de `(128,207)` não precisou de ajuste, e o da estação direita `(192,144)` manteve suas coordenadas; os três controles com e sem hook resultaram em WRAM idêntica. O REA leu o intervalo `C2:57F0` (`ev_41266a0252696b93cc4f288acc5409d9274246bf11edd46a9bd686036f0cc697`). Esse dado delimita a responsabilidade da movimentação/colisão normal, mas não reproduz toda a lógica `C2:5807` do jogo web.

### Passageiro e fogo de bomba comum (27/10/2026)

No replay de P2 embarcado em `(128,112)`, P1 colocou uma bomba normal com A em `(127,95)` e afastou-se pelo botão DOWN, sem teleporte posterior. A bomba foi marcada pelo carrinho no tick48, iniciou detonação no 49 e chama no 50. P2 permaneceu em `C2:2475`, com `$04C0=0`, durante e depois da explosão; P1 também sobreviveu. No controle P2 **parado** em `(127,95)`, o contador da mesma bomba foi ajustado para disparar no tick49: P2 entrou em `C2:10F9` no tick51 por escrita de `C2:4BC0`, seguida de `C2:1224` no 52. Hooks de leitura e escrita não alteraram a execução: os hashes de todos os 131.072 bytes de WRAM foram idênticos ao replay sem hooks nos ticks 48,49,50,51,52,54,60 e65 em ambos os cenários. O REA leu `C2:4B4E` (`ev_39611ca75e3009133d94fcf6bd5fe8201bcfff8bf7a0a2b5df27dfb8fad143bf`) e `C1:5051` (`ev_45700bbead85ef6e103481545a548f0656fe23e5b7eff8e5daad6318cd7cf751`).

Controles adicionais dispararam o pavio em ticks 18/22/26/35/40 enquanto P2 estava na animação `C2:2342`, sem provocar morte; o jogador parado no centro da chama morreu. Na rota central de saída à esquerda, com a bomba comum criada por A e o pavio prolongado por ajustes controlados, a explosão ocorreu no tick365 durante `C2:2578`, e P2 concluiu o desembarque em `C2:141C` sem dano. A implementação já isentava o passageiro das chamas em `step.ts`; essa isenção agora possui provas para **embarque, viagem e desembarque com bomba normal** e testes de regressão com controle parado e snapshots. Bombas especiais, múltiplas explosões, proteção por montaria e a colisão da trajetória aérea com obstáculos continuam sem paridade comprovada.

O sorteio de estação foi observado em `C3:02AF`, Y=3, antes de criar o objeto. O resultado indexa a tabela `C3:95DA` com stride20. Trace: `cart-initial-station-selection-trace.json`; bytes REA: `ev_237f643ec0d3ac88cbf8d71751222b093b89ea29e93c0e2ea90ec0af88a70b97`. O runtime usa a mesma operação RNG16 para estação e depois trajeto. A posição da estação libera seu collider de bloco no template provisório; geração nativa de blocos e itens sob a estação continua em aberto.

Relatórios: `.agent/sb4-rom/station-bottom-report.md` e `station-right-report.md`. Nove trajetórias Group 1 não comprovam todas as variantes dos outros grupos.

## Fuse normal integrado e variantes pendentes

Uma bomba colocada por A na fixture normal de dois humanos inicializou `WRAM 0x87A=126`, por escrita executada em `C1:1FC7`, e decrementou a cada atualização em `C1:3CE9`. A rotina passou a explosão em `C1:3DB8`. Artefatos: `bomb-first-ten-frames.json`, `bomb-timer-write-trace.json`, `bomb-timer-original.json`. REA leu os bytes de inicialização (`ev_d33e4e555835dfc75ff64ac58f7797c0c18a60ac6d3e7f62431bce99e26be11d`) e do contador (`ev_8cb5d6ce99491d66aefba9ae6033a5b78e7402c2fef7bf76e98a32fc305f6357`). O valor 126 também foi lido em `C1:56EA` (`ev_cce91f64a1a6f7c69f95f25eaabfdff1f8fa639046f4427818ee1eb23e8787b6`).

O fuse de bombas normais SB4 foi corrigido para 126, preservando o valor no tick de criação e começando o decremento na atualização seguinte. Os mapas 03 e 11 e os bytes da rotina comum sustentam a mudança. Arenas autorais, remote/pierce e maldições curta/longa conservaram suas regras anteriores. Tipos e condições restantes, inclusive tempo02, precisam confronto específico. As tentativas antigas de expor o passageiro às chamas não chegaram a embarcar e não provam imunidade; o teste da estação parada não mediu extensão da chama atrás dela e não prova bloqueio de raios.

## Pendências

O mapa 03 confirmou a inicialização 126 em quatro colocações reais. A integração do fuse e as correções da interpretação de direção das bolas estão descritas em `SB4-BOLAS-ROM.md`.

1. Extrair grupos/variantes restantes e validar regras de colisão/interrupção da saída, além das trajetórias já medidas do Group 1.
2. Confirmar danos a adversários protegidos, bombas, itens, imunidade do passageiro e o que ocorre com a estação durante destruição/pressão.
3. Validar visualmente os trilhos e a apresentação das posições de embarque/desembarque no cliente, incluindo animação de sprites e profundidade.
4. Substituir layouts fixos e distribuição de blocos aproximados por geração comprovada. Os estados originais diferem entre partidas; `USUAL` é explicitamente provisório.
5. Investigar os outros onze mapas com o mesmo rigor. Testes verdes da simulação não provam paridade com a ROM.

## Validação desta correção

Nesta rodada, a suíte shared completa teve 848 passes e quatro falhas já observadas: três snapshots de partidas autorais e o teste de aquecimento da IA. Os 104 testes focados client, o typecheck shared/server/client e o build Vite/PWA passaram. Log: `.agent/sb4-latest-shared-tests.log`. Nenhum snapshot foi regravado para ocultar diferenças. A validação visual Bridge continua pendente da rodada anterior; nenhuma captura do cliente é alegada aqui. Sem commit/push por este agente.
