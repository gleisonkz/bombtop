# SB2: investigação e integração das arenas

## Objetivo e critérios de conclusão

Implementar as 12 arenas do Battle Mode com layouts, obstáculos, colisões,
posições iniciais, animações, regras e interações fiéis, adaptando a aparência
à concept art do Bombtop. Preservar os 12 mapas de SB4. Não realizar commit
nem push. Nenhuma arena será marcada como validada sem investigação por REA
e execução individual pelo MCP de Snes9x.

## Ponto de retomada — 31/10/2026

- Checkout inicialmente sem alterações no `git status --short`.
- ROM disponível fora do projeto em
  `C:/Users/USER01/AppData/Local/BombtopTools/mcp-snes/roms/Super Bomberman 2 (Europe).smc`.
- SHA-256: `dcf9cd8615a08c8050fd102702291808cafaffd428013f2dda3164130b7f08fd`.
- Tamanho: 1.048.576 bytes. Cabeçalho HiROM em `0xFFC0`, título
  `SUPER BOMBERMAN2`, modo `0x31`, região `2`, vetor de reset `0xFA00`.
- Complemento/checksum declarados: `0x25C9` / `0xDA36`, XOR `0xFFFF`.
  A relação entre os campos não comprova autenticidade nem valida o checksum calculado.
- REA `inspect_byte_entropy` leu a identidade do arquivo: evidência
  `ev_f2b503f557564924ce0b41791c3453f03a28b4d09083a0f65d884dc99e908093`;
  projeção resumida `ev_d14ff5cdbfb89c0204ad76ec568a5524aaeacc905c8b36069617456ca41969a4`.
- REA `open_binary` rejeitou a ROM com `unsupported binary format`,
  `retryable=false`. Não repetir a mesma abertura nem declarar análise 65816 concluída.
- O MCP instalado `mcp-snes` usa SnesJs, não Snes9x. Pelo cliente MCP SSE,
  carregou o título; iniciar Normal Game resultou em tela preta após avançar frames.
  Isso não valida o Battle Mode.
- Snes9x 1.63 já instalado em
  `C:/Users/USER01/AppData/Local/BombtopTools/Snes9x-1.63/snes9x-x64.exe`.
  A mesma ROM executou a introdução animada e exibiu o menu nativo,
  observados por Computer Use. Não é evidência de validação pelo MCP de Snes9x.
- Nenhuma ferramenta MCP de Snes9x está exposta nesta sessão. Não confundir
  existência do executável com disponibilidade de MCP.
- Controles configurados do jogador 1: Start=Space, Select=Enter,
  A=V, B=C, X=D, Y=X, direções=setas. Pressões breves por Computer Use
  não estabeleceram navegação reproduzível no menu. Não inferir arena dessas telas.

## Superfícies de integração identificadas no código

- `packages/shared/src/stage.ts`: `StageId`, `SELECTABLE_STAGES`, `buildStage`.
- `packages/shared/src/arena.ts`: criação da partida, posições iniciais e itens.
- `packages/shared/src/stage-mechanics.ts`: inicialização e atualização de mecânicas.
- `packages/shared/src/sb4-layouts.ts` e `sb4-stage-definitions.ts`:
  referência existente de layouts e definições; preservar integralmente.
- Renderização existente: `apps/client/src/render/sb4-stage-effects.ts`.

Não reutilizar valores de SB4 como se fossem regras confirmadas de SB2.
Não adicionar arenas selecionáveis com layouts provisórios.

## Cobertura por arena

Os números correspondem à seleção mostrada no jogo. O byte WRAM `0x1CCD`
foi observado de 0 a 11, correspondente às arenas 1 a 12.

| Arena | Layout e colisões | Posições iniciais | Mecânicas e interações | REA + MCP Snes9x | Integração |
| --- | --- | --- | --- | --- | --- |
| 01 | Grade nativa ligada ao criador interno; colisão ensaiada | Criador confrontado com as quatro posições REA | Bombas, bolsa/coletas e piscadas do Skull no step real; morte/contágio e demais interações pendentes | Grades, jogadores, bombas, coletas e dois ciclos de piscadas conferidos | ID interno sb2-01 no step; fora do seletor |
| 02 | Grade nativa no criador; gelo, corpos de bombas e deriva medida conferidos | Quatro posições iniciais confrontadas com REA | Oito replays de gelo/bombas e oito de transporte no step; preparação, curvas, RNG, saída aérea e bomba pressionada conferidos | 3.042 leituras; 3.016 passos reproduzidos (transporte começa no estado1) | Interno sb2-02; entrada inferior, outras interações e arte pendentes; fora do seletor |
| 03 | Grade nativa no criador; percursos, reservas e bloqueios conferidos | Quatro posições confrontadas com REA | Passagens, ocupação/ordens, soltura/reversão, empurrão UP de dois MAN e plantio/bombas nos limites medidos | 3.856 leituras; 16 replays/3.840 avanços no step | Interno sb2-03; outras bombas/dano, grupos, inventários e arte pendentes; fora do seletor |
| 04 | Grade nativa no criador; percursos com colisão conferidos | Quatro posições centrais confrontadas com REA | Ignição, sobreposição, dano e reinício; três bombas em sequência conferidas | 17 casos com 4.017 leituras REA/MCP e 4.000 passos reproduzidos | Interno sb2-04; arte e demais inventários pendentes; fora do seletor |
| 05 | Grade nativa ligada ao criador; piso20 transitável e percursos conferidos | Quatro posições confrontadas com REA | Plantio sobre placa gera alcance10 sem mudar inventário; duas explosões e coletas reveladas conferidas | 964 leituras; quatro replays/960 avanços no step | Interno sb2-05; demais placas, interações e arte pendentes; fora do seletor |
| 06 | Grade nativa ligada ao criador interno; colisões dos percursos conferidas | Criador confrontado com as quatro posições REA | Dois pares, trava, plantio, chamas e contatos; trocas simultâneas/ocupação com dois humanos conferidas | Percursos de ida/volta e 16 replays completos confrontados com REA/MCP | Interno sb2-06; chute/luva e arte pendentes; fora do seletor |
| 07 | Movimento manual em 23 trajetórias conferido no step; semântica geral parcial | Criador confrontado com as quatro posições REA | Duas placas, pausa e relógio ligados ao loop; itens e multiplayer pendentes | Grades, jogadores, pisos, movimento e RNG nas entradas conferidos | ID interno sb2-07 no step; fora do seletor |
| 08 | Grade interna; movimento manual e livre confrontado | Criador confrontado com as quatro posições REA | Comandos, bombas de dois jogadores, reservas e uma cadeia móvel no step; demais interações pendentes | Leituras REA/MCP e ensaios anteriores preservados nos bundles individuais | Interno sb2-08; 34 casos do controlador e 24 percursos completos com bombas; fora do seletor |
| 09 | Grade nativa no criador; piso das setas transitável | Quatro posições REA/MCP | Chute, setas60/61/62/63, parada por piso/jogador, fusível e queima de item nos casos medidos | Trinta e oito replays/9120 avanços no step | Interno sb2-09; demais entradas/interações e arte pendentes; fora do seletor |
| 10 | Grade nativa interna; colisoes especiais pendentes | Quatro spawns REA/MCP confrontados | Salto Y, aterrissagem, quatro bordas, plantio e quatro casos de fogo no step | 40 trajetorias/7440 passos nativos | Interno sb2-10 parcial; outras interacoes, multiplayer e arte pendentes; fora do seletor |
| 11 | Grade nativa no criador; limites de chao conferidos | Quatro spawns e inventario REA/MCP | Carga/preparacao/lancamento no step em8percursos | 21capturas/4440avancos completos;7testes do componente | Interno sb2-11 parcial; animacao,interacoes e arte pendentes;fora do seletor |
| 12 | Grade nativa interna; corredores e pisos11/12 nos percursos conferidos | Quatro spawns confrontados pelo criador | Piso12: preparo/salto/pouso/escape; piso11: impacto/chama/Fire aereo/rebates/pouso no step | 44capturas/8540avancos integrados;RNG,fogo,Speed/Kick e devolucao pos-morte conferidos | Interno sb2-12 parcial; demais inventarios,interacoes,multiplayer e arte pendentes;fora do seletor |

## Verificação deste ponto de retomada

- Evidências REA exportadas em `docs/sb2/SB2-REA-EVIDENCE.json`: dois registros.
- Manifesto de preservação: `docs/sb2/SB2-SB4-BASELINE.json`, 37 arquivos.
- `pnpm -C packages/shared exec vitest run test/sb4-maps.test.ts test/sb4-stage-definitions.test.ts test/room/sb4-map-cycle.test.ts`:
  três arquivos e 38 testes passaram. Essa cobertura verifica mapas, definições
  e ciclo de seleção de SB4; não comprova todas as mecânicas nem valida SB2.
- Nenhum código de gameplay alterado, nenhum commit ou push realizado.

## Retomada operacional

### Avanço: ponte MCP real e partidas 1–10

As limitações de MCP descritas no primeiro ponto de retomada foram parcialmente
resolvidas por `tools/sb2-research/`: servidor MCP stdio, cliente de replay e
worker libretro. O worker usa Snes9x real, não a implementação SnesJs.
Não houve alteração na configuração global de MCP.

- Núcleo: `Snes9x 1.63 fae2fea`, SHA-256
  `cc6440ee820a39a13491a22a665c31b4196308fd8f4226221e0794d7da294c10`.
- DLL adquirida uma vez do [buildbot oficial](https://buildbot.libretro.com/nightly/windows/x86_64/latest/snes9x_libretro.dll.zip),
  preservada em `C:/Users/USER01/AppData/Local/BombtopTools/snes9x-libretro/`.
- Contrato utilizado: [libretro.h oficial](https://raw.githubusercontent.com/libretro/libretro-common/master/include/libretro.h).
- Checksum efetivamente calculado sobre a ROM: `0xDA36`, igual ao cabeçalho.
- Controle por frames e botões, captura PNG, leitura de WRAM e estados
  funcionando via chamadas MCP reais. Não foi escrita RAM nem alterada a ROM.
- Quatro testes passaram: replay de estado reproduz RAM e pixels idênticos;
  leituras inválidas são rejeitadas; avanço inválido é rejeitado; estados
  existentes não são sobrescritos.

Evidências de execução em `output/sb2-research/`:

| Pasta | Conteúdo e alcance |
| --- | --- |
| `battle-delayed` | Tela Single Match / Tag Match |
| `battle-single` | Tela de jogadores |
| `battle-options` | COM Level=5, Battle=3, Time=2:00, G-Bomber=ON |
| `stage-select` | Seleção de arena com estado reproduzível e WRAM |
| `stage-previews-settled` | Prévias estáveis 1–10; captura 11 já mostra retorno à arena 1 |
| `arenas-first` | Estados da transição, ainda com tela preta; não usar como layout |
| `arenas-settled` | Dez partidas: `arena-01.png` até `arena-10.png`, estados e WRAM |

Cada `journal.json` preserva plano completo, respostas, frames e hashes.
Os estados de `arenas-settled` já estão alguns segundos depois do início:
**não provam a disposição inicial dos blocos**. A captura da arena 1 mostra
cronômetro em 1:53. Não converter essas capturas diretamente em layouts.
Os caminhos de estados são locais; ROM e DLL não estão versionadas.

A entrada no Battle Mode exigiu aguardar o fim da animação do título.
Os tempos curtos usados inicialmente ignoravam confirmações. Não repetir
diagnóstico de controles antes de observar o estado e aguardar a transição.
Também é necessário aguardar a animação da prévia entre mudanças de arena.

A seleção padrão percorreu 1–10 e voltou à 1. A hipótese de desbloquear
11/12 por X veio de referências externas, não de extração da ROM.
Dois ensaios não confirmaram o desbloqueio: cem pulsos com dois frames
pressionados/dois soltos (`hidden-stage-select`) e X mantido por 400 frames
(`hidden-hold`). Não repetir essas sequências sem nova hipótese ou evidência.
Os nomes dos arquivos nesses ensaios são ordinais de captura, não IDs de arena.

### Limitação REA ainda vigente

Além da rejeição da ROM em `open_binary`, uma tentativa de registrar o replay
por `capture_process_scenario` retornou `capability_unavailable`: o adaptador
REA não captura PTY nativo Windows porque não verifica limpeza dos processos
descendentes. A resposta declara que reinstalar o backend PTY não resolve.
Não houve execução desse ensaio REA. Não tratar journals MCP como evidência
produzida pelo REA. O bundle REA existente continua cobrindo apenas a identidade
e entropia da ROM, sem semântica de arenas.

### Avanço: extração de grades e comparação REA/MCP

O bloqueio do PTY Windows permanece, mas deixou de impedir a observação
dinâmica: o REA conectou Frida ao processo Python que hospeda o núcleo Snes9x.
`rea-grids.js` instrumentou `retro_get_memory_data` e observou duas grades
durante as leituras do cliente MCP. Não houve escrita na ROM ou WRAM.

- Primeira célula da grade corrente: offset WRAM `0x1C182` (endereço SNES
  `7F:C182`); segunda grade: `0x1D182` (`7F:D182`).
- Dimensões: 15×13. Células `uint16` little-endian, passo horizontal 2 bytes,
  passo vertical 128 bytes. A segunda grade mantém o fundo sem muitos dos
  blocos acrescentados à primeira; sua função exata ainda exige análise.
- `output/sb2-research/arena01-start`: amostragem a cada vinte frames após
  o estado de transição. Em `offset-100.png`, cronômetro 2:00 e grade visível;
  em `offset-160.png`, já há bombas dos COMs.
- `output/sb2-research/arenas-initial`: estados, imagens e WRAM dos dez
  estágios no offset +100, mais próximos do início. Não afirmar que não há
  ação de COM em cada arena sem inspecionar individualmente essas imagens.
- `docs/sb2/SB2-EXTRACTED-GRIDS.json`: valores brutos e contagens exportados dessas
  dez capturas. Códigos de pisos especiais não foram transformados em regras.
- `output/sb2-research/arena01-bomb-probe`: movimento de 32 frames à direita,
  A por quatro frames, observações após 140 e mais 60 frames. Célula (3,2)
  muda `0xC2 → 0`; (4,1) muda `0xC2 → 0x44`, com chama visível. Os pilares
  `0xC5` permanecem. Isso sustenta atribuir `0xC2` a bloco destrutível nessa
  arena, mas não estabelece o tempo exato de fusível nem todas as colisões.

O REA fez dez leituras instrumentadas, uma por estado, e o MCP leu os mesmos
estados. `verify_rea_grids.py` comparou as duas grades inteiras:
**3.900 células coincidiram**, sem truncamento de mensagens do Frida.
O byte observado no offset `0x1CCD` foi 0 a 9 conforme as arenas 1 a 10.
Isso reforça a correspondência entre ordinais e seleção nessas capturas.

- Bundle: `docs/sb2/SB2-REA-RUNTIME-GRIDS.json`.
- Resultado: `docs/sb2/SB2-REA-MCP-COMPARISON.json`.
- Evidência REA: `ev_faa7e410ff15ad5b9d160880de72082c74647af0d738a9065b32a6531e685976`.
- Fonte MCP da comparação: `output/sb2-research/rea-mcp-grids.json`.
- Limitação do provedor: Frida declara identidade de artefato indisponível;
  versão e hashes da ROM/núcleo vêm do MCP. A instrumentação registra o
  caminho da DLL, não prova independentemente seu hash.
- A comparação detectou alteração deliberada de uma célula numa cópia
  temporária do dump. Os quatro testes do worker passaram novamente.
- Frida foi desconectado e o cliente MCP encerrado após o ensaio. Não
  reutilizar os antigos IDs de sessão/PID como se ainda estivessem ativos.

Outro ensaio de desbloqueio, cem pulsos X de três frames ligados/três soltos,
também retornou à arena 1 após dez avanços na seleção. Registro em
`output/sb2-research/unlock-3-3.json`. Não repetir os pulsos 2/2, 3/3 ou
X contínuo sem nova evidência sobre o desbloqueio.

### Avanço: desbloqueio original e dados das 12 arenas

O ensaio limitado de frequências em `output/sb2-research/unlock-rates`
confirmou o desbloqueio com **cem pulsos X de quatro frames pressionados e
quatro soltos**, iniciados 300 frames após restaurar `menu.state`. Os pulsos
1/1, 5/5 e 6/6 usados no mesmo ensaio não o confirmaram. Não atribuir o sucesso
ao simples número de pressionamentos: o intervalo mostrou-se relevante.

- `rate-4.png` mostra STAGE 11; `rate-4.state` está na seleção dessa arena.
- `hidden-initial/select-12.png` mostra STAGE 12 após um avanço à direita.
- `hidden-initial/arena-11.png` e `arena-12.png` mostram partidas em 2:00,
  com estados e WRAM preservados. Não houve patch de ROM/RAM.
- `docs/sb2/SB2-HIDDEN-EXTRACTED-GRIDS.json` preserva as duas capturas; seus
  `capture_ordinal` são 1/2, não números de arena. Os números 11/12 estão
  confirmados pelas seleções e bytes 10/11 da WRAM.
- `docs/sb2/SB2-REA-HIDDEN-GRIDS.json`: leitura REA/Frida durante chamadas MCP.
- `docs/sb2/SB2-REA-HIDDEN-COMPARISON.json`: outras **780 células coincidem**;
  evidência `ev_9f39f0de633679a14f5f1e839c7591cfb8d2237aec3db6b27e7f0b9670606ba7`.
- Total das doze arenas: **4.680 células**, duas grades por arena.

Os dados foram levados ao pacote compartilhado em
`packages/shared/src/sb2-stage-captures.ts`, gerado dos journals MCP por
`emit_stage_captures.py`. Preservam os códigos de piso, os blocos e a grade
de fundo sem fingir que as mecânicas especiais estão implementadas.
Não estão conectados ao seletor ou à criação de partidas ainda.

`sb2-stage-captures.test.ts` confere cada célula desse módulo diretamente
contra os dois bundles REA e verifica as doze seleções. Treze testes novos
e 38 regressões de SB4 passaram, totalizando 51; typecheck compartilhado passou.
O comparador agora exige selecionar a sessão quando um bundle contém
ensaios Frida diferentes e confere o índice original de cada arena.

A [transcrição do manual original](https://www.world-of-nintendo.com/manuals/super_nes/super_bomberman_2.shtml)
foi consultada como roteiro, não como validação dinâmica: gelo e blocos móveis
na 2; túneis na 3; fogo em canaletas na 4; folhas e poder máximo na 5;
teleportes na 6; placas de velocidade na 7; esteiras ajustáveis na 8;
setas para bombas chutadas na 9; salto e travessia de bordas na 10.
As interações e tempos ainda precisam de ensaios por arena, incluindo 11/12.

### Avanço: posições iniciais e movimento nativo

As quatro estruturas de jogadores foram localizadas na WRAM em `0x8000`,
`0x8100`, `0x8200`, `0x8300`. X fica em `+0x10`, sua fração em `+0x12`,
Y em `+0x18`, sua fração em `+0x1A`, todos `uint16` little-endian. A fração
é dividida por 65536. Durante salto, Y inclui a elevação visual: não usar
esse campo isolado como posição de chão.

`rea-motion.js` observou os 256 bytes de cada estrutura durante leituras MCP.
`verify_motion.py` conferiu **234 amostras, 936 estruturas e 239.616 bytes**,
sem divergências nem truncamento. Evidência:
`ev_67648619c804019bae10fe8d6ecec3e581c261249431469bc4b603fba8d70329`.

- Bundle: `docs/sb2/SB2-REA-PLAYER-OBSERVATIONS.json`.
- Comparação e amostras rotuladas: `docs/sb2/SB2-PLAYER-COMPARISON.json`.
- Chamadas e imagens: `output/sb2-research/motion/complete-journal.json`.
- A captura antiga da arena 7 tinha entidades ainda zeradas. A amostragem
  adicional em `arena07-start` encontrou os jogadores inicializados antes
  de os COMs começarem a se mover. Usou-se `offset-100.state` para os spawns;
  os valores das duas grades permaneceram os mesmos da extração anterior.

Na ordem dos jogadores 1/2/3/4, todas as arenas exceto a 4 usam células
`(1,1), (13,11), (13,1), (1,11)`. A arena 4 usa
`(5,5), (9,7), (9,5), (5,7)`. Coordenadas nativas de centro correspondentes
às células são `x=16+16*coluna`, `y=32+16*linha`.

Ensaios dinâmicos confirmados até aqui:

- Arena 1: movimento livre de cinco pixels por quatro frames até colidir com
  um bloco; ao soltar a direção, o jogador permanece na posição.
- Arena 2: aceleração diferente. Após oito frames à direita, X=41; sem
  entrada, passa a 49 e 57 após quatro e oito frames, até colidir em X=64.
  O ensaio comprova inércia, não uma curva completa de desaceleração em pista livre.
- Arena 10: Y+direita produz salto de 32 frames, deslocando 16 px na horizontal.
  Altura máxima observada: 30 px, inclusive frações de quarto de pixel.
  As 32 alturas coincidem com `phase*(31-phase)/8`, em que
  `phase=min(frame,32-frame)`. Isso modela o arco observado, não todas as
  colisões, entradas, direções ou regras de travessia das bordas.
- Arena 11: entrada para a borda esquerda manteve X=32 inicialmente e depois
  lançou o jogador para dentro. Ele continua avançando após soltar a direção.
  Carga, trajetória completa, controle, interação com bombas e colisões pendem.
- Arena 12: nesse ponto inicial, manter Y+direita não produz o salto da arena
  10. Não generalizar essa observação como ausência de salto em toda a arena.

`packages/shared/src/sb2-native-motion.ts` preserva os spawns das doze arenas
e o cálculo do arco nativo observado. Não converte frames PAL em ticks de 60 Hz
nem conecta comportamento incompleto ao jogo. `sb2-native-motion.test.ts`
confronta os spawns e cada altura fracionária com o bundle REA diretamente.
Treze testes novos e os 51 anteriores passaram (64 no total); typecheck passou.

### Avanço: teleportes da arena 6 e canaleta da arena 4

Os novos ensaios usaram **dois jogadores MAN, jogadores 3 e 4 OFF**, por meio
dos menus normais. A tela de configuração está em
`output/sb2-research/two-human-setup/players-after.png`. Estados das arenas
4, 6 e 8 foram preservados em `two-human-arenas`. O da arena 8 está pronto
para investigar as esteiras; não repetir a preparação.

`rea-effects.js` observou duas grades e quatro estruturas de jogadores por
amostra. `verify_effects.py` conferiu **200 amostras: 78.000 células e 204.800
bytes de estruturas**. Nenhuma divergência nem mensagem truncada.

- Bundle: `docs/sb2/SB2-REA-ARENA-EFFECTS.json`.
- Comparação e rótulos: `docs/sb2/SB2-EFFECTS-COMPARISON.json`.
- Chamadas MCP completas: `output/sb2-research/effects/final-journal.json`.
- Evidência: `ev_e58f747559a40e32ab407d84b23002abf31f27dd3d887afc5647ae3a5ce31a79`.

**Arena 6:** vermelho `(3,3) ↔ (11,9)`; azul `(11,3) ↔ (3,9)`.
Ambos tiveram ida e volta observadas. Para alcançar o azul, três bombas
abriram o corredor esquerdo; entradas e retiradas ficaram no journal.
Não foi usada escrita de RAM nem teleporte externo.

Na chegada, a parte inteira da posição é recentrada e as frações são
preservadas. Exemplo: de `(64.5,73)` para `(192.5,177.25)` após um frame
mantendo DOWN; o centro de destino é `(192,176)`, com movimento de 1.25 px
naquele frame. No retorno, a fração `.75` de Y também foi preservada.
O ensaio `warp-lock-arrival`/`warp-lock-idle` manteve a mesma posição por
300 frames sem entrada; depois de sair e entrar de novo, o portal funciona.
Isso não prova ainda a ordem interna completa entre movimento e piso,
condições de ocupação, bombas, jogadores simultâneos ou todas as animações.

**Arena 4:** bomba colocada na célula `(4,5)`; jogador retirado para `(7,7)`.
A explosão tocou a canaleta em `(3,5)` no frame 6489. No frame 6490, suas
28 células estavam no código corrente `1`, com chamas visíveis na captura.
Os 27 pontos sem sobreposição direta da bomba mantiveram essa condição
até 6519 inclusive; em 6520 a canaleta inteira voltou ao código `14`.
Portanto, esta ignição isolada teve atraso de um frame e janela de 30 frames
nativos. A célula do contato da explosão comum restaurou brevemente o piso
no meio dessa janela; não apagar essa observação nem tratar a sobreposição
como completamente modelada.

Um ensaio separado deixou o jogador em `(3,7)`, fora dos eixos da bomba.
A palavra de estado do jogador mudou de `0x9001` para `0x9801` e a partida
entrou em uma sequência com cronômetro parado após a ignição. Isso é
evidência de alteração de estado por contato com a canaleta; a atribuição
dos bits e as regras completas de dano ainda precisam de validação.

`sb2-warp.ts` preserva os pares e o cálculo da posição nativa de chegada.
`sb2-channel.ts` preserva as células e a janela da ignição isolada. Não modelam
reentrada completa, ocupação, reativação nem sobreposição de chamas, e ainda
não estão ligados ao fluxo de partidas. Seis testes novos confrontam esses
componentes com a evidência; 70 testes e typecheck passaram.

### Avanço: esteiras e comandos da arena 8

Reutilizou-se `two-human-arenas/arena-08.state`, com dois MAN e os COMs OFF.
O primeiro percurso pretendia acionar os comandos, mas a esteira carregou
o jogador para o lado. Os rótulos `switch-upper`/`switch-lower` dessa primeira
fase indicam intenção, **não ativação comprovada**. Suas 35 leituras são úteis
para transporte normal do jogador e da bomba.

O percurso corrigido atravessa a esteira sem aguardar e alcança o corredor
central. O comando de código `18`, célula `(7,5)`, inverteu o sentido; o de
código `19`, célula `(7,7)`, alternou a velocidade. A direção e a velocidade
também afetaram o jogador ao entrar na esteira depois, sem bomba presente.
Não são efeitos restritos ao objeto que já estava sendo transportado.

- Velocidade normal observada: `0x8FFF / 65536` px/frame nativo.
- Velocidade rápida: `0x24FFF / 65536` px/frame nativo.
- A incerteza de pixel inteiro do OAM não foi usada para obter essas frações:
  elas vêm das posições fracionárias dos jogadores conferidas no REA.
- Reentradas de duas a cinco vezes no comando inferior alternaram normal/
  rápida. Permanecer no piso não causou uma troca a cada frame.
- A bomba já presente mudou de direção e acelerou, conforme seus sprites
  no buffer OAM em `0x2340`, observado também pelo REA.
- Percursos de 192 frames registraram os quatro cantos nos dois sentidos,
  em velocidade rápida. Estados de retomada: `conveyor/loop-cw-start.state`
  e `loop-ccw-start.state`.
- O alinhamento lateral nos cantos produz movimento em dois eixos durante
  a transição. A implementação e a comparação por frame estão descritas abaixo.

`sb2-conveyor.ts` preserva as duas velocidades exatas, a alternância dos
comandos por entrada, as direções de saída e o alinhamento fracionário.
A conversão do relógio PAL e a ligação com partidas/renderização continuam pendentes.

**Evidência e coleta:**

- `docs/sb2/SB2-REA-CONVEYOR.json`, observação
  `ev_e68746b8fe1dc7ff03e68688504ce6a33c60c30579b68413e035a1c88acd88f0`.
- `docs/sb2/SB2-CONVEYOR-COMPARISON.json`: **196 leituras válidas, 76.440 células
  e 200.704 bytes de jogadores** coincidem; regiões OAM/controle capturadas
  também foram confrontadas byte a byte, sem truncamento.
- Journals usados: `conveyor/switch-journal.json` (35 leituras da primeira
  fase) e `conveyor/loops-journal.json` (161 leituras confirmadas).
- Na primeira tentativa da coleta OAM, reinicializar uma variável no REPL
  deixou o callback ligado à lista anterior, gerando `controls-journal.json`
  vazio. O coletor foi corrigido para `globalThis.sb2ConfirmedBelt`. As
  amostras REA 1–27 dessa fase foram explicitamente excluídas, e o ensaio
  foi repetido com registro válido. O comparador separa tipos e amostras;
  não mistura a tentativa sem journal com o resultado confirmado.
- A região `0x12000` continua candidata, sem semântica de bomba atribuída.
  Uma estrutura em `0x8400` acompanhou a bomba no dump MCP, mas ela ainda
  não foi incluída na captura direta de estruturas de bomba pelo REA.

Cinco testes novos confrontam velocidade normal, velocidade rápida após
cinco entradas, inversão, sprites da bomba e os oito segmentos retos dos
dois circuitos com a evidência. Total: 75 testes e typecheck passaram.

### Trabalho restante após a arena 8

1. Ampliar os ensaios das mecânicas, preservando jogadores, opções e tempo.
   As posições iniciais já foram medidas para as doze arenas.
2. Confrontar as grades extraídas com colisões, bombas e pisos especiais de
   cada arena. Não tratar a coincidência de leitura como semântica completa.
   Na arena 8, usar os estados de `conveyor-corners` para ampliar os ensaios
   de entrada manual, itens e colisões de bombas.
   Validar as condições restantes de teleportes e canaleta antes de integrar
   seus controladores à simulação.
3. Usar os estados já desbloqueados de 11/12 para investigar suas mecânicas;
   não repetir a busca do desbloqueio.
4. Aprofundar observação dinâmica REA/Frida e obter análise estática 65816
   compatível quando necessária. Não repetir a tentativa de PTY Windows.
5. Implementar e validar individualmente as 12 arenas. A tabela de cobertura
   permanece pendente: capturar a partida não equivale a validar a mecânica.
6. Verificar `SB2-SB4-BASELINE.json` e rodar regressões ao alterar gameplay.

### Esteira: alinhamento dos cantos conferido

`sb2NativeConveyorStep` reproduz os percursos livres observados, com precisão
fracionária exata. O piso é consultado em `floor((x-8)/16)`,
`floor((y-25)/16)`. Após o transporte, somente uma mudança na parte inteira
do eixo de avanço provoca correção transversal de 1,25 px para o centro da
faixa. Ao ultrapassar o centro, a correção fixa a parte inteira e preserva a
fração resultante. Isso explica o movimento nos dois eixos durante as curvas.

- Bundle: `SB2-REA-CONVEYOR-ALIGNMENT.json`, evidência
  `ev_de82ca8acab3b29a7a6203936e6596ba52577c00a95ddc50b173623427a78dcd`.
- `SB2-CONVEYOR-ALIGNMENT-COMPARISON.json`: 640 leituras, 2.560 estruturas
  de jogadores, 655.360 bytes iguais entre REA e MCP.
- Journals e estados: `output/sb2-research/conveyor-corners/`.
- Seis testes simulam continuamente cada intervalo observado: dois sentidos,
  duas velocidades e leituras por frame nos primeiros cantos lentos.
- 81 testes passaram, incluindo regressões de SB4; typecheck passou.

Limite: este controlador cobre jogadores sem itens em correia livre.
Entrada manual, obstáculos, colisões entre objetos, bombas e conversão de
frames PAL ainda exigem validação própria. Não está conectado às partidas.

### Arena 7: pisos numerados e imobilização central

Ensaio com dois jogadores MAN e demais desligados, retomável por
`output/sb2-research/gates/initial.state`. Seleção 7 e posições conferidas;
nenhuma escrita de RAM foi usada.

- Primeira travessia do piso esquerdo em `(2,6)`: 1,25 px/frame, sem mudança
  nessa tentativa. Esperar 120 frames depois da passagem ou pressionar A
  fora do piso não alterou esse resultado.
- Ao voltar sobre o piso, a velocidade mudou de 1,25 para 3,5 px/frame no
  frame 6010: X passou de 55,75 para 52,25. A mudança persistiu fora dele.
- Adiar a aproximação em 30 ou 60 frames produziu retorno de 1,25 px/frame;
  atraso de 120 reproduziu o retorno rápido. Isso não estabelece o período
  nem a regra que relaciona números exibidos e velocidade.
- O acesso direto ao centro pela linha 6 encontra um pilar em `(6,6)`.
  O estado chamado `before-skull.state` registra essa aproximação bloqueada;
  o nome era intenção do ensaio e não comprova entrada no piso central.
- A primeira retirada após bomba permaneceu no eixo da explosão e matou o
  jogador. A segunda usou abrigo no corredor lateral. Nenhuma dessas
  tentativas foi usada como prova do efeito do piso central.
- A entrada válida contornou o pilar pela linha 7, sem bomba. Estado de
  retomada: `below-center.state`. UP levou P1 a `(128,25;136,75)` no frame
  6076; a posição permaneceu igual de 6077 a 6203, mesmo mantendo DOWN
  durante a maior parte do intervalo. São 127 frames imóveis nesse ensaio.
- A coleta fina revelou movimento para cima no frame 6204, até Y=135,5,
  apesar de DOWN estar mantido. No frame 6205 passou a descer, até Y=136,75.
  O intervalo de quatro frames da primeira coleta escondia esse detalhe.
  Não substituir essa observação por uma regra de recuperação já validada.

Evidência `SB2-REA-NUMBERED-PADS.json`, registro
`ev_0df1cbf6665fff6f95807d27937fbc0512d916742eb96d323da108b40ca537de`.
Comparação `SB2-NUMBERED-PADS-COMPARISON.json`: 168 leituras, 65.520 células
mais 172.032 bytes de jogadores iguais entre REA e MCP, sem truncamento.
Journal cumulativo validado: `gates/verified-journal.json`.

Pendente: regra dos números, acionamento/reentrada, duração em outras
condições, bombas durante imobilização e integração à simulação. Não foi
adicionado controlador de arena 7 baseado em suposições.

### Arena 7: cinco velocidades e escolha do próximo número

A varredura de 120 instantes de entrada separou o efeito atual do número
preparado para a passagem seguinte. A primeira entrada usa o 3 inicial e
mantém 1,25 px/frame; a volta aplica o número que ficou visível depois dela.
Em cinco ensaios, aguardar 120 frames sobre a placa não repetiu o efeito
nem mudou sua indicação. O número sorteado pode repetir o anterior.

| Número da placa antes da entrada | Pixels por frame nativo | Índice nativo observado |
| --- | --- | --- |
| 1 | 0,375 | 9 |
| 2 | 0,8125 | 7 |
| 3 | 1,25 | 1 |
| 4 | 3 | 6 |
| 5 | 3,5 | 10 |

`sb2-numbered-pad.ts` preserva essas velocidades e a tabela de seleção
`[1,2,3,4,5,5,4,3]`, indexada por `(randomWord & 0x000e) >> 1`.
A palavra de entrada corresponde à RAM `0x0400` antes do frame de entrada;
a palavra posterior já não é uma substituição equivalente. O gerador global
que produz essa palavra e sua integração ao relógio da partida estão pendentes.
Não presumir uma distribuição uniforme entre os cinco números.

**Corroboração estática:** os bytes da ROM em `0x5e859` associam seis glifos
aos índices de efeito; o sexto é a pausa. Em `0x5e871` ficam as oito entradas
da escolha. O trecho em `0x4ca1–0x4d32` busca o efeito pelo glifo atual e,
para os números, lê `0x0400`, aplica a máscara `0x000e` e usa a tabela de
próximos glifos. O glifo da pausa é excluído dessa troca. Os recortes e o hash
da ROM estão em `SB2-PAD-ROM-TABLES.json`. Esta é decodificação manual parcial
65816, não decompilação REA. A sequência aleatória global não foi reconstruída.

**Validação dinâmica REA + MCP, sem alteração de RAM:**

- `SB2-REA-PAD-CYCLE.json`, registro
  `ev_91f76408153771c27b57da1466387a5aa0fb985d9d4fc4a5e0776b0f605e1fbb`:
  268 leituras, incluindo a varredura e a terceira passagem. Comparação
  `SB2-PAD-CYCLE-COMPARISON.json`: 104.520 células e 274.432 bytes de jogadores.
- `SB2-REA-PAD-GLYPHS.json`, registro
  `ev_9c99d1e37049ee5c037a09638e14b7eb4b5e9e37e90cbd949456e1bc38471b3f`:
  cinco números, antes/depois, espera e mais quatro frames de movimento.
  Comparação `SB2-PAD-GLYPHS-COMPARISON.json`: 25 leituras, 9.750 células,
  25.600 bytes de jogadores e 50 palavras dos glifos coincidentes.
- `SB2-REA-PAD-CHOICE.json`, registro
  `ev_f8b4bd73a814dcbb27acde4615b3b76129938edea67110548ead9eef66cf475f`:
  64 entradas com leitura imediatamente antes/depois, cobrindo os oito índices.
  Comparação `SB2-PAD-CHOICE-COMPARISON.json`: 128 leituras, 49.920 células,
  131.072 bytes de jogadores, 256 palavras dos glifos e a palavra aleatória
  de cada leitura conferidos. Todas as 64 escolhas coincidem com o controlador.
- Journals e imagens: `output/sb2-research/pad-cycle/`. O comparador seleciona
  o script explicitamente quando o bundle retém observações de scripts anteriores;
  nenhuma amostra antiga é misturada ao journal da etapa seguinte.

Seis testes conferem as cinco velocidades contra bytes nativos, o deslocamento
no frame de entrada e nos quatro frames posteriores, a permanência de 120
frames e as 64 escolhas. Ainda não há integração da arena 7 às partidas.
A placa direita, outros jogadores, bombas, itens e a pausa central precisam de
ensaios adicionais. A reprodução do gerador e a adaptação PAL/60 Hz continuam
necessárias antes de declarar a arena fiel.

O manual de instruções descreve as placas numeradas e a imobilização central;
essa descrição orienta os ensaios, mas não substitui suas medidas:
https://www.world-of-nintendo.com/manuals/super_nes/super_bomberman_2.shtml

Validação final desta etapa: 87 testes focados passaram e typecheck passou.
Os 371 artefatos do manifesto foram conferidos por SHA-256, sem divergências.
Os 37 arquivos da referência SB4 permanecem idênticos. Alterações paralelas
em `packages/shared/src/bot.ts` e `packages/shared/test/bot-conveyor.test.ts`
foram preservadas e não pertencem a esta etapa. Nenhum commit ou push realizado.

### Arena 7: pausa central, comando guardado e placa direita — 01/11/2026

`sb2-pause-panel.ts` implementa o bloqueio de comandos durante 127 frames
nativos PAL, contando a entrada como frame zero. No frame 127 executa uma
vez o comando recebido no próprio frame de entrada; do frame 128 em diante
consulta o comando atual. Usa o subconjunto `dir`/`bomb` do `PlayerInput`
existente. Não define efeitos para os especiais de personagem do Bombtop.
O retorno `null` bloqueia comandos; não pode interromper o processamento de dano.

**Comportamentos conferidos:**

- UP na entrada, DOWN durante a pausa: primeira liberação ainda sobe 1,25 px;
  o frame seguinte desce. O mesmo ocorre ao ficar neutro durante o bloqueio.
- DOWN escolhido no próprio frame de entrada: a primeira liberação já desce.
  Comando neutro na entrada não causa aquele passo residual para cima.
- A pressionado somente no frame de entrada: não planta durante o bloqueio,
  mas planta na liberação, mesmo sem A mantido. Se A começar somente depois
  da entrada, a bomba aparece no frame 128, após o comando guardado ser usado.
- Sair e reentrar reinicia o bloqueio de 127 frames. Permanecer no piso depois
  da liberação não o reaplica: foram observados 180 frames com UP e mais 300
  neutros. A primeira tentativa de reentrada tinha rótulos um frame adiantados;
  a coleta `confirmed-reentry-*` mede o acionamento real em 6220 e a liberação
  em 6347. Os rótulos antigos são intenção do ensaio e não redefinem o evento.
- O contador em `+0xce` vai de 127 a 1 enquanto a flag `0x08` em `+0x0e`
  está ativa. O campo `+0x0c` também atende à animação e pode conter 255 após
  entrada neutra: isso não prolonga a pausa. O contador `+0xce` conserva 1
  depois da liberação; não interpretar esse valor isoladamente como pausa ativa.
- Uma bomba colocada antes da entrada gerou fogo central no frame 6215 e
  mudou o jogador de estado `0x9002` para `0x9802` em 6216, ainda durante o
  intervalo de bloqueio. A pausa não concede proteção contra explosões.
- Após outra explosão e a retirada para um abrigo, o piso central voltou a
  código 15 e seu glifo a `0x1c4a`; o efeito não foi removido pela bomba.

**Placa direita:** os cinco números aplicaram as mesmas velocidades da placa
esquerda e usaram a mesma tabela para a próxima indicação. A placa esquerda
ficou em 3 e o piso central preservou o glifo de pausa durante esses ensaios.
Aguardar 120 frames sobre a placa direita não repetiu a troca nem o efeito.

O primeiro ensaio de variação temporal restaurava o jogador em X=215,75:
embora o acionamento ainda estivesse pendente, esse ponto já pertencia à
célula da placa. A espera a acionava no primeiro frame e repetia o mesmo
resultado. A causa foi corrigida retomando em X=224,5, fora da placa, antes
de variar a espera. A coleta `confirmed-right-*` cobre os cinco resultados;
as 32 travessias repetidas anteriores foram preservadas e identificadas.

**Evidência e reprodução:**

- `SB2-REA-PAUSE-PANEL.json`, registro
  `ev_2a774b4f1b525b4bd0cfa8e206ffc88deaaf61ef3fa62742806928c6d331e29e`:
  163 leituras, 63.570 células, 166.912 bytes de jogadores e 978 palavras de
  glifos conferidos. Journal `pause-and-route-journal.json`.
- `SB2-REA-STAGE7-PANELS.json`, registro final
  `ev_a283aff21e242dba0a0010fdc479d43afab1b6ee04645e3699837a96c678210d`:
  281 leituras, 109.590 células, 287.744 bytes de jogadores e 1.686 palavras
  de glifos conferidos. Journal `final-panels-journal.json`. O bundle também
  conserva o registro intermediário usado na comparação anterior.
- Comparadores: `SB2-PAUSE-PANEL-COMPARISON.json` e
  `SB2-STAGE7-PANELS-FINAL-COMPARISON.json`. Ambos selecionam o script
  correspondente explicitamente; não há mensagens truncadas.
- Estados em `output/sb2-research/pause-panel/`: `before-entry.state`,
  `entered.state` e `outside-right.state`. O segundo serve para repetir o
  bloqueio; o terceiro permite variar o instante da entrada direita.
- 16 testes novos confrontam o controlador com as trajetórias e eventos
  nativos, incluindo os comandos de entrada e posteriores, os cinco números
  direitos, a escolha seguinte, a reentrada e o dano. Total: 103 testes focados
  passaram; typecheck passou.

Limites restantes: interação com outros jogadores e itens, conversão do relógio
PAL e integração ao gameplay/renderização. O controlador é uma implementação
isolada; a arena 7 ainda não está disponível nas partidas.

### Relógio nativo PAL e conversão para ticks de 60 Hz — 01/11/2026

A ponte de pesquisa passou a expor `native_timing` nos metadados. A leitura
nativa retornou região PAL, `50.006978908188586` frames/s e taxa de áudio de
32.040 amostras/s. REA observou diretamente duas respostas AV da DLL e uma
resposta de região; o MCP preservou três observações de metadados coincidentes.
Isso valida a taxa declarada pelo núcleo, não o ritmo do relógio de parede.
Não houve reprodução nem validação de áudio.

A razão é `21281370 / 425568`, também presente no código da revisão `fae2fea`
do Snes9x carregado. Fonte primária consultada:
https://raw.githubusercontent.com/snes9xgit/snes9x/fae2fea/libretro/libretro.cpp
Função `retro_get_system_av_info`, linha 1065 nessa revisão.

`sb2-native-clock.ts` converte o tempo da simulação em quantidade inteira de
passos PAL usando `BigInt` e o `TICK_RATE` existente. A origem tem fase zero;
após N ticks, o número de passos é o piso da razão exata de tempos. Cada tick
consulta a diferença para o anterior, preservando a fase sem acumuladores
fracionários. Retomadas devem conservar o número de ticks decorridos desde
a origem da arena, em vez de reiniciar a fase.

- O primeiro segundo de 60 ticks executa 50 passos nativos.
- Após 180 segundos são 9.001 passos: arredondar permanentemente para 50 Hz
  já perderia um frame nessa duração.
- O teste de pausa usa os passos PAL para preservar o frame de liberação e
  o comando guardado. Os dois circuitos rápidos da esteira também coincidem
  com os percursos REA quando avançados pelos ticks convertidos.
- Os testes conferem contagens até 24 horas e a continuidade após retomada.
  Não são medições de 24 horas de execução do emulador.

Evidência `SB2-REA-NATIVE-CLOCK.json`, registro
`ev_6657db47291efd185a0dd7f8bbdff234d2fb4d1cfadb33f705a5fed199253cfe`;
comparação `SB2-NATIVE-CLOCK-COMPARISON.json`; journal em
`output/sb2-research/native-clock/journal.json`. A identidade por hash da DLL
e da ROM vem do host MCP; o observador REA confere a ABI do módulo carregado,
sem substituir a verificação independente de identidade do artefato.

Seis testes do relógio passaram, assim como os cinco testes do host com o
núcleo real (replay de RAM/pixels, limites, proteção de estados e taxa PAL).
Typecheck passou. A conversão está implementada e testada junto dos
controladores medidos, mas ainda não foi ligada ao loop das partidas.
Entrada do usuário entre ticks sem passo PAL precisará ser preservada na
integração; interpolação visual, áudio e sincronização de rede continuam pendentes.

Fechamento da etapa: 109 testes focados e os cinco testes nativos do host
passaram; typecheck passou. Os 398 artefatos do manifesto conferem por hash;
os 37 arquivos da referência SB4 permanecem idênticos. Sem commit nem push.

### Composição dos pisos com o movimento real do MatchState

`sb2-stage7-controller.ts` compõe a fase PAL, as duas placas numeradas e a
pausa em um estado serializável. `advanceSb2Stage7Controller` usa os campos
`id`, `px`, `py` e `alive` do jogador existente. A função
`advanceSb2Stage7Movement` aplica sua saída aos jogadores do `MatchState`,
atualiza a direção e chama o movimento manual nativo. A bomba permanece uma
saída de comando para o loop; o adaptador não cria bombas com o fuse genérico.

- A fase PAL é única para a arena e preservada na serialização.
- As indicações das placas são compartilhadas no controlador; velocidade,
  última célula e comando guardado pertencem a cada jogador.
- Cada nova entrada numerada consome uma palavra do fornecedor de sorteio,
  aplica a indicação anterior e atualiza somente aquela placa.
- Ticks sem passo PAL não movimentam os jogadores. Um evento `bomb` do
  Bombtop recebido nesses ticks fica pendente até o próximo passo elegível
  e é consumido uma vez. Isso adapta o evento por tick da API existente;
  não é uma alegação de retenção de pulsos entre leituras do controle SNES.
- Durante o bloqueio da pausa, novos toques são descartados. O comando da
  entrada é usado uma vez na liberação; depois volta o comando atual.
- Jogador morto deixa de emitir comandos e perde suas pendências; o relógio
  da arena continua. Processamento de dano não faz parte dessa suspensão.
- Snapshot JSON preservou fase, comando guardado e evento ainda pendente.

#### Alinhamento e colisão: nova coleta necessária para integrar

A aplicação direta do movimento genérico alterava as trajetórias: esse código
consome o orçamento de avanço na correção lateral e limita a posição ao centro
exato. O SB2 observado corrige também o eixo transversal e preserva a fração
quando a parte inteira encontra uma parede. O movimento existente não foi
alterado; `sb2-movement.ts` implementa o caminho SB2 e reutiliza
`canPlayerEnterTile` para consultar a grade e os bloqueios do Bombtop.

A coleta por frame estabeleceu, nos ensaios:

1. Em faixa livre, o avanço mantém a velocidade nativa completa. Quando a
   parte inteira do eixo de avanço muda, ocorre a correção transversal com
   orçamento próprio. Isso explica o deslocamento simultâneo nos dois eixos.
2. O intervalo de alinhamento observado vai do centro até um pixel depois
   dele. Exemplo: X=95,75 avança lateralmente até 97 ao entrar na faixa de
   centro 96; X=129,5 corrige até 128,25 para a faixa de centro 128.
3. A 0,375 px/frame, a correção transversal só acompanha mudanças de pixel
   inteiro no eixo principal; não deve ser aplicada indiscriminadamente.
4. Num canto bloqueado com faixa adjacente livre, o personagem corrige
   primeiro lateralmente, sem avançar contra o pilar. Ao alcançar a faixa
   livre volta a avançar nos dois eixos quando necessário.
5. Contra um bloqueio, a parte inteira é limitada ao centro, preservando
   a fração da tentativa de avanço. As quatro bordas confirmaram a regra.
6. A consulta da linha usa Y-25, inclusive na passagem horizontal pelo canto.
   O ensaio `horizontal-corner` começou a avançar em X a partir de Y=120,5;
   consultar Y-24 atrasava essa passagem em um frame.

As capturas adicionais foram feitas pelo MCP real no mesmo Snes9x, com REA
observando as quatro estruturas de jogadores. A ROM e a DLL mantêm os hashes
registrados. Nenhuma alteração de ROM ou WRAM foi usada.

- Bundle: `SB2-REA-MANUAL-MOTION.json`.
- Registro final: `ev_2fd824f001925f64b5baf1f3d4e6d6ddef943dbbc6106260bbbbd6fc0fa55d14`.
- Comparação final: `SB2-MANUAL-MOTION-FINAL-COMPARISON.json`: **239 leituras,
  956 estruturas e 244.736 bytes de jogadores coincidentes**, sem truncamento.
- Journal final: `output/sb2-research/manual-motion/all-journal.json`.
- O registro anterior de 204 leituras continua no bundle e na comparação
  intermediária. Somente o registro final é usado pelos testes completos.

`sb2-movement.test.ts` reproduz continuamente as 23 trajetórias sobre um
`MatchState` real, com os bloqueios da grade capturada, avançando o controlador
a 60 Hz. Todas as posições nativas coincidem, inclusive velocidades lenta,
normal e rápida. Mais quatro testes compõem essa colisão com a pausa central,
comandos opostos/neutros/bomba e permanência depois da liberação.

`sb2-stage7-controller.test.ts` verifica 15 casos de composição: trajetórias
de pausa, ida/reentrada direita nos cinco números, fornecedor de sorteio,
toque curto, descarte durante bloqueio, serialização e morte. Esses testes
não substituem validação das interações multiplayer ou do gerador global.

**Limite atual:** o adaptador é chamado pelos ensaios sobre o `MatchState`,
mas ainda não por `step.ts` nem pela sala em produção. A inicialização usada
nos testes é uma fixture explícita da grade capturada, com jogadores do
criador de partidas existente; não constitui inicialização completa de SB2.
Itens, fuse/chamas, chutes, empurrões, colisões adicionais, demais mecânicas,
animações e renderização continuam necessários. Nenhuma arena incompleta foi
adicionada ao seletor. A mudança não altera o movimento usado por SB4.

Validação final da composição: 151 testes focados passaram, incluindo as
regressões selecionadas de SB4; typecheck passou. Os 403 artefatos do manifesto
conferem por SHA-256, e os 37 arquivos da referência SB4 permanecem idênticos.
As sessões nativas foram encerradas após a exportação. Sem commit nem push.

### Arena 1 ligada ao step real: fuse, chamas, bloco e dano

O ID interno `sb2-01` agora atravessa `buildStage`, `createMatch`, `movePlayer`
e `step`. Ele continua fora de `SELECTABLE_STAGES` e da validação de rotação
pública. A criação interna exige contagens explícitas de itens: a bolsa
original ainda não foi mapeada e não foi substituída pela de SB4 nem por
probabilidades inventadas. Os ensaios usam `maniacItems: {}` para isolar física.
Isso não representa a distribuição normal de itens do jogo original.

**Mudanças no caminho de simulação:**

- `sb2-stage.ts` decodifica a grade capturada de 15x13, preserva o estado da
  fase PAL e retém os eventos de botão entre ticks sem atualização nativa.
- O criador usa as quatro posições SB2 e rejeita uma quinta posição nesse
  ID. A velocidade base usada pelo movimento nativo é 20 unidades fixas,
  equivalente a 1,25 px por atualização PAL. O alcance inicial medido é 2.
- `sb2Coordinates` identifica o ponto de consulta Y-25 nos jogadores SB2;
  `playerTile` aplica esse deslocamento somente a esses jogadores. A posição
  do sprite não é deslocada. Isso também evita plantar na célula errada na
  borda inferior do piso, caso observado durante os ensaios da pausa.
- `step` incrementa o tick de 60 Hz e executa a atualização de física apenas
  nos passos PAL. A entrada retida e a fase fazem parte do estado serializado.
  Os caminhos clássico e SB4 não usam esse desvio.
- `movePlayer` despacha o SB2 para o movimento nativo já confrontado; o
  algoritmo anterior permanece em uso pelos mapas anteriores.
- Fuse normal: **144 frames após colocação em fase par e 145 em fase ímpar**
  do contador nativo `0x32`. O frame de colocação não consome um frame extra
  no contador do Bombtop. Não arredondar esse fuse para um valor único.
- Chama em célula livre: 26 frames. Bloco atingido: continua sólido por 35
  frames antes de liberar a célula. Não usar a duração da chama para liberar
  antecipadamente o bloco. O aparecimento do item na ROM confirma a fronteira
  de colisão; a identidade/distribuição desse item não foi comparada no motor.
- O contato com fogo é amostrado antes do movimento e resolvido depois dele.
  Assim, entrar na chama só produz morte na atualização seguinte; tentar sair
  no primeiro frame de dano ainda pode deslocar a posição antes de morrer.
  As chamas criadas na atualização atual não matam retroativamente nela.

**Novas observações nativas:**

A arena 1 foi preparada pela seleção já desbloqueada e pelo estado existente
de dois humanos, sem COM. A grade antes da bomba coincidiu célula a célula
com a primeira captura antiga, apesar da outra preparação de jogadores/menu.
A bomba foi colocada em `(1,2)`, e P1 escapou para `(2,1)`. Houve leituras por
frame até o desaparecimento da chama e a remoção do bloco em `(1,4)`.
Aumentar a espera anterior em um frame revelou a fase de 145, em vez de 144.
As esperas de 0, 1, 2 e 3 frames confirmaram os dois resultados alternados.

Os ensaios `stay`, `enter-fire` e `leave-fire` separaram amostragem de contato
e deslocamento. No último, P1 saiu de X=39,5 para X=40,75 no mesmo frame em
que passou a estado morto; no de entrada, atravessou de X=40,75 para X=39,5
vivo e morreu no seguinte. Esses dados impediram implementar dano simplesmente
antes de mover ou sobre a célula posterior ao movimento.

- Bundle: `SB2-REA-BOMB-CORE.json`.
- Coleta contínua: registro
  `ev_2d5fd38149c8f37530891444c2e2c42ac03c13018e94b5a1a61bcf6dcab37842`,
  script `0732887e-47c0-44f7-b590-419005297ba4`, 212 leituras.
  Comparação `SB2-BOMB-TIMING-COMPARISON.json`.
- Ensaio ímpar preliminar: registro
  `ev_abecd1911bcb110641df135495b18830a95d0fdcfc32ccff42c3674e0ddb73fa`,
  script `671f969a-b481-4720-894b-74253c71747f`, 16 leituras.
  Comparação `SB2-BOMB-ODD-COMPARISON.json`.
- Quatro fases e três ensaios de dano: registro
  `ev_6475e88e6ab6692fa7eb748e48d85407800857e048fb53ffef4e52c0ef60707f`,
  script `27726693-2843-47da-8ff5-2d8d45d0caa9`, 76 leituras.
  Comparação `SB2-BOMB-PHASE-COMPARISON.json`.
- Total: 304 leituras válidas, 118.560 células e 311.296 bytes de jogadores
  coincidentes. As regiões candidatas das duas últimas coletas também foram
  confrontadas. Sem truncamento; os scripts são selecionados explicitamente.
- Journals, imagens e estados: `output/sb2-research/bomb-timing/`.
  `before-bomb.state` permite repetir a colocação e variar a fase.

Os quatro slots `0x8400..0x87ff` não mudaram ao colocar essa bomba. Não foram
classificados como estruturas de bomba. A região `0x12000` mudou com a
colocação, o fuse e a explosão, mas sua estrutura completa ainda não foi
identificada. O núcleo pode renderizar a imagem anterior ao estado lógico
lido ao fim de um frame; a duração de dano foi medida pela grade e pelos
jogadores, sem tratar um screenshot isolado como prova da janela letal.

**Validação da implementação:** `sb2-step.test.ts` chama o `step` público,
não uma simulação simplificada. Onze testes cobrem a criação com quatro
posições REA, os 211 frames desde a colocação, as quatro fases, as três
situações de dano, restauração JSON e os limites do ID interno. As comparações
conferem posição, vida, bombas, fogo em células livres e grade de colisão.
Não comparam o tipo do item revelado nem a animação completa de destruição.

`pnpm test` executou 1.160 testes do compartilhado, todos aprovados, incluindo
as regressões de SB4. No cliente, 1.253 de 1.254 testes passaram; a falha foi
`naruto-recolor.test.ts`, na reprodução da máscara dos olhos. A extração dos
três arquivos diretamente do HEAD `6903f1b100f4eef5f53fdcd322d6cd2f674c8037`
reproduziu a mesma falha. Os três hashes são idênticos aos do checkout, e
nenhum arquivo de arte foi alterado. Evidência em `SB2-BASELINE-NARUTO-CHECK.json`.
O cache da execução do servidor registra as sete suítes sem falhas.
`pnpm typecheck` passou no compartilhado, cliente e servidor. Depois da última
adição do teste de spawn, os onze testes SB2 e 54 regressões relevantes SB4
passaram novamente; typecheck do compartilhado também passou.

A regressão global continua vermelha pela falha preexistente de Naruto;
não foi desabilitada nem contornada. A integração SB2 alterou funções comuns
por condições explícitas de estágio; o baseline de hashes agora identifica
essas alterações intencionais e exige regressão funcional, em vez de afirmar
que todos os arquivos antigos continuam byte a byte iguais.

**Ponto de continuação:** investigar capacidade na janela anterior à explosão,
reações em cadeia, itens/bolsa nativa e o relógio da partida; então completar
a inicialização e renderização antes de liberar a arena 1 no seletor.
Os efeitos e demais arenas continuam no objetivo, sem serem tratados como
concluídos por esta integração da física base. Os especiais, montarias,
maldições e pressão do Bombtop sob o passo PAL também precisam de validação.

Auditoria ao fim desta etapa: 426 artefatos do manifesto conferidos por
SHA-256, sem divergências; `git diff --check` passou. Dos 37 arquivos do
baseline, somente `arena.ts` e `stage.ts` mudaram, ambos para o caminho SB2;
os arquivos específicos de SB4 continuam idênticos. Oito arquivos comuns
foram alterados no total, com regressões funcionais executadas. Registro em
`SB2-SB4-INTEGRATION-CHECK.json`. As sessões nativas foram encerradas após
exportar a evidência. Nenhum commit nem push foi realizado.

## Bolsa de itens, coletas e capacidade — 2026-11-01

Sessão Snes9x MCP com dois MAN e COMs desligados. O REA observou a RAM por
Frida, sem escrita de memória. Os registros completos estão em
`SB2-REA-ITEMS.json`; os quatro relatórios `SB2-ITEM-*-COMPARISON.json`
identificam os scripts e registros exatos. O comparador de inicialização
conferiu 780 palavras (64 entradas e terminador em cada uma das 12 arenas).
Os demais comparadores conferiram 87 leituras independentes MCP/REA de
grades, jogadores e regiões candidatas, incluindo 14 glifos de itens.

A bolsa fica em `0x3c48`: 64 palavras seguidas de `0xffff`. `0x8000`
representa uma entrada sem item; zero representa uma entrada já consumida.
A rotina C0DE24 percorre a primeira entrada não zero e a consome ao revelar
o resultado de um bloco. Destruir primeiro outro bloco revelou o mesmo
Bomb Up. Atrasar a primeira colocação em 0, 1, 2, 3, 4, 7, 13 ou 29 frames
também preservou o primeiro item. Estes ensaios sustentam uma bolsa global,
em vez de itens previamente associados a cada coordenada.

Na sequência observada, Bomb Up (`0x1600`) aumentou a capacidade nativa
`0x80e1` de 1 para 2, espelhada em `0x80f1`, ao cruzar a célula na descida
33. Fire Up (`0x1602`) aumentou `0x80e2` e `0x80e4` de 1 para 2 na descida
46. A terceira entrada `0x8000` foi consumida sem revelar item. Os glifos
usam o mapa gráfico `0x1a0c2 + y*64 + x*2`, confrontado com a RAM completa.
Essas observações não validam todos os efeitos dos outros glifos.

As tabelas foram extraídas da ROM verificada em `SB2-ITEM-ROM-TABLES.json`:
16 glifos em offset `0x5f205`, ponteiros em `0x5f225` e 16 contagens por
arena com terminador. A ordem interna, lida em `0x1a`, difere da seleção:
`[0,1,2,5,6,7,8,9,10,11,4,3]`. Os totais de itens são, respectivamente,
`[25,24,22,20,19,24,17,26,25,27,11,25]`; o restante das 64 posições é vazio.

A rotina C01CF2 sorteia posições vagas, com novas chamadas também ao mudar
de glifo, atravessar contagens zero e encontrar o terminador. O RNG C00CAA
usa `nextSeed = ((seed | 1) * 0x383) & 0xffff` e
`word = floor(nextSeed * (seed & 255) / 65536)`. A implementação reutiliza
o LCG existente de SB4, sem modificá-lo, e reproduz as 64 entradas de todas
as 12 bolsas observadas. Após gerar a bolsa, uma chamada inicial mais uma
por frame da fase reproduzem exatamente a semente e a palavra em `0x400`
de cada captura MCP. A inicialização pode atravessar vários `retro_run`;
a semente da última mutação da bolsa não foi confundida com a de retorno.

Na arena 1 com capacidade 1, tentativas da segunda bomba nos frames
138–142 após a primeira falharam; 143–145 funcionaram. A primeira chama
começou no 144. O `placeBomb` agora libera a capacidade de bomba normal
SB2 quando faltam dois frames, mantendo sua colisão até a explosão.
Oito testes executam o `step` real e confrontam os estados anteriores e
posteriores com as capturas nativas. Os 14 testes da bolsa conferem todas
as entradas, contagens, estados RNG finais e consumo até esgotamento.

Verificação desta etapa: 105 arquivos / 1.183 testes do compartilhado
aprovados; typecheck do compartilhado aprovado. A falha preexistente de
Naruto e o resultado global anterior continuam documentados acima; os
testes do cliente não foram reexecutados nesta etapa sem alterações nele.
Nenhum commit nem push foi realizado.

**Continuação:** `sb2-item-bag.ts` está validado isoladamente, mas ainda não
alimenta a geração/revelação padrão da partida. O ID interno da arena 1
continua exigindo configuração explícita de itens e fora do seletor.
Investigar os demais efeitos, limites, Skull/maldições e ordem de revelação
simultânea, integrar a bolsa e validar reações em cadeia/relógio. Os efeitos
especiais, a renderização e a disponibilidade das 12 arenas permanecem
pendentes; a bolsa validada não significa que o objetivo inteiro terminou.

## Reação em cadeia entre bombas normais — 2026-11-01

Partindo do estado nativo após as duas coletas, com capacidade 2 e alcance
3, foram colocadas bombas em `(1,6)` e `(1,4)`, separadas por 27 frames.
A primeira começou o fogo no frame 145; a segunda manteve código de bomba
e colisão por quatro frames, explodindo no 149. A chama inicial parou na
bomba atingida, sem tornar sua célula letal durante esse intervalo.

O ensaio adjacente usou `(1,6)` e `(1,5)`, com 14 frames entre colocações.
Na fase ímpar, fogo em 145 e cadeia em 149; após atrasar a primeira colocação
um frame, fogo em 144 e cadeia em 148. O atraso de quatro frames permaneceu.
As células sobrepostas conservaram a duração original: na primeira fase,
o fogo antigo saiu em 171 e o novo em 175. O bloco `(1,7)` terminou de
queimar em 180, sem reiniciar seus 35 frames após a segunda explosão.

`SB2-REA-CHAIN.json` conserva a observação REA da sessão
`da71a480-b1b7-49d8-b84c-f3fbbe9792c6`. `SB2-CHAIN-COMPARISON.json` confronta
145 leituras MCP/REA, 56.550 células de grade e 148.480 bytes de jogadores.
Os três cenários adicionais em `sb2-step.test.ts` chamam o `step` público e
conferem cada ponto capturado, incluindo posições, vida, bombas, fogo e
colisão. O cenário escavado, a capacidade e o alcance são restaurados dos
ensaios; esses testes não apresentam a geração padrão de itens como pronta.

O caminho SB2 de bombas normais agora reduz o fuse da bomba atingida para
no máximo quatro frames, mantém sua célula sem fogo e não reinicia uma
chama já ativa. O caminho anterior de busca/encadeamento dos outros estágios
foi preservado. Bombas especiais, contato de bomba recém-colocada com fogo,
crédito de dano em sobreposição e cadeias entre mais de duas bombas ainda
precisam de ensaios próprios. O percurso observado não distingue se um
braço pode atravessar fogo antigo para atingir células novas além dele.

Após essas alterações, 1.186 testes em 105 arquivos do compartilhado
passaram; typecheck passou. Depois de restringir a nova busca de contato ao
caminho SB2, 112 testes relevantes passaram novamente. A sessão Frida foi
encerrada após exportação, seguida do fechamento do cliente MCP. Objetivo
das 12 arenas ainda em andamento, sem commit ou push.

## Integração da bolsa, inventário e Skull — 2026-11-01

A arena 1, ainda somente pelo ID interno `sb2-01`, passou a criar sua bolsa
nativa por padrão. A configuração explícita de itens continua usando o
Maniac do Bombtop. O fluxo normal não associa itens a coordenadas antes da
partida: ao terminar a queima de cada bloco, consome a próxima entrada da
bolsa e revela o item. A ordem observada dos braços é cima, baixo, direita,
esquerda. O caso com blocos nos dois lados de `(3,7)` distinguiu direita de
esquerda; uma primeira hipótese com esquerda antes de direita foi rejeitada.

`sb2-items.ts` liga bolsa, RNG e coleta ao `createMatch`, `step`, `updateBombs`
e `collectItems`. A bolsa e os estados RNG são dados serializáveis. Há uma
chamada inicial após a criação da bolsa e uma por atualização PAL, ao fim
do passo; coletas usam a palavra disponível na entrada do frame. O teste
de restauração JSON atravessa explosão e revelação sem divergir.

Os percursos do original foram feitos por comandos MCP, sem escrita de RAM,
com `native-pickup-probe.mjs`. `SB2-PICKUPS-COMPARISON.json` confere 293
leituras; `SB2-PICKUPS-TWO-PADS-COMPARISON.json`, 457; `SB2-SKULL-COMPARISON.json`,
446; `SB2-PICKUP-MOTION-COMPARISON.json`, 20. Os bundles completos conservam
os IDs dos registros e scripts. Esses totais incluem repetições, preparação
e leituras finais; não representam arenas adicionais certificadas.

O primeiro percurso terminou na tela de placar quando o segundo MAN parado
foi atingido pelo fechamento da arena. O congelamento do contador foi
confirmado visualmente; não foi tratado como bloqueio de movimento. A ponte
foi ampliada para `buttons2`, com controles independentes nos ports 0 e 1.
Seis testes do host nativo passaram, incluindo movimento exclusivo de P2,
liberação do botão e reprodução idêntica após restaurar um estado. Na segunda
sessão, P2 foi movido para o interior pelos controles SNES. Nenhuma memória
foi alterada para evitar o fechamento.

Os itens comuns observados:

- Bomb Up aumentou a capacidade até 8 no percurso; o limite 9 vem da rotina
  C098C2 da ROM, sem afirmar que o percurso alcançou esse limite.
- Fire Up aumentou o índice de alcance; o alcance em células é índice + 1.
  A rotina limita o índice a 9, ou alcance 10.
- Speed Up percorreu `1,25 → 1,5 → 2 → 2,5 → 2,75` px/frame PAL. A tabela
  C5FB07 inclui também `0,5` e `3`, usados pelos modos lento e rápido do Skull.
  O incremento de inventário é limitado ao índice 5 pela rotina C09B58.
- Kick incrementou `0x80fe`; Glove incrementou `0x80ff`, inclusive em coletas
  repetidas. A implementação inicial usa os booleanos/habilidades existentes.
  Isso não certifica a movimentação de bombas nem o descarte das duplicatas.

`SB2-NATIVE-PICKUP-REPLAY.json` é uma redução das capturas já confrontadas com
REA, gerada por `extract_pickup_replay.py`. O teste executa os controles de
15 escavações pelo `step` público, conferindo 220 pontos: posição, grade,
itens visíveis, atributos, bolsa, semente e palavra RNG. Não reposiciona o
jogador entre esses pontos. O estado inicial restaurado é o cenário nativo
depois das duas primeiras coletas; a criação do layout e as quatro posições
iniciais continuam cobertas pelos testes próprios.

O percurso revelou casos de alinhamento não cobertos antes: a saída de uma
bomba em Y=111,75 alinha imediatamente em 112, enquanto o corredor livre da
arena 7 preserva X=97. A nova coleta por frame confere os 13 deslocamentos
da saída e a comparação com a arena 7. A correção agora limita a parte inteira
junto a bombas/blocos destrutíveis e limita a ultrapassagem do intervalo de
alinhamento em velocidades maiores. Os 239 pontos dos ensaios anteriores
de movimento continuaram correspondendo ao original. A interpretação da
restrição por objetos é derivada desses casos; não substitui uma certificação
de todas as colisões com bombas móveis.

O Skull foi ensaiado novamente antes de coletar a luva, porque a colocação
automática com luva também pode carregar bombas. `SB2-ITEM-RULES.json` guarda
as tabelas extraídas da ROM e 33 transições de coleta sem luva. Todas as 33
usam a tabela C5EEB5 indexada por `word0400 & 15` do frame anterior; usar a
palavra posterior acertaria somente 9. Os seis modos observados são:

1. Invisibilidade intermitente, com sequência de tempos na ROM C5EE5D.
2. Colocação automática, com tentativa a cada dois frames nativos.
3. Capacidade disponível zero, impedindo colocar bombas.
4. Velocidade 3 px/frame, preservando o inventário de velocidade subjacente.
5. Velocidade 0,5 px/frame, preservando o inventário subjacente.
6. Capacidade disponível 1 e alcance 1, preservando os atributos básicos.

Os 35 testes de regras conferem tabelas, atributos iniciais dos 33 sorteios
e os 24 frames neutros de colocação automática sem luva. A integração usa
os seis status próprios e as velocidades nativas. A animação de invisibilidade
do cliente ainda é a genérica do Bombtop; a tabela de tempos foi extraída,
mas não aplicada. A transferência por contato continua usando o sistema
existente e precisa de comparação nativa. Também faltam validar cura,
descarte na morte, automação com luva e os demais usos das habilidades.
O ensaio `action-1-wait160` terminou com morte no próprio fogo; não é prova
de duração/expiração de maldição. Os sorteios da sessão com luva são
evidência complementar de atributos, não substituem o ensaio isolado.

Há tabelas diferentes de Skull para o índice interno 8 e para portadores
de Heart, preservadas no JSON de regras. Ainda não foram integradas. A arena
1 não fornece Heart na bolsa padrão. As demais arenas incluem glifos que
exigem efeitos adicionais; a nova revelação só mapeia os seis glifos da
arena 1 e não foi apresentada como implementação das 12 bolsas no gameplay.

Validação: 107 arquivos / 1.223 testes do compartilhado passaram; typecheck
da raiz passou no compartilhado, cliente e servidor. Após acrescentar a
comparação adicional de 13 frames, os 87 testes focados passaram. O teste
global do cliente não foi reexecutado; sua falha anterior da máscara de Naruto
continua registrada e reproduzida a partir do HEAD. `git diff --check` passou.
Os 35 arquivos protegidos do baseline permanecem idênticos; `arena.ts` e
`stage.ts` são as duas alterações esperadas entre os 37 hashes do baseline.
Agora nove arquivos comuns têm alterações intencionais, incluindo `items.ts`.

**Ponto de continuação:** completar animação e interações do Skull, movimentos
de bomba/luva/chute, morte e itens, relógio/fechamento nativo; integrar os
controladores das demais arenas e seus glifos, então renderização e seletor.
O objetivo integral continua ativo. As sessões Frida e clientes MCP foram
encerrados após exportar as evidências. Nenhum commit nem push foi realizado.

## Piscadas nativas e arena 7 no loop principal — 2026-11-01

**Invisibilidade:** o estado `skull-no-glove/mode-1.state` foi executado por
mais 708 frames no Snes9x MCP, sem botões, com observação REA/Frida das quatro
estruturas de jogadores. `SB2-SKULL-BLINK-COMPARISON.json` confere 709 leituras,
2.836 estruturas e 726.016 bytes. O bit `0x40` do word do jogador em offset
`+4` corresponde às piscadas. O contador `0xfc` e o índice `0xf9` também foram
extraídos dos bytes confrontados, sem escrita de memória.

A tabela C5EE5D soma 352 frames nativos e reinicia ao encontrar `0xffff`.
A coleta é visível no frame zero; a primeira entrada invisível começa no
próximo frame. O último word dura 192 frames invisíveis e se junta ao primeiro
word invisível do ciclo seguinte. As 709 leituras cobrem dois ciclos completos
e o reinício, com o modo 1 ainda ativo. Não sustentam uma expiração temporizada.

`sb2-skull-blink.ts` reproduz as palavras extraídas da ROM. O `step` avança
`curse.elapsed` uma vez por atualização PAL; o renderizador usa essa fase
pela função `skullAlpha`. Três testes do compartilhado conferem a tabela,
todos os 709 resultados pelo loop real, restauração JSON no trecho longo
e o tick sem atualização PAL. O teste do cliente também confronta os 709
valores de alpha e mantém o caso genérico anterior. Esta etapa substitui
a piscada genérica mencionada na seção anterior; contágio, cura, habilidades
combinadas e estados especiais ainda precisam de comparação própria.

**Arena 7:** `sb2-07` agora cria a grade e as quatro posições nativas e sua
própria bolsa. `buildSb2Layout` mapeia as placas de código 15 como atravessáveis,
sem convertê-las em pisos genéricos de outra mecânica. O controlador existente
é chamado no `step` antes dos comandos do jogador, usando o contador PAL do
loop e a palavra RNG disponível na entrada. Não há uma segunda conversão de
50 para 60 Hz. O adaptador isolado mantém seu relógio original para os testes
anteriores. O estado das placas, pausas e comandos retidos é serializável.

Os 23 percursos manuais e os quatro cenários de pausa agora são executados
tanto pelo adaptador quanto pelo `step` da arena 7. O typecheck detectou uma
variável de teste que sombreava a escolha do executor nos quatro casos de
pausa; o teste foi corrigido e esses casos foram executados novamente pelo
loop real. Esse resultado posterior, e não a primeira execução com sombra,
é a verificação da composição da pausa no `step`.

Outras verificações pelo loop principal:

- As 64 escolhas da placa esquerda reproduzem posição e próximo número
  observados, usando a palavra de sorteio de entrada capturada pelo REA.
- Cinco trajetórias pela placa direita cobrem velocidades 1 a 5, reentrada,
  posição, número seguinte e a palavra RNG, inclusive após 120 frames neutros.
  A semente e a fase iniciais vêm dos dumps MCP associados às capturas já
  confrontadas com REA; a semente em si não foi observada por aquele script.
  `SB2-STAGE7-RNG-STARTS.json` mantém essa distinção e o hash do journal fonte.
- A bomba pressionada somente na entrada da pausa é colocada na liberação;
  uma restauração JSON no meio da pausa preserva o resultado.
- A chama já observada em `damage-fine-5` foi restaurada no cenário do teste:
  o próximo passo mata o jogador parado na pausa e ignora o comando de bomba,
  correspondendo à leitura nativa seguinte. Não é uma reprodução da preparação
  inteira daquela explosão.
- As inicializações padrão das arenas 1 e 7 chegam às bolsas, sementes e
  palavras RNG dos frames nativos capturados, sem substituir valores no meio.

O glifo Full Fire `0x1606` usa alcance 10, conforme o índice máximo 9 da ROM.
As tabelas alternativas de Skull para o índice interno 8 (arena 7) e para
Heart foram ligadas ao sorteio com a precedência do código original. As
tabelas implementadas são confrontadas com a extração da ROM; coleta de
Full Fire, sorteios alternativos e suas interações ainda não receberam
ensaios dinâmicos próprios nesta integração.

**Snapshots:** a bolsa, a semente e a palavra RNG nativas são removidas de
`publicView`, preservando o contrato de não enviar resultados futuros de
itens/sorteios aos clientes. O estado do servidor continua completo e o
estado de piscada do jogador continua disponível para renderização. Dois
testes cobrem as duas arenas internas; testes de delta e previsão existentes
também passaram. A previsão e a renderização completas dos novos pisos
continuam pendentes de validação em UI.

As duas arenas continuam fora de `SELECTABLE_STAGES`. A arena 7 ainda não
tem a renderização de suas placas integrada e não foi certificada para
multiplayer simultâneo, habilidades especiais e todas as coletas. Os demais
estágios permanecem no objetivo integral, sem serem substituídos por essas
duas integrações internas. Nenhum commit nem push foi realizado.

Verificação final desta etapa: 108 arquivos / **1.267 testes do compartilhado
aprovados**; typecheck da raiz aprovado nos três pacotes. O cliente executou
128 arquivos: 127 aprovados e um com a mesma falha de `naruto-recolor.test.ts`;
1.254 testes aprovados e um reprovado. Os três arquivos relacionados à máscara
continuam com os hashes do HEAD documentado, verificados novamente. Depois
do ajuste dos snapshots, os testes focados de previsão e invisibilidade do
cliente também passaram. A regressão global permanece vermelha por Naruto,
sem desabilitar o teste nem alterar a arte.

Foram conferidos 510 artefatos do manifesto. Os 35 arquivos protegidos
permanecem idênticos; as únicas diferenças entre os 37 hashes iniciais são
`arena.ts` e `stage.ts`, previstas para a integração. Onze arquivos comuns
do compartilhado foram alterados no total, incluindo agora `index.ts` e
`view.ts`, além de `sprites.ts` no cliente. `git diff --check` passou.
O observador Frida e o cliente MCP da coleta de piscadas foram fechados
após exportar o bundle. Nenhum processo de teste ficou aguardando resultado.

**Próxima integração:** controlador de correias da arena 8 no loop real,
preservando ordem de movimento, direção/velocidade, comandos e curva; depois
continuar as arenas restantes. Itens adicionais, movimentos de bombas,
multiplayer, relógio/fechamento, renderização dos pisos e liberação no seletor
continuam necessários para concluir o objetivo integral das 12 arenas.

## Arena 8: comandos, movimento manual e rascunho no step — 2026-11-01

**Registro histórico do rascunho, superado pela seção seguinte: integração incompleta, com nove testes vermelhos.** Não
considerar a arena 8 validada nem liberá-la no seletor. A rodada completa
registrada em `SB2-STAGE8-DRAFT-TESTS.json` executou 1.299 testes: 1.290
aprovados e nove falhas, todas em `sb2-stage8-controller.test.ts`. Dos 109
arquivos, somente esse arquivo falhou. As regressões anteriores, inclusive
SB4, continuaram aprovadas. Depois dessa rodada, três casos adicionais de
criação/snapshots foram acrescentados e os 60 testes focados correspondentes
passaram; isso não elimina nem altera as nove divergências manuais.

A arena interna `sb2-08` agora cria a grade nativa, os quatro spawns e sua
bolsa. Os códigos 18/19 e 23–30 são atravessáveis, com consulta separada à
grade de fundo para os comandos e segmentos da correia. A inicialização
chega à bolsa, semente e palavra RNG da captura nativa da arena 8. O ID
permanece fora de `SELECTABLE_STAGES`; o rascunho está identificado também
no código de `sb2-stage8-controller.ts`.

**Coleta nova:** dois scripts REA observaram a mesma sessão de Snes9x MCP,
sem escrita de RAM ou ROM. O primeiro usa o formato `rea-item-effects.js`;
o segundo, `rea-conveyor-input.js`, inclui a região `0x5c00` de 512 bytes.

- `SB2-CONVEYOR-INPUT-COMPARISON.json`: 424 leituras, 165.360 células e
  434.176 bytes de jogadores iguais entre REA e MCP. Quatro leituras iniciais
  inspecionam estados já preservados; as outras 420 são 20 trajetórias de
  20 frames, mais seu frame inicial, em duas velocidades e dois sentidos,
  com comandos neutro, cima, baixo, esquerda e direita.
- `SB2-CONVEYOR-CONTROL-TIMING-COMPARISON.json`: 135 leituras, 52.650 células,
  138.240 bytes de jogadores e 414.720 bytes de regiões adicionais conferidos.
  Nessa segunda coleta, o word `0x5cbe` está dentro da região observada pelo
  REA. Nas trajetórias do primeiro script, esse word vem somente do dump MCP.
- Os journals completos ficam em `conveyor-input/manual-journal.json` e
  `control-journal.json`. `extract_conveyor_replay.py` produz os dois arquivos
  de replay reduzidos, mantendo os IDs de fonte e o escopo das leituras.

Não houve reinício por suposta queda de MCP: o primeiro callback do coletor
ficou ligado a um cliente antigo do REPL, enquanto o processo e o cliente
atuais estavam ativos. O coletor passou a usar `globalThis.sb2BeltClient` e
referências globais explícitas, e a coleta prosseguiu no mesmo núcleo. Uma
tentativa de salvar o journal usou um caminho ainda não criado; os dados
estavam retidos em memória e foram salvos sem repetir as trajetórias. O
primeiro comando do comparador usou um ID de evidência incorreto; foi corrigido
para o ID realmente exportado antes de produzir o relatório aprovado.

**Comandos globais:** os quatro estados iniciais dão os valores 0, 2, 1 e 3
para normal/horário, normal/anti-horário, rápido/horário e rápido/anti-horário
em `0x5cbe`: bit 0 é velocidade rápida e bit 1 é inversão. A coleta de
comandos confirma o significado por mudanças e transporte subsequente.

Na ida ao comando superior, a consulta de piso já está em 18 no frame 20,
mas a inversão aparece no 22. Na nova entrada, piso 18 no retorno 1 e troca
no retorno 3. O comando inferior aparece no frame 46 e altera a velocidade
no 48; a reentrada aparece no retorno 3 e a troca no retorno 5. O rascunho
modela a entrada detectada antes do movimento e uma solicitação global para
o próximo frame nativo. Permanecer no piso não solicita novas trocas. As
duas trajetórias completas de comandos, com 135 pontos, correspondem no step,
incluindo estados globais e RNG. Ainda falta ensaiar comandos simultâneos
de vários jogadores e entradas durante animação em outras fases.

**Movimento:** a correia livre existente foi ligada a uma fase de transporte
do `step`, separada da entrada manual. Os seis percursos antigos de alinhamento
(640 leituras nativas) passaram tanto pelo modelo isolado quanto pelo loop
real, incluindo curvas nos dois sentidos e duas velocidades. Há restauração
JSON durante os novos percursos. Essa correspondência não valida colisões
com objetos ou transporte de bombas.

A tentativa de compor entrada manual com transporte passa em 11 das 20
trajetórias novas; falha em nove. A hipótese atual permite sair perpendicularmente
quando a célula seguinte está livre, mas é insuficiente. Exemplos exatos:

- `normal-cw-up-1`: o original mantém Y=80,5 e transporta X para
  130,49993896484375; o modelo tenta sair da correia imediatamente.
- `normal-ccw-up-2`: o original transporta em X e mantém Y=79,25 por um frame;
  o modelo continua o comando vertical.
- `fast-cw-up-14`, `fast-cw-down-14` e `fast-cw-right-14`: há diferenças na
  composição da curva com o comando manual.
- `fast-ccw-left-1` e `fast-ccw-right-1`: o modelo corrige Y duas vezes,
  enquanto o original só aplica uma correção transversal naquele frame.

A lista completa dos nove nomes e os valores esperados/obtidos estão no
relatório de testes. Os casos não foram apagados, ignorados ou convertidos
em sucessos esperados. Quatro dos 26 casos do arquivo são apenas inspeções
iniciais, não percursos; os outros 22 são as 20 trajetórias manuais e duas
de comandos. Não apresentar os 17 casos aprovados como 17 trajetórias completas.

**Fatos para continuar a causa raiz sem repetir diagnósticos:**

- Os quatro estados iniciais não têm bombas marcadas na grade. A lista nativa
  de entidades em `0x2620` contém somente os quatro jogadores, sem entidades
  adicionais a partir de `0x8400`. P2 está em `(224,208)`; P3/P4 estão fora
  do jogo. Não atribuir essas diferenças a outra pessoa ou a uma bomba oculta.
- Nos casos inspecionados, `0x5efb=0x17` e `0x5f01=8` são constantes. A
  rotina de amostragem C0BFE2 usa esses offsets; não foi observado tremor da
  câmera como causa das falhas.
- As rotinas C0BEFE/C0BF37/C0BF70/C0BFA9 amostram posições com X+7/X-8 e
  Y+8/Y-7 e guardam bytes em `+0xb0..0xb3`. Os caches não são uma prova de
  que uma consulta simplificada apenas à célula seguinte reproduz o original.
- C053E1 e rotinas próximas preenchem movimento adicional em `+0x20/+0x22`,
  `+0x30/+0x32` e flags em `+0x28`. C0C34D e auxiliares combinam esse movimento
  com as velocidades de `+0x14/+0x16` e `+0x1c/+0x1e`. A ordem completa entre
  essa composição e a resolução manual ainda não foi reconstruída.
- Os bits baixos do word de estado do jogador são alterados pelo sinal dos
  componentes de velocidade nessas rotinas. Não tratá-los como uma enumeração
  de orientação visual. Os testes anteriores só usaram o word para estado
  vivo/morto, não como certificação de direção da animação.
- C130B2 despacha códigos 23–26 para rotinas de transporte; sua ligação completa
  com jogador/bomba ainda não está certificada. Não copiar esse trecho como
  se fosse sozinho a rotina de movimento do jogador.

Bomb Pass `0x1628` e Block Pass `0x162a` foram mapeados aos atributos já
existentes, conforme os callbacks que incrementam E8/E7 na ROM. O callback
de Bomb Pass não apaga o contador de Kick; a integração SB2 preserva esse
atributo. As coletas e colisões desses dois itens continuam sem ensaio
dinâmico próprio nesta etapa. Não confundir mapeamento estático com validação
de suas interações.

O typecheck passou nos três pacotes e `git diff --check` passou. O cliente
não foi reexecutado nesta etapa, sem mudanças no seu código; sua falha anterior
de Naruto continua documentada. A sessão Frida e o cliente MCP foram fechados
após exportar as duas observações. Nenhum commit nem push foi realizado.

**Ponto de continuação obrigatório:** resolver as nove divergências manuais
da arena 8 antes de tratá-la como integrada. Reconstituir a ordem das velocidades
e das colisões com os dados completos já preservados; ampliar o ensaio se
necessário, sem inventar exceções por prefixo de teste. Depois, transporte de
bombas/objetos, demais arenas, relógio/fechamento e renderização/seletor. O
objetivo integral permanece ativo e não há bloqueio que exija ação do usuário.

## Arena 8: composição manual corrigida e sequências independentes — 2026-11-01

As nove divergências do rascunho anterior foram resolvidas sem remover testes.
A suíte compartilhada completa passa: **1.306 testes**, em 109 arquivos.
`SB2-STAGE8-RESOLVED-TESTS.json` registra o resultado; o relatório vermelho
anterior fica preservado como histórico, não como estado atual.

A ROM mostra que C0A8D3 combina os componentes manual e adicional antes
do despacho. A tabela em C0AC0B seleciona os eixos e as quatro rotinas diagonais
C0B62D/C0B6A8/C0B723/C0B79E. Elas amostram os quatro cantos da posição
provisória, escolhem um eixo usando bloqueios e orientação anterior e restauram
o eixo descartado. A correção transversal acontece uma vez, com a velocidade
do jogador. A orientação visual vem de `+0x5e` (2/4/8/16), não dos bits baixos
do word de estado. `extract_conveyor_motion_rules.py` preserva sete regiões
brutas e a tabela de 16 ponteiros em `SB2-CONVEYOR-MOTION-ROM.json`.
Trata-se de decodificação parcial, não de uma certificação de todo o colisor.

C0A92A testa cruzamento de pixel inteiro na posição provisória, antes de
descartar um eixo. Se nenhum eixo cruza, só avança as frações e mantém a
orientação. Testar a posição final produzia uma divergência de orientação.
Os dois replays anteriores agora incluem `facing_code`, extraído do mesmo
journal nativo, sem modificar posições, grades ou sorteios esperados.

Uma nova execução independente do Snes9x usou os quatro estados preservados
normal/rápido e horário/anti-horário. Cada sequência fez DOWN 50, UP 50,
RIGHT 18, LEFT 18 e neutro 10 frames: 147 leituras incluindo o estado inicial,
588 no total. Essa ampliação encontrou a entrada no piso: o transporte consulta
o piso no início do frame; entrar na correia não aplica transporte adicional
naquele mesmo frame. A integração foi corrigida e os quatro casos passam.
Os 30 casos do controlador conferem posições, orientação, controles e RNG,
com restauração JSON durante o percurso; quatro são inspeções iniciais.

Evidência independente preservada:

- Journal: `output/sb2-research/conveyor-sequences/journal.json`.
- REA: sessão `69f24f62-f5b5-4b7e-a51c-9007a4dc7e07`, script
  `260dadba-3825-4efb-bc6f-f02bb23ccda9`.
- Evidência `ev_fb38e3f9a7a90b5bf78bc1a83af62cdd85a6a4db8656558d8ec760a3f0a87a01`,
  exportada em `SB2-REA-CONVEYOR-SEQUENCES.json`.
- `SB2-CONVEYOR-SEQUENCES-COMPARISON.json`: 588 leituras, 229.320 células,
  602.112 bytes de jogadores e 1.806.336 bytes das regiões comparadas, iguais
  entre MCP e REA. Não interpretar esses contadores como bombas observadas.
- Replay compacto: `SB2-CONVEYOR-SEQUENCES-REPLAY.json`.

Os 512 artefatos anteriores mantêm seus hashes; o novo journal eleva o manifesto
a 513. Dos 37 arquivos da referência SB4, os 35 protegidos permanecem idênticos;
apenas `arena.ts` e `stage.ts` têm as alterações comuns já documentadas.
As sessões Frida/MCP foram fechadas após a exportação. Nenhum commit ou push.

**Próximo trabalho:** validar transporte e colisões de bombas/objetos na arena 8,
incluindo interações com jogadores e itens. Os percursos atuais usam jogadores
sem essas interações. Os IDs SB2 continuam internos e fora do seletor; as demais
arenas, animações e integração visual ainda impedem concluir o objetivo integral.

## Arena 8: bombas móveis, oito percursos observados — 2026-11-01

Foram feitos três ensaios, sem escrita de RAM, sobre os quatro estados
normal/rápido e horário/anti-horário já preservados. Cada caso contém uma
leitura inicial e 150 avanços/leitura individuais. O primeiro usou B por engano:
não criou bombas e **não conta como validação de bombas**. Foi preservado
em `conveyor-bombs/journal.json`, com comparação em
`SB2-CONVEYOR-BOMBS-COMPARISON.json`.

O plantio correto usa A. `planted-journal.json` planta no primeiro frame,
aplica DOWN nos frames 2–60 e depois neutro. `neutral-journal.json` planta
no primeiro frame e não aplica movimento manual. São oito percursos, 1.208
leituras com bombas plantadas. Cada conjunto foi confrontado por REA/MCP,
incluindo o slot móvel 0x8400, a tabela 0x12000, jogadores, grades e controles.
Os replays compactos foram gerados por `extract_conveyor_bombs.py`:
`SB2-CONVEYOR-PLANTED-REPLAY.json` e
`SB2-CONVEYOR-BOMBS-NEUTRAL-REPLAY.json`.

O slot móvel não basta para identificar o frame de explosão: ao acabar seu
ciclo, a posição antiga pode virar (511,240+fração), com estado zero, enquanto
a tabela 0x12000 volta à forma estática e ainda completa o ciclo. Não usar
esse desaparecimento como medida isolada do fusível. Essa transição ainda
precisa ser ligada ao modelo de bombas do step.

O novo `sb2NativeConveyorBombStep` foi derivado dos percursos observados.
A bomba só troca o eixo após chegar ao centro inteiro da curva. Ao avançar
um pixel inteiro, alinha imediatamente o eixo transversal ao centro, mantendo
sua fração, em vez da correção limitada a 1,25 do jogador. O bloqueio por
jogador usa o eixo principal, a posição inteira proposta e uma faixa transversal:
distância à frente estritamente entre 0 e 16 e distância transversal menor
que 8. Essas regras são **inferência validada pelos oito percursos**, não uma
afirmação de desmontagem completa do colisor da ROM.

Os testes acumulam a posição calculada da bomba ao longo do percurso e
fornecem posições de jogadores e controles vindos do SNES. Portanto são
replays condicionais de transporte, **não validação do step completo**. Não
validam colisões entre bombas, chute, itens, criação, retorno à tabela estática
ou fusível durante esse retorno. A função ainda não foi conectada ao loop,
para não tratar essas interações ausentes como implementação fiel.

REA: sessão `6a2e6a38-2fa5-47c4-93e7-c872db3da31e`, encerrada após exportação.
O cliente MCP também foi fechado. Os três pais de evidência são:

- Sem plantio: `ev_0b1e0ea56e1d724edcebaa0eb5e893e03e28b4281c338c324cb2034674da8830`,
  script `75bac77b-2474-4d82-aafe-ea4d7db15f29`, bundle `SB2-REA-CONVEYOR-BOMBS.json`.
- Plantio + comando: `ev_e7eeacd9c09e60193337819890d3ee291c1026e8e8d7d3a6569bc3219bb6ce4a`,
  script `60ba0296-067f-48c4-99e7-ba08337c81aa`, bundle `SB2-REA-CONVEYOR-PLANTED.json`.
- Plantio neutro: `ev_40d08248f44c3fe7562c1f26d2d2e0911de61760ab1f327564ac80efc35f5f18`,
  script `a2705cb7-7091-49f5-a2e2-50dac744af97`, bundle `SB2-REA-CONVEYOR-BOMBS-NEUTRAL.json`.

O último pai informa truncamento da fila global da sessão. A inspeção mostrou
que somente mensagens do primeiro script foram descartadas: o script neutro
mantém identidade e as 604 amostras contíguas 1–604. `verify_effects.py` agora
aceita essa cobertura quando há script explícito, sequência inteira e igualdade
integral com as leituras MCP; continua rejeitando truncamento sem essa prova.
O relatório expõe `session_messages_truncated=true` e
`selected_script_samples_complete=true`, sem ocultar a limitação da sessão.

Os 513 artefatos anteriores mantiveram seus hashes e os três journals elevam
o manifesto a 516. Nenhum commit ou push. O objetivo integral continua ativo.

**Próximo passo:** ligar o transporte móvel à representação existente de bomba,
reconstruir a criação e o retorno à tabela estática/fusível e confrontar o step
com os mesmos oito percursos, sem substituir posições nativas por exceções.
Depois ampliar para múltiplas bombas, chute/Glove/itens e demais arenas.

Validação final desta etapa: **1.314 testes compartilhados aprovados**, em 110 arquivos, incluindo os oito novos percursos (1.120 transições móveis acumuladas). Typecheck dos três pacotes e `git diff --check` aprovados. Os 35 arquivos protegidos da referência SB4 continuam idênticos. O cliente não foi reexecutado, sem mudanças em seu código nesta etapa; sua falha Naruto anterior permanece documentada.

## Arena 8: integração de bombas no step e ciclo completo — 2026-11-01

O transporte de bombas agora participa de `updateBombs`, usando `sb2Motion`
para a posição contínua em unidades do mundo. A bomba móvel não ocupa uma
célula estática em `bombAt`; a criação, o retorno à célula e o fusível continuam
no sistema de bombas existente. `updateSlides` não aplica o transporte genérico
sobre essa posição. O renderer usa `bombGroundOrigin` para desenhar a posição
contínua com a arte de bomba existente. A extrapolação genérica de slides não
avança novamente uma bomba SB2. Isso valida o cálculo da posição de desenho;
a apresentação completa da arena ainda exige QA visual, arte e seletor.

Os oito percursos anteriores agora passam pelo **step completo**, em vez de
receber jogadores nativos a cada frame. Os testes restauram somente o estado
inicial capturado e aplicam os botões; confrontam posição e estado vivo/morto,
bomba móvel/estática, grade, chamas, controles e RNG, com restauração JSON.
Os replays enriquecidos ficam em `SB2-CONVEYOR-PLANTED-STEP-REPLAY.json` e
`SB2-CONVEYOR-BOMBS-NEUTRAL-STEP-REPLAY.json`.

O ensaio B sem plantio foi reaproveitado para quatro novos percursos de jogador
em `SB2-CONVEYOR-UNPLANTED-REPLAY.json`. **Todas as coordenadas do jogador
nesse ensaio são idênticas às do ensaio A**, nos mesmos 604 pontos. Isso refutou
a hipótese de que a divergência inicial de alinhamento era causada pela bomba.
Quando o avanço termina exatamente no pixel inteiro central, o movimento
manual não aplica correção transversal naquele frame. A correção foi feita no
mover; os 34 casos anteriores/ampliados do controlador continuam confrontados.
Não foi mantida uma exceção artificial de colisão lateral com a própria bomba.

### Nova coleta independente: paridade oposta e término do ciclo

A sessão Snes9x/REA nova usou os mesmos quatro estados preservados, mas
esperou um frame antes do plantio: neutro 1, A no frame 2, DOWN nos frames
3–62 e neutro até o frame 190. Foram **764 leituras**, observadas pelo REA
sem truncamento e comparadas integralmente com o MCP: 297.960 células,
782.336 bytes de jogadores, 782.336 bytes dos slots candidatos e 2.347.008
bytes de regiões. Houve também nove observações de glifos de itens.

- Journal: `output/sb2-research/conveyor-bomb-lifecycle/journal.json`.
- Sessão REA `e5d8366f-ddb0-45b0-878c-735728a99703`, script
  `01bbc99a-e5fe-4f61-9b91-53e9d1db0dc3`.
- Evidência `ev_54f96d137a924e3810ccd07f33eae9cd5a381f77f42db0470c186b8d8dbb611e`.
- Bundle `SB2-REA-CONVEYOR-BOMB-LIFECYCLE.json`, comparação
  `SB2-CONVEYOR-BOMB-LIFECYCLE-COMPARISON.json` e replay
  `SB2-CONVEYOR-BOMB-LIFECYCLE-REPLAY.json`.

A nova coleta encontrou a conversão da bomba estática em móvel somente na
fase par do contador nativo. Um plantio em fase ímpar permanece estático um
frame e começa a entidade móvel no seguinte, sem mover nesse frame de criação.
O jogador amostra o piso ocupado pela bomba estática **antes** da conversão:
nesse frame não recebe o vetor da esteira, embora a resolução de movimento já
veja a célula liberada. O controlador agora preserva essa ordem.

O desaparecimento da entidade móvel não é a explosão: ela volta à célula com
três frames restantes. O fusível original é preservado, sem antecipar o fogo.
A flag C000 da tabela também não basta para declarar fogo; os testes usam a
bomba marcada na grade até aparecerem as chamas. O contato de fogo amostrado
na entrada do frame mata depois do movimento manual e antes do transporte
passivo, evitando transportar um jogador morto mais um frame.

Os quatro percursos de 190 frames verificam também o fim das chamas, os blocos
queimados, as 64 entradas da bolsa e itens revelados. A bolsa inicial é restaurada
da WRAM 0x3c48; os campos auxiliares seed/draws do construtor não são medidos
por esse replay. A morte com atributos iniciais não deve gerar Fire/Speed:
`carried` e a reposição dos atributos agora usam os valores iniciais SB2, em vez
dos valores genéricos do Bombtop. A redistribuição de inventários ampliados
após a morte ainda precisa de ensaio próprio.

A coleta e o cliente MCP foram encerrados após a exportação. Os 516 artefatos
anteriores mantêm seus hashes, e o novo journal eleva o manifesto a 517. Os
35 arquivos protegidos da referência SB4 permanecem idênticos. Sem commit/push.

**Cobertura atual:** 12 percursos de uma bomba no step, em dois sentidos e
duas velocidades, com duas paridades de plantio; quatro deles até o término
da queima. Isso ainda não certifica múltiplas bombas, chutes/Glove, colisões de
objetos, contágio, inventário ampliado após morte ou todas as animações.
O próximo ensaio deve cobrir essas interações e a implementação visual, antes
de liberar a arena. As 12 arenas SB2 continuam como objetivo integral pendente.

Validação final: **1.330 testes compartilhados aprovados em 111 arquivos**;
**1.255 testes do cliente aprovados e uma falha preexistente** de Naruto em
128 arquivos. Os três arquivos da evidência Naruto continuam iguais ao HEAD
registrado. Typecheck dos três pacotes e `git diff --check` aprovados. O teste
focado dos 12 percursos foi reexecutado após acrescentar as verificações de
orientação e controles, também aprovado. Relatórios completos:
`SB2-CONVEYOR-BOMB-INTEGRATION-TESTS.json` e
`SB2-CONVEYOR-BOMB-CLIENT-TESTS.json`. Os 12 percursos verificam 1.960 avanços
nativos, além dos estados iniciais; nenhuma posição intermediária é injetada.

Regressão adicional do servidor: 46 testes aprovados, 0 falhas (`SB2-CONVEYOR-BOMB-SERVER-TESTS.json`).

## Dois jogadores e duas bombas na arena 8 — continuação 2026-11-02

Quatro percursos de 250 frames foram capturados com dois controles reais:
P2 UP 26, LEFT 26, plantio de P1 no frame 53 e P2 no 61, demais frames
neutros. Os quatro estados normal/rápido e horário/anti-horário foram reutilizados.
As 1.004 leituras foram comparadas integralmente entre MCP e REA, sem truncamento.
Sessão `2dbfc3a2-a185-41c6-a7f7-c1b59dcb6d02`, script
`7932b8ad-6c7f-4a04-a27c-8201bf884c24`, evidência
`ev_4681bdb3324ec32c81027e2935d4eea3f8323d7cd215c977a0c018fea95df770`.
Bundle `SB2-REA-CONVEYOR-MULTIPLAYER.json`, comparação
`SB2-CONVEYOR-MULTIPLAYER-COMPARISON.json`, journal
`output/sb2-research/conveyor-multiplayer/journal.json`. Sessão e cliente fechados.

O replay correto é `SB2-CONVEYOR-MULTIPLAYER-VERIFIED-REPLAY.json`.
A versão anterior inferia incorretamente a posição estática de P2 pelo word +2.
A extração corrigida associa a célula marcada na grade à última posição móvel
observada, exige proximidade e rejeita empates. O vínculo móvel usa o ponteiro
+0x40 para a primeira entrada de P1/P2. Isso não certifica entradas adicionais.

O transporte passivo do jogador verifica contato quando cruza um pixel inteiro.
Bombas recém-criadas não bloqueiam nesse mesmo frame. A faixa à frente usa
alcance 15 para entidades móveis e 16 para bombas estáticas; o eixo transversal
usa 8. Esses valores reproduzem as paradas e retomadas observadas, como
inferência validada por replay, sem alegar desmontagem completa do colisor.

Ao ocorrer a transição de dois vivos para um, os fusíveis param a partir do
frame seguinte; jogadores, esteiras, chamas e RNG continuam. O estado serializável
`freezeBombFuses` preserva isso. Os quatro percursos passam no step completo,
conferindo ambos os jogadores, bombas por proprietário, grades, chamas, itens,
bolsa e RNG. Agora são 16 casos no arquivo de integração. Não houve comprovação
de reação em cadeia nesta coleta: esse ensaio, colisão entre bombas, chute/luva
e QA visual ainda precisam ser ampliados. As demais arenas seguem pendentes.
Os 517 artefatos anteriores mantêm hashes; manifesto agora com 518. Sem commit/push.

Regressão final: 1334 testes compartilhados aprovados; typecheck dos três pacotes aprovado. Os 35 arquivos protegidos SB4 permanecem idênticos. Cliente não reexecutado nesta etapa, sem alterações no cliente; falha Naruto anterior permanece documentada.

### Continuação: defasagens para investigar cadeia

Três novos percursos fast-cw de 260 frames: P1 planta no 53; P2 planta no 70, 90 ou 110, após UP26/LEFT26. Foram 783 leituras REA/MCP iguais, sem truncamento. Journal em `conveyor-chain-timings/journal.json`, bundle `SB2-REA-CONVEYOR-CHAIN-TIMINGS.json`, comparação e replay `SB2-CONVEYOR-CHAIN-TIMINGS-*`. Evidência `ev_f078c0ce3f760bded88f0c29b664ab57e70484e9279002cea37d2168a55163d0`, script `7d6a39bd-7cb7-4c18-a624-977b36a03150`. Sessão e cliente encerrados. Manifesto acrescido do novo journal, 519 arquivos. Próximo passo: analisar os temporizadores e confrontar os três replays com o step; ainda não afirmar que houve cadeia. Nenhuma mudança de gameplay nesta coleta; sem commit/push.

### Comparação dos três novos percursos — 2026-11-02

Os três casos foram acrescentados à integração, sem injetar posições.
Resultado focado: 17 casos aprovados e dois novos divergentes (19 no total).
O plantio P2 no frame 70 passa. No frame 90, a primeira diferença aparece no
91: P1 nativo vai para X112,68763732910156, enquanto o modelo vai para
102,37515258789062, ambos Y176,93690490722656. Investigar resolução da
sobreposição com a bomba estática recém-convertida, sem presumir um simples
bloqueio. No plantio 110, a primeira divergência é P2 no frame 147: nativo
(67,06327819824219;87,62557983398438), modelo
(64,75079345703125;88,87557983398438), na curva.

O exame das transições da tabela não mostrou antecipação do fusível de P2:
os três casos continuam sem comprovar cadeia. Não apresentar esses casos como
cadeia validada. Relatório focado `SB2-CONVEYOR-CHAIN-DRAFT-TESTS.json`.
Nenhuma alteração de gameplay foi feita para mascarar as divergências; os
testes permanecem ativos. A última suíte completa verde é a de 1.334 testes,
anterior a estes três casos. Próximo passo: reconstruir as duas colisões com
as estruturas completas já preservadas e ampliar o ensaio de cadeia depois.

### Correção da colisão na curva — 2026-11-02

A consulta do contato passivo usa a coordenada transversal anterior ao alinhamento, junto à coordenada principal proposta. Com isso o percurso P2-110 coincide integralmente, sem alterar suas posições esperadas. Resultado focado: 18 de 19 casos aprovados. Permanece a divergência P2-90 no frame 91, deslocamento nativo de P1 para X112,68763732910156. Não foi criada exceção por nome de caso ou frame. O próximo passo continua sendo reconstruir a resolução de sobreposição na conversão estática/móvel.

Regressão compartilhada: 1336 aprovados, 1 falhas; typecheck dos três pacotes aprovado. Sem commit/push.

### Sobreposição resolvida — 2026-11-02

A bomba estática adjacente é amostrada antes de virar móvel. O transporte passivo limita o eixo ao centro inteiro da célula atual, preservando a fração, quando o avanço ultrapassaria esse centro em direção à bomba. Isso explica o retorno de P1 para X112,68763732910156 no frame 91. O controlador guarda a presença da bomba estática à frente antes da conversão e aplica o limite no transporte, sem exceção por frame ou nome. Os 19 percursos focados agora passam. A regra foi confrontada também com os 18 percursos anteriores; outras entradas manuais e objetos ainda exigem ampliação. Nenhum dos três plantios novos comprovou cadeia. Sem commit/push.

Regressão final: 1337 testes compartilhados aprovados; typecheck dos três pacotes aprovado. Os 35 arquivos protegidos SB4 permanecem iguais.

### Seleção de ensaio para cadeia — 2026-11-02

`find_conveyor_chain.ts` examina 400 sequências no modelo atual, restaurando posição, velocidade, orientação e controles iniciais. Saída em `SB2-CONVEYOR-CHAIN-CANDIDATES.json`, explicitamente hipótese, não evidência nativa. O primeiro candidato usa fast-cw, P1 planta no 53 e segura UP nos frames 54–105; P2 segue UP26/LEFT26 e planta no 70. O modelo remove P2 antes do fusível normal no frame 198. Próximo passo: executar essa sequência pelo MCP/REA e verificar temporizador, posições e fogo antes de afirmar cadeia ou alterar gameplay. Não houve mudança no gameplay nesta busca.

### Primeira candidata executada no SNES — 2026-11-02

Sequência fast-cw P1 A53/UP54–105 e P2 UP26/LEFT26/A70: 261 leituras MCP/REA iguais, sem truncamento. Evidência `ev_a0e1a4c7d25b5529fa396bdf4df312e415dfdd67cf33e26c72fd5a62e68fee1e`, script `d6d37515-5f52-4a3d-b85b-20bf1009ffaa`. Journal `conveyor-chain-candidate/journal.json`, bundle e comparação `SB2-*-CONVEYOR-CHAIN-CANDIDATE*`. A exportação publicou o bundle, mas informou limpeza temporária incompleta EBUSY em `docs/.rea-write-4fLzP9/content`; não repetir a coleta por isso. O arquivo publicado foi lido e verificado com sucesso. Sessão e cliente fechados. Manifesto agora com 520 journals/artefatos.

A primeira entrada de P2 permanece zero: a candidata não prova cadeia nativa. O replay independente foi incorporado aos testes para revelar a primeira divergência que permitiu plantio no modelo. Não tratar os 64 candidatos do modelo como ensaios nativos aprovados. Relatório `SB2-CONVEYOR-CANDIDATE-DRAFT-TESTS.json`. Sem commit/push.

### Transição de vetor no primeiro desvio — 2026-11-02

`SB2-CONVEYOR-CANDIDATE-TRANSITION.json` preserva oito estruturas completas
P1 dos frames 53–60, extraídas do journal já comparado com REA. Nos frames
54–56 o movimento adicional é horizontal (magnitude 2,3124847412109375,
flags 0x0200). No frame 57 passa a vertical (mesma magnitude, flags 0x0400).
O original mantém Y168,18690490722656 nesse primeiro frame, muda a orientação,
e só no 58 avança para Y169,2493896484375. No 59 volta a movimento adicional
horizontal e Y167,9993896484375. A divergência coincide com a troca do eixo
adicional junto à borda da curva; não atribuí-la automaticamente ao contato
com a bomba nem ao fusível. Os caches de cantos e piso foram preservados para
reconstruir a rotina. A hipótese de pausa por troca de eixo ainda não está
provada; não foi acrescentada uma espera artificial ao gameplay.

Próximo passo: confrontar o despacho de movimento nessa transição, incluindo
sinais de velocidade, orientação anterior e consultas de cantos, com as
rotinas ROM já preservadas, e ampliar captura isolada se necessário. Permanece
um teste novo divergente; a última suíte completa verde tem 1.337 testes.
Sem commit/push.

### Causa do frame 57: contato manual com entidade móvel — 2026-11-02

Não é uma pausa por troca de eixo. No frame 57, a bomba está em (185,0625457763672;176), dentro da faixa transversal e à frente do movimento para baixo. No 58, sua coordenada X182,75006103515625 já sai dessa faixa. A verificação de contato, antes restrita ao transporte passivo, agora também limita o deslocamento comandado na correia. Mantém orientação e restaura posição ao bloquear. Os 19 percursos anteriores passam e o novo coincide até o frame 70. A divergência restante é plantio: modelo cria duas bombas, nativo mantém somente P1. Relatório `SB2-CONVEYOR-MANUAL-CONTACT-DRAFT-TESTS.json`. Investigar a entrada A de P2 e sua interação com a bomba próxima; não afirmar cadeia nem inventar pausa temporal. Sem commit/push.

### Plantio de P2 explicado — 2026-11-02

No frame 70, a nova bomba seria centrada em X144/Y176, enquanto a entidade móvel de P1 ainda está próxima (X155,000244140625/Y176 antes do passo). A grade estática livre não é suficiente: o corpo móvel invade o espaço de plantio. `placeBomb` agora rejeita a sobreposição de corpos móveis SB2 com distância menor que um tile nos dois eixos. A regra reproduz a rejeição e mantém os outros 19 percursos aprovados; não certifica todos os limiares de contato possíveis. Os 20 replays completos passam. A candidata do modelo antigo não é cadeia válida. A busca de candidatos foi reexecutada com o modelo corrigido; a saída continua sendo hipótese que exige execução nativa. Sem commit/push.

Regressão final: 1338 testes compartilhados aprovados, typecheck dos três pacotes aprovado; 35 arquivos protegidos SB4 iguais. A busca corrigida encontrou 52 hipóteses; próxima candidata P2 A80, demais comandos iguais à captura anterior.

### Candidata P2 A80 executada — 2026-11-02

261 leituras iguais entre MCP e REA, sem truncamento; sessão `35955f2a-6444-4e38-bee7-df385696f093`, script `aeadf76f-1935-4dfc-a79d-468842820c3e`, evidência `ev_895ab001546991f8af3ef0ce6943071b43d94e7ead68ebfa013b1a9ab83c2171`. Bundle/replay/comparação `SB2-*-CONVEYOR-CHAIN-CANDIDATE80*`, journal `conveyor-chain-candidate80/journal.json`. Sessão e cliente encerrados; manifesto 521. P2 também não cria bomba nesta sequência nativa: sua primeira entrada fica zero em todos os frames. O replay foi acrescentado, com uma nova divergência ativa no plantio, relatório `SB2-CONVEYOR-CANDIDATE80-DRAFT-TESTS.json`. A correção anterior reproduzia os 20 casos, mas não certificava todos os limiares; reconstruir agora o posicionamento de plantio e o teste do corpo móvel, sem aumentar o alcance por tentativa para passar. Última suíte verde: 1.338 testes, anterior a esse caso. Sem commit/push.

### Investigação do gate de plantio — 2026-11-02

`SB2-CONVEYOR-PLANT-GATE-OBSERVATIONS.json` preserva estruturas completas antes dos plantios rejeitados A70/A80 e do aprovado A61, além do trecho ROM C203A7–C20680 referenciado pelos callbacks do jogador. O word de P2 em +8 é 0x0040 nos rejeitados e 0x0048 no aprovado. Sua semântica ainda não foi certificada. Em A80, antes do input, P2 está em X115,18800354003906 e a bomba móvel em X131,87539672851562; a distância ao centro de plantio adotado no modelo excede um tile, refutando a suficiência da primeira correção. Não aumentar alcance por tentativa: rastrear a atualização/teste desse word e o mapeamento de ocupação antes do callback A. O teste A80 continua ativo e divergente; nenhum ajuste de gameplay nesta investigação. Sem commit/push.

### Correção da rota estática de investigação — 2026-11-02

Os trechos C203A7/C20502 referenciados em +70/+78 apresentam formato de tabelas gráficas, não constituem prova de callbacks executáveis. A interpretação anterior como callback deve ser desconsiderada. O código da ROM usa endereçamento indireto longo por [$6A],Y nas estruturas de entidades: buscar apenas LDA direto +8 não encontra as referências relevantes. `SB2-PLAYER-FLAG-ROM-REFERENCES.json` registra referências no banco C0 para LDY #8/LDA [$6A],Y, com bytes e hash da ROM. Próximo passo: seguir os testes/escritas dessas referências até o handler de plantio e o mapa de ocupação. Ainda sem mudança de gameplay, com A80 divergente. Sem commit/push.

### Inicialização candidata localizada — 2026-11-02

C181CE escreve #0x48 em +4 via [$7C],Y. C18184 obtém +A8, chama C16631/C1278C antes da inicialização C181BB. Região e referências JSL preservadas em `SB2-BOMB-CREATION-ROM-REGION.json`. Próximo passo: seguir alocação e testes anteriores até a rejeição A80. Fluxo parcial, sem mudança de gameplay; divergência mantida. Sem commit/push.

### Alocação e entidades móveis — 2026-11-02

C1278C procura uma entrada livre em $7F2000 com passo $0100 (até 40 entradas). C1813D percorre $7E2620, filtra entidades e compara +A8; C16631 lê posição +18/+10 e chama C0A515 antes de escrever +AA. Trechos preservados em `SB2-BOMB-ALLOCATION-ROM-REGIONS.json`. A rotina vizinha C18098 consulta $7FC000 e $7F8000, mas seu caminho não está certificado como plantio normal: não usar esse trecho para inventar alcance de colisão. Os índices +A8 incluem o cabeçalho da grade: relacionar endereços a $7FC000, não diretamente às linhas da captura cujo início é $7FC182. Próximo passo: reconstruir C0A515 e o teste +A8 da entidade móvel no caminho efetivo do plantio. A80 continua divergente; sem mudança de gameplay, commit ou push.

### Cálculo de índice +AA reconstruído — 2026-11-02

C0A515 soma offsets WRAM5EFB/5F01 às partes inteiras de Y/X, mascara alinhamento de 16 e combina linha com passo64 e coluna com passo2. A fórmula foi confrontada com +AA de P2 e da bomba móvel nas seis estruturas anteriores aos plantios A70/A80/A61; resultado em `SB2-PLANT-POSITION-INDEX.json`. +A8 e +AA pertencem a representações com passos de linha diferentes; não tratá-los como coordenadas físicas intercambiáveis. A igualdade de +A8 entre jogador e bomba não explica sozinha A80, pois os índices observados são adjacentes, não iguais. Próximo passo: confirmar o caminho efetivo do handler A, evitando atribuir a rejeição à rotina vizinha apenas por proximidade. Sem alteração de gameplay; divergência preservada. Sem commit/push.

### Chamadores encontrados e fronteira corrigida — 2026-11-02

A entrada é C180D0; C180CE pertence ao retorno da rotina anterior. JSLs em C17791/C177A8 chamam C177D0 antes dela. C17750 consulta uma célula via +4C, rejeita códigos/flags e compara +A8/+4C; C177D0 consulta flags globais 5DAC e despacha C17850/C178A4/C17A1F/C17B0D. Bytes e referências preservados em `SB2-BOMB-CREATION-CALLERS.json`. Esta rota ainda não foi ligada com certeza ao handler humano A; confirmar antes de portar regras, para não incorporar comportamento de controle automático. A investigação corrigiu a fronteira de instrução que impedia achar chamadores. A80 permanece em teste ativo, sem novo ajuste de gameplay. Sem commit/push.

### Caminho humano de plantio encontrado — 2026-11-02

C03126 chama C034C0, que inicializa a bomba normal com contador byte0x48 em +4. Antes dela são chamadas C031EB, C0319A e C03163. C0319A percorre entidades móveis e compara o índice +A8 do jogador tanto com +A8 da entidade quanto com uma entrada paralela em $7E2720. Essa segunda comparação não existia na rotina vizinha examinada anteriormente e fornece uma hipótese concreta para rejeitar plantio em célula reservada além do corpo físico. Bytes e amostras em `SB2-HUMAN-PLANT-ROM-GATES.json`. A lista 2720 está nos dumps MCP, mas não foi observada pelo REA anterior: próxima captura deve incluí-la antes de portar a regra. A80 continua divergente. Sem alteração de gameplay ou commit/push.

### Reservas confirmadas pelo REA — 2026-11-02

O observer `rea-conveyor-reservations.js` inclui 2600–27FF. Nova sessão `85a49883-4c5c-41ea-8cda-5ec38bcd293e`, script `dd47428f-de04-4086-ab51-574eb5c6de13`, evidência `ev_e9194cb41d653b5b5c43c4b6b90ace73a710b56dd0624133f7a8b7a9f9dcadfb`: 202 leituras MCP/REA iguais sem truncamento. Reproduz A61 aprovado sem saída de P1 e A80 rejeitado com UP54–100. Dados em `conveyor-reservations/journal.json`, bundle `SB2-REA-CONVEYOR-RESERVATIONS.json`, comparação e gate compactos próprios. Sessão e cliente fechados; manifesto 522.

Antes de A80, o índice de P2 e a reserva da bomba são 1550, enquanto a célula da entidade é 1552. Antes do aprovado A61, P2 é 1556, reserva 1558 e entidade 1560. A igualdade da célula reservada com P2 está agora confirmada por observação independente. Próximo passo: reconstruir a atualização da reserva (incluindo curvas), substituir a aproximação de corpo físico pelo bloqueio de células nativas e reexecutar os 21 percursos. A80 permanece divergente até essa integração. Sem commit/push.

### Plantio por célula reservada integrado — 2026-11-02

A aproximação de distância física foi substituída pela célula ocupada e a seguinte reservada na direção da bomba. A seleção de direção nas curvas foi extraída de `sb2NativeConveyorBombStep` para uma função compartilhada, preservando a regra de alcançar o centro inteiro antes da curva. Os 21 percursos completos e oito replays condicionais de transporte passam, incluindo A80 antes divergente. A reserva foi observada diretamente pelo REA nos dois ensaios anteriores; limites de outras interações ainda exigem ampliação. Sem commit/push.

Regressão final: 1339 testes compartilhados aprovados; typecheck dos três pacotes aprovado; 35 arquivos protegidos SB4 idênticos.

### Reserva direta ampliada: estado vazio encontrado — 2026-11-02

Extraídas 133 amostras de entidades móveis da coleta REA/MCP de reservas, em `SB2-CONVEYOR-RESERVATION-SAMPLES.json`. O novo teste direto `sb2-conveyor-reservations.test.ts` compara +A8 e a reserva 2720 em cada amostra, além dos testes de trajetórias existentes. Ele falha inicialmente em reserve-61-54: célula atual válida, mas reserva nativa zero, enquanto a aproximação prevê a próxima célula 1558. Não filtrar reservas vazias para fazer passar: reconstruir sua ativação, inclusive bloqueio por jogadores e inicialização. A reserva de uma entidade não é incondicionalmente a célula seguinte. Gameplay ainda não alterado nesta etapa; o novo teste permanece ativo. Última suíte verde anterior: 1.339 testes. Sem commit/push.

### Inicialização da reserva reconstruída — 2026-11-02

As três reservas vazias coincidem com contador de entidade +0C=255, o primeiro passo após criação (inclusive uma bomba que já se deslocou). A fase inicial agora preserva reservationReady=false; a atualização seguinte ativa a reserva. A observação do contador foi acrescentada às 133 amostras, sem descartar zeros. Os 21 percursos completos continuam passando. O teste direto avançou até reserve-61-71, onde a previsão 1552 difere da reserva 1554: ao cruzar a célula, a reserva corresponde à posição anterior à atualização, não à posição final usada pela aproximação. Próximo passo: armazenar a célula reservada calculada no início do movimento, em vez de recalculá-la a partir da posição final no plantio; conferir todos os 133 registros. Um teste direto continua divergente. Sem commit/push.

### Reserva armazenada antes do movimento — 2026-11-02

O estado móvel agora armazena a reserva calculada antes do avanço e o plantio lê essa célula, em vez de recalculá-la pela posição final. Os 21 percursos completos continuam passando. As amostras diretas foram enriquecidas com a posição de entrada do mesmo slot no frame anterior, extraída do journal comparado com REA. A conferência revelou que o índice ocupado +A8 também não pode ser modelado uniformemente pela posição de entrada ou pela final: reserve-61-71 coincide com a final; reserve-61-72 não. O teste direto continua ativo e divergente. Próximo passo: reconstruir a atualização do índice ocupado e o momento da escrita em 2720 na rotina móvel, sem trocar a expectativa nativa ou filtrar a troca de célula. Implementação parcial, sem declarar reserva completa. Sem commit/push.

### Ordem dos índices reproduzida — 2026-11-02

Não há atualização apenas por paridade: +A8 corresponde à posição proposta antes da colisão com jogadores, mesmo quando a posição efetiva fica bloqueada. A reserva usa o índice +A8 guardado do frame anterior mais a direção corrente. A primeira atualização mantém reserva zero. Essa ordem reproduz todos os 133 registros nativos; o teste direto passa e os 21 percursos completos continuam aprovados. O estado móvel agora guarda occupied e reservation separadamente da posição física; o plantio consulta os campos guardados. Nenhuma expectativa nativa foi descartada ou alterada para fazer passar. Sem commit/push.

Regressão: 1340 testes compartilhados aprovados; typecheck dos três pacotes aprovado; 35 arquivos protegidos SB4 idênticos.

### Cadeia nativa candidata A105 — 2026-11-02

Busca corrigida: 36 hipóteses; primeira nova candidata P2 A105, P1 A53/UP54–105. Execução original de 260 frames, 261 leituras REA/MCP iguais, sem truncamento. Sessão `d6c7c239-cf43-4769-b215-e764baee7b3e`, script `a0dc9f6b-e45e-415a-aa49-9326b34ddc70`, evidência `ev_a05fc551367f49ac39539a90cda3f7fd75459fd199999f7afc3ed0ef96f62a08`. Journal `conveyor-chain-candidate105/journal.json`, bundle e comparação próprios. P2 cria a bomba no 105; no 198 ela muda para 0x8080 com timer0x0101, e no 199 para0xC080, muito antes do fusível normal do plantio105. A flag0x80 exige ampliar a interpretação do extrator, que só tratava estados exatos8000/9000/C000; não interpretar ausência do estado exato como ausência da bomba. Novo replay e teste ativo `SB2-CONVEYOR-CANDIDATE105-DRAFT-TESTS.json`; analisar o primeiro desvio antes de portar cadeia. Sessão/cliente encerrados, manifesto523; sem commit/push.

### Colisão entre bombas e alinhamento — 2026-11-02

O extrator agora mascara o byte baixo das flags de estado, preservando o word bruto: 0x8080/0xC080 não significam desaparecimento. Novo replay A105 corrigido. No frame141, o bloqueio de X mantém o alinhamento já aplicado em Y: restaurar ambos os eixos era incorreto. A correção mantém o eixo transversal e os 21 casos anteriores passam. No frame144 aparece contato entre a bomba P1 que sobe e a P2 no topo; o transporte agora consulta também os corpos de outras bombas. Relatório focado `SB2-CONVEYOR-BOMB-BODY-DRAFT-TESTS.json` registra o resultado atual; continuar pela primeira divergência restante antes de certificar a cadeia. Sem commit/push.

### Retorno estático na cadeia reproduzido — 2026-11-02

A bomba móvel atingida por uma chama volta à célula estática com um frame restante, removendo o fogo dessa célula enquanto permanece sólida. Isso reproduz o frame198 da captura A105 e mantém os 21 percursos anteriores. O desvio restante avançou à explosão: o original acende o centro no199 e só amplia os braços no201, enquanto o explode atual acende todos os braços juntos. A próxima implementação deve preservar essa etapa intermediária, sem alterar os tempos dos casos estáticos já validados. Relatório `SB2-CONVEYOR-CHAIN-STATIC-DRAFT-TESTS.json`; integração de cadeia ainda parcial, com um caso ativo divergente. Sem commit/push.

### Cadeia móvel integrada — 2026-11-02

O replay A105 agora passa pelos 260 frames. A bomba atingida volta ao estado estático no198, acende o centro no199 e os braços no201. Os braços atrasados são estado serializável pendingChainArms, separado da lista de bombas já removidas. A nova expansão prolonga as células de chama sobrepostas e o centro até a expiração observada; a política antiga de não reiniciar chamas permanece para explosões estáticas comuns. Os 22 percursos de esteira e 24 casos de bombas SB2 estáticas passam. A captura REA/MCP nativa demonstra antecipação da bomba P2 plantada105; não é mera previsão do modelo. Outras configurações de cadeia móvel, chute/luva, demais arenas e QA visual continuam pendentes. Sem commit/push.

Regressão final: 1341 testes compartilhados aprovados; typecheck dos três pacotes aprovado após correção de booleano opcional; 35 arquivos protegidos SB4 idênticos.

### Cadeia ampliada A120/A125 — 2026-11-02

Dois novos percursos de260 frames, P1 A53/UP54–105 e P2 A120/A125, UP26/LEFT26. Foram522 leituras MCP/REA iguais sem truncamento, sessão `65d505ab-e91d-468f-a285-04c8e5cd1d82`, script `db101fe5-ba11-4999-b46e-a50d4a6e6e29`, evidência `ev_10e10379e9f3b08860d7ca5962ac2164c31b42dcc87a8a68c8191ae9d9d035f0`. Journal `conveyor-chain-expansion/journal.json`, bundle/replay/comparação próprios. Sessão/cliente fechados; manifesto524. O teste agora restaura JSON no frame200 também, entre centro e braços na cadeia A105. Resultado focado: 23 aprovados e 1 falhas, relatório `SB2-CONVEYOR-CHAIN-EXPANSION-TESTS.json`. Sem commit/push.

A125 passa integralmente e a restauração no frame200 mantém a cadeia A105. A120 diverge no próprio plantio do frame120 (modelo duas bombas, nativo uma): investigar a reserva e o índice ocupado naquele instante com os novos registros2600/2720, sem alterar alcances por tentativa. Última suíte completa verde:1.341 testes, anterior a esses dois casos.

### Publicação da reserva antes do plantio — 2026-11-02

Em A120, a reserva passa de0x508 no frame119 para0x488 no120, coincidindo com P2 antes da consulta do botão A. O controlador agora publica a reserva do passo no prepare, usando o índice ocupado anterior e a direção corrente, antes de processar os jogadores. Preserva inicialização sem reserva e o cálculo do índice proposto antes da colisão. Os 24 percursos completos e os 133 registros diretos passam; A120 é rejeitado e A125 aprovado como no original. A restauração JSON no200 continua preservando os braços atrasados da cadeia A105. Sem commit/push.

Regressão final: 1343 testes compartilhados aprovados; typecheck dos três pacotes aprovado; 35 arquivos protegidos SB4 idênticos. Outras interações, arte/seletor e demais arenas continuam pendentes.

### Arena 6: controlador de entrada e trava dos portais (2026-11-02)

`stepSb2Stage6Warp` agora consulta a célula nativa antes do deslocamento PAL,
conserva as frações na chegada e mantém uma trava por jogador até sair da
célula de destino. O estado é serializável. A consulta usa `(X-8)/16` e
`(Y-25)/16`, com arredondamento para baixo, como nas transições capturadas.

Quatro replays de posição confrontam os trechos `warp-detail-0..8`,
`warp-return-1..24`, `blue-enter-1..8` e `blue-return-1..2` com o bundle
REA/Snes9x já preservado. Os intervalos são percorridos em passos nativos,
sem injetar posições intermediárias. Um quinto teste mantém a chegada
travada durante 300 passos, serializando o estado entre os passos.
Os replays isolam portais e deslocamento livre; não substituem um replay
completo do simulador, colisões ou uma nova execução do emulador.

O controlador ainda não está ligado ao fluxo de partidas. Permanecem
pendentes ocupação, bombas, entrada simultânea e validação do mapa integrado.

### Arena 6 ligada ao simulador interno (2026-11-02)

O ID interno `sb2-06` passa pelo criador nativo, bolsa/RNG próprios da sexta
arena, relógio PAL e movimento SB2. O código nativo `80 & 63 = 16` representa
as quatro células de portal transitáveis da grade capturada. Nenhum piso
warp genérico de SB4 foi aplicado. `prepareSb2Stage6` converte as posições
para coordenadas nativas, mantém a trava separada por jogador e aplica a
chegada antes do movimento. Mortos não conservam a trava; jogadores elevados
não são transportados. Estas últimas condições ainda exigem ensaio nativo
específico, assim como a ordem entre portais e contatos de dano.

Os quatro trechos anteriores também passaram pelo `step` real, restaurando
somente grade e posições iniciais de cada captura. Depois disso foram
aplicadas entradas direcionais, sem injeção de posições intermediárias, com
serialização da partida após cada passo nativo. Todos os pontos de comparação
coincidiram. Os testes do criador confrontam as quatro posições da arena 6;
a bolsa/RNG e a filtragem da visão pública também incluem o novo ID.

Verificação deste avanço: 1.355 testes compartilhados em 112 arquivos;
typechecks de shared, cliente e servidor passaram; `git diff --check` passou.
Os 35 arquivos protegidos da base SB4 conservam seus hashes; somente arena.ts
e stage.ts diferem da base histórica, conforme integração já documentada.
Esta rodada reutilizou evidência REA/MCP preservada, sem nova sessão nativa.
A arena segue fora do seletor até concluir suas interações e arte.

### Arena 6: plantio nos portais medido no original (2026-11-02)

Nova sessão do Snes9x 1.63 PAL, observada pelo REA/Frida, retomou o estado
`two-human-arenas/arena-06.state`. Dois humanos, demais jogadores OFF;
somente comandos originais, sem escrita de RAM. Estado de entrada preservado
em `output/sb2-research/warp-bombs/entry.state`; chamadas completas no journal
da mesma pasta. A sessão foi encerrada após a exportação.

- Evidência: `ev_54afa2d3b2c9d9293ada7ee4be866b40b047d2bb8a2cc614a7ba78ad4348a195`.
- Script: `497bd344-614e-42fb-92b9-f6de04ec531c`.
- Bundle: `docs/sb2/SB2-REA-WARP-BOMBS.json`.
- Comparação: `docs/sb2/SB2-WARP-BOMBS-COMPARISON.json`.
- Replay derivado: `docs/sb2/SB2-WARP-BOMBS-REPLAY.json`.

As 427 leituras coincidiram entre MCP e REA: 166.530 células, 437.248 bytes
de jogadores, 437.248 bytes de estruturas candidatas de bombas e 2.186.240
bytes das regiões auxiliares; nenhuma mensagem truncada.

Seis ensaios de 70 passos cada:

1. A no frame da entrada: transporta o jogador, sem criar bomba.
2. A um frame após chegar: permanece sem bomba sobre o portal.
3. A após sair: cria bomba em `(11,10)`.
4. A enquanto DOWN cruza de Y=71.75 para Y=73: rejeita plantio.
5. A enquanto DOWN cruza de Y=184.75 para Y=186: cria em `(11,10)`.
6. A parado em Y=71.75: cria em `(3,2)`; a bomba permanece na origem quando
   o jogador entra e é transportado no passo seguinte.

Os controles 4/5/6 situam a consulta de plantio após o movimento na arena 6.
`step` foi ajustado para essa arena; `placeBomb` rejeita as quatro células de
portal. As outras arenas conservam a ordem já testada até ensaio equivalente.
As rejeições foram confirmadas tanto na grade quanto pela capacidade nativa
inalterada e ausência de estrutura de bomba; não dependem apenas do desenho.

`sb2-warp-bombs-step.test.ts` reproduz os seis percursos pelo step real,
restaurando somente cenário/posições iniciais e, no ensaio de saída, a trava
de chegada já observada. Depois aplica apenas botões, serializa a partida e
confere os dois jogadores, a grade e as bombas em todos os 420 passos.
O extrator refaz o confronto REA/MCP antes de emitir o replay.
Ainda faltam explosão sobre portal, transporte por chute/luva, simultaneidade,
contatos de dano e animação/arte; estes ensaios param antes da explosão.

### Arena 6: ciclos de chama e contatos letais (2026-11-02)

Duas novas capturas originais, ambas observadas pelo REA e pelo MCP Snes9x,
foram preservadas e confrontadas sem truncamento. As sessões foram encerradas.

**Explosões:** `output/sb2-research/warp-flames/journal.json`;
bundle `docs/sb2/SB2-REA-WARP-FLAMES.json`; comparação
`docs/sb2/SB2-WARP-FLAMES-COMPARISON.json`; replay
`docs/sb2/SB2-WARP-FLAMES-REPLAY.json`.
Evidência `ev_b752ed31d11e22b01ba109f3d03bdabb99efbff21274bd81457df0be21755b80`,
script `133107d5-f15c-4e67-a736-5830b7ae44ae`.
Foram 462 leituras, 180.180 células, 473.088 bytes de jogadores e igual
quantidade de estruturas candidatas, mais 2.365.440 bytes auxiliares.

Os dois ensaios anteriores foram estendidos a 230 passos. A bomba em `(11,10)`
incendiou `(11,9)` no passo 156 e o portal foi restaurado no 182. A bomba em
`(3,2)` incendiou `(3,3)` no passo 145 e restaurou o portal no 171. Portanto,
os portais recebem chama por 26 frames nesses casos; a chama atravessa o piso
especial, alcança o bloco seguinte e não aparece no portal pareado distante.
A grade mantém o bloco enquanto ele queima, mudando para item no passo 191
ou 180, respectivamente. Não confundir as três células com código de fogo
visível com alcance limitado: o bloco além do portal também foi atingido.

**Contatos:** `output/sb2-research/warp-contacts/journal.json`;
bundle `docs/sb2/SB2-REA-WARP-CONTACTS.json`; comparação
`docs/sb2/SB2-WARP-CONTACTS-COMPARISON.json`; replay
`docs/sb2/SB2-WARP-CONTACTS-REPLAY.json`.
Evidência `ev_390084b68138115b483b30c5fc611a68a3496df4e1ce978e262091eb65061515`,
script `62d4c5d9-acd4-4ac4-bc3e-2a2a30880911`.
Foram 543 leituras, 211.770 células, 556.032 bytes de jogadores e igual
quantidade de estruturas candidatas, mais 2.780.160 bytes auxiliares.

Três percursos de 180 passos mediram:

- `burning-entry`: retorno ao portal de origem, bloqueado pela bomba em
  `(3,2)`, permanecendo no portal até a ignição. O nome histórico do ensaio
  foi mantido; não é aproximação de fora no instante da ignição. Morre no
  passo 146, após avançar de Y=80 para Y=81.25.
- `burning-arrival`: entra no portal intacto de destino e chega ao portal
  original em chamas. Transporte e morte ocorrem no mesmo passo 148,
  terminando em `(64.5,79.5)`.
- `burning-side`: sai lateralmente, espera e retorna pela esquerda. No passo
  164 chega a X=57; no 165 avança a X=58.25 e morre, sem teleporte. O código
  corrente de fogo substitui o efeito de transporte do portal.

`prepareSb2Stage6` agora ignora o transporte ao consultar uma célula em chamas.
O movimento da arena 6 reutiliza o teste corporal já existente para bloquear
bombas vizinhas sem alterar a fração do avanço. No retorno medido, Y=80.75
permanece igual enquanto UP é bloqueado pela bomba. O frame de contato letal
avança a velocidade nativa antes da morte, como medido inclusive junto ao
bloco, e é resolvido pelo contato já amostrado. Estes ensaios usam jogadores
normais, sem invulnerabilidade ou outros equipamentos especiais.

Os 11 replays de plantio/explosão/contato passam no step real: 1.420 passos
nativos, serialização após cada frame, posições/estado vivo dos dois jogadores,
grade, bombas e fogo visível; nos cinco novos percursos também bolsa, RNG e
itens revelados. Somente o cenário inicial é restaurado. O extrator foi
ampliado para validar explicitamente a quantidade de casos e passos exigidos;
as capturas e o replay antigo de 70 frames foram preservados.

Continuam pendentes chute/luva sobre portal, outros estados de inventário,
simultaneidade, animação e integração visual. A arena permanece interna.

### Arena 6: entradas simultâneas e portais ocupados (2026-11-02)

Nova captura, sem escrita de RAM, usou o mesmo estado original com dois MAN
e jogadores 3/4 OFF. Foram 485 leituras conferidas integralmente entre o MCP
do Snes9x e o observador REA: 189.150 células, 496.640 bytes de jogadores,
496.640 bytes de estruturas candidatas e 2.483.200 bytes auxiliares; sem
truncamento. A sessão foi encerrada após exportar a evidência.

- Journal: `output/sb2-research/warp-multiplayer/journal.json`.
- Bundle: `docs/sb2/SB2-REA-WARP-MULTIPLAYER.json`.
- Comparação: `docs/sb2/SB2-WARP-MULTIPLAYER-COMPARISON.json`.
- Replay: `docs/sb2/SB2-WARP-MULTIPLAYER-REPLAY.json`.
- Evidência: `ev_b719992eb6f37fa4277ec80728bc15883b8bab7b933fcf8b691e345bfde01780`.
- Script: `53b0bcab-1c58-484a-80b7-8d33c5d07da3`.

Cinco percursos de 96 frames: P1 chega pela parte superior e P2 pela inferior,
com atrasos de zero, um ou dois frames no início de P2; os dois fazem o
retorno após sair dos portais. Outros dois percursos mantêm um jogador
parado no portal de chegada, enquanto o outro retorna ao mesmo portal,
cobrindo os dois sentidos do par vermelho.

Em `delay-1`, no passo 20, P1 está em `(64.5,73)` e P2 em `(192.75,184.25)`.
No passo 21 os dois transportam: P1 para `(192.5,177.25)` e P2 para
`(64.75,79)`. Não houve bloqueio entre os jogadores nem perda das frações.
Em `occupied-source-68` os dois dividem a chegada: P1 `(64.5,79.5)`,
P2 `(64.75,79)`. Em `occupied-destination-71`, ambos ficam em Y=177.25,
com X=192.5 e X=192.75. Permanecem parados sem retorno automático até o
fim das respectivas capturas. Portanto, nestas configurações, a trava é
individual e um jogador no destino não impede o transporte do outro.

O extrator agora preserva os botões de P2. Os cinco percursos passam no step
real, com entradas dos dois humanos e serialização após cada frame nativo,
comparando ambos os jogadores, grade, bombas/chamas, bolsa e RNG. O controlador
existente já reproduziu o resultado sem exigir regra adicional de ocupação.
O conjunto da arena tem 16 replays e 1.900 passos; permanecem pendentes
chute/luva, quatro jogadores, outros inventários e integração visual.

### Arena 4: canaleta ligada ao step interno (2026-11-02)

O ID `sb2-04` foi integrado ao criador, ao relógio PAL, à bolsa/RNG da quarta
arena e ao fluxo de bombas. As quatro posições centrais foram confrontadas
com a captura REA no teste do criador. O código nativo 14 é transitável e
permanece distinto de pisos genéricos nos dados originais; não foi aplicado
um efeito de SB4. O ID continua fora do seletor público.

Uma sessão nova do original retomou `two-human-arenas/arena-04.state`, dois
humanos e demais jogadores OFF, sem escrita de RAM. Quatro percursos de 200
frames colocaram a bomba em `(4,5)` após esperas consecutivas de 0/1/2/3
frames. P1 retirou-se para `(7,7)`; P2 ficou na posição nativa. Chamadas em
`output/sb2-research/channel-phases/journal.json`; sessão encerrada.

- Bundle: `docs/sb2/SB2-REA-CHANNEL-PHASES.json`.
- Comparação: `docs/sb2/SB2-CHANNEL-PHASES-COMPARISON.json`.
- Replay: `docs/sb2/SB2-CHANNEL-PHASES-REPLAY.json`.
- Evidência: `ev_0354a5a0a9c8b0a4a1d6b438aaed1c3f9671fa653bad377992a0c38beb243a14`.
- Script: `2a612e0a-8d6c-47b0-9ccb-61d35a2cabcf`.

REA/MCP coincidiram em 804 leituras: 313.560 células, 823.296 bytes de
jogadores, igual quantidade de estruturas candidatas de bombas e 4.116.480
bytes auxiliares, sem truncamento.

Nas fases 0/1, a explosão atingiu a canaleta no frame 6489, a ignição coletiva
começou em 6490 e terminou em 6520. A célula de contato `(3,5)` voltou ao
código 14 em 6515/6516 e foi reposta a fogo em 6517. As outras 27 células
mantiveram fogo durante toda a janela de 30 frames. Nas fases 2/3, os mesmos
eventos ocorreram dois frames depois: contato 6491, ignição 6492, lacuna
6517/6518, reposição 6519, apagamento 6522.

`sb2-stage4-controller.ts` registra o frame/autor do contato, acende no frame
seguinte e mantém a janela de 30 frames. A reposição a cada três frames é a
reconstrução operacional que reproduz a lacuna observada nas quatro fases;
a cadência completa de animação ainda não foi atribuída por leitura da ROM.
As chamas comuns conservam sua duração própria de 26 frames. O controlador
não substitui uma chama comum já presente; ao expirar, a lacuna dura até a
próxima reposição. Novas células recebem apenas a duração restante da janela,
sem estender a ignição. O estado do canal é serializável.

Os quatro casos passam no step real, 800 passos sem injeção de resultados
intermediários, com posições/estado vivo dos dois jogadores, grade, bombas,
fogo visível, bolsa e RNG conferidos a cada frame. A serialização é exercida
após todos os passos. O teste existente de portais passou a carregar também
o replay da canaleta, preservando seus 16 casos anteriores.

Verificação: 1.378 testes compartilhados em 113 arquivos; typechecks de shared,
cliente e servidor passaram; diff sem erros. Os 531 arquivos do manifesto
foram revalidados por tamanho/SHA256, e os 35 arquivos protegidos SB4 mantêm
seus hashes. Somente arena.ts e stage.ts diferem da base histórica conforme
integração já documentada. Ainda faltam reativação por outra explosão, bombas
sobre a canaleta, dano, inventários especiais e animação/arte.

### Arena 4: plantio na canaleta e limites temporais do dano (2026-11-02)

Dois ensaios novos no original, observados simultaneamente por REA e MCP,
retomaram o estado de dois humanos sem escrita de RAM. As sessões foram
encerradas após preservar os bundles.

**Plantio e contatos:** journal `output/sb2-research/channel-contacts/journal.json`;
bundle `docs/sb2/SB2-REA-CHANNEL-CONTACTS.json`; comparação
`docs/sb2/SB2-CHANNEL-CONTACTS-COMPARISON.json`; replay
`docs/sb2/SB2-CHANNEL-CONTACTS-REPLAY.json`.
Evidência `ev_ac672dd9c41ab98e4a8af1c5be1c66c5c69d4cf2a397736802bd9b6bf9f9fae8`,
script `38c4823a-afa9-4ff0-9acb-1f4382dd8c55`.
As 1.005 leituras conferiram 391.950 células, 1.029.120 bytes de jogadores,
igual quantidade de estruturas candidatas e 5.145.600 bytes auxiliares;
nenhuma mensagem truncada.

Cinco percursos, 200 frames cada:

- `plant-channel`: A sobre `(3,5)` cria bomba, consome a capacidade nativa e
  mantém o jogador no piso. A morte ocorre no passo 146. Portanto, a canaleta
  permite plantio; não aplicar a proibição dos portais da arena 6.
- `burn-stay`: bomba em `(4,5)`, P1 retirado para `(3,7)` antes da ignição.
  Morre no passo 147, o primeiro frame da ignição coletiva.
- `burn-enter`: aproximação depois do início do fogo; chega ao piso no passo
  154 e morre no 155, após avançar para X=69.75.
- `leave-before`: tenta sair para X=72.25 no passo 147 e morre nesse mesmo
  frame. O rótulo histórico foi mantido: a tentativa coincide com a ignição,
  não com o último frame seguro anterior.
- `leave-after`: espera um frame a mais para sair; já morre no 147, em X=71.

Os três casos de ignição coletiva divergiram na integração anterior, cujo
fogo só era criado depois da consulta de dano. A atualização do controlador
foi movida para antes da amostragem de contatos do step PAL. As chamas da
canaleta têm uma marca serializável `sb2Channel` e seu tempo é avançado pelo
controlador, evitando desconto duplicado no atualizador de bombas. As chamas
comuns continuam com seu próprio relógio e a lacuna sobreposta foi preservada.

**Apagamento:** journal `output/sb2-research/channel-expiry/journal.json`;
bundle `docs/sb2/SB2-REA-CHANNEL-EXPIRY.json`; comparação
`docs/sb2/SB2-CHANNEL-EXPIRY-COMPARISON.json`; replay
`docs/sb2/SB2-CHANNEL-EXPIRY-REPLAY.json`.
Evidência `ev_94571c1ed9f3eb0477043a9ddfdb96f32be113991a60d03a1674138ff7e00b55`,
script `9a50e9b4-4100-4895-8c8d-31439bc8b351`.
As 402 leituras conferiram 156.780 células, 411.648 bytes de jogadores,
igual quantidade de estruturas candidatas e 2.058.240 bytes auxiliares;
nenhuma mensagem truncada.

Duas aproximações de 200 frames diferem por um frame no começo do último
movimento. `expiry-170` entra no piso no passo 175 e morre no 176, último
frame ativo. `expiry-171` chega no 176 e permanece vivo: no passo 177 o piso
já apagou antes da consulta de dano. A remoção das chamas da canaleta antes
dessa consulta reproduz tanto o início quanto o fim do perigo.

Os sete casos novos passam no step completo sem injeção de posições ou
estados intermediários, incluindo a sobrevivência no limite final. Somados
às quatro fases anteriores, a arena 4 tem 11 percursos e 2.200 passos nativos
com serialização e comparações de ambos os jogadores, grade, bombas, fogo,
bolsa e RNG. Ainda faltam reativação por outras explosões, proteção/inventário
especial, simultaneidade e animação/arte.

### Arena 4: segunda explosão e relógio nativo atribuído à ROM (2026-11-02)

Nova captura com dois MAN, sem escrita de RAM, usou duas bombas: P1 em `(4,5)`
e P2 em `(10,7)`. Após A de P1 no passo 1, P2 pressionou A nos passos 12,
28 ou 40, em três percursos de 260 frames. Ambos recuaram para o centro.

- Journal: `output/sb2-research/channel-repeat/journal.json`.
- Bundle: `docs/sb2/SB2-REA-CHANNEL-REPEAT.json`.
- Comparação: `docs/sb2/SB2-CHANNEL-REPEAT-COMPARISON.json`.
- Replay preparado: `docs/sb2/SB2-CHANNEL-REPEAT-REPLAY.json`.
- Evidência: `ev_1620640313592bc5b66255edc0875b4f74284c4e68350cc70cc2162979314d51`.
- Script: `7a533ad5-2335-4f65-a310-3201c34606af`.

Todas as 783 leituras coincidiram: 305.370 células, 801.792 bytes de jogadores,
igual quantidade de estruturas candidatas e 4.008.960 bytes auxiliares;
sem truncamento. A sessão foi encerrada.

O primeiro ciclo começou no passo 147 e apagou no 177 nos três ensaios.
Nos intervalos 12/28, a segunda bomba explodiu nos passos 158/174. A chama
comum em `(11,7)` reapareceu no 178, após a restauração coletiva, e houve
nova ignição coletiva no 181, terminando no 211. No intervalo 40, a segunda
explosão ocorreu no 186, com a nova ignição coletiva em 189 e término em 219.
As células sobrepostas mantêm lacunas próprias. Portanto, ignorar para sempre
uma segunda explosão durante o primeiro ciclo é insuficiente: sua animação
comum pode solicitar outra ignição depois do apagamento coletivo.

A região WRAM `7E5CE2/7E5CE4`, incluída no confronto REA, revelou índice e
temporizador do controlador. Busca direta na mesma ROM (hash já registrado)
localizou referências longas em C03A92, C03C67 e C0E919. Os bytes e a
atribuição parcial estão em `docs/sb2/SB2-CHANNEL-CLOCK-SAMPLES.json`:

- C03A92 retorna quando o índice é negativo; caso contrário, desconta o
  temporizador. Ao chegar a zero (inclusive se já era zero), recarrega 3,
  desenha os quatro lados e incrementa o índice. Onze vira -1.
- O desenho usa o índice anterior ao incremento. C03C67 escreve código 14
  no índice 10; nos índices 0..9 escreve fogo (código 1).
- C0E919 solicita índice zero somente quando inativo e não zera o timer.
  Na primeira solicitação o timer vale zero, permitindo começar no frame
  seguinte. Após terminar, ele conserva 3, explicando os reinícios tardios.

`Sb2ChannelClock`, `requestSb2Channel` e `advanceSb2ChannelClock` implementam
esse relógio. Três testes conferem todas as 783 amostras, serializando a cada
passo. As solicitações são eventos observados pela transição inativo→zero;
este teste isola o relógio, não prova que o simulador já produz essas
solicitações a partir dos botões. A extração revalida o confronto REA/MCP e o
hash da ROM antes de emitir o fixture.

O controlador interno passou a usar o relógio atribuído à ROM, conservando o
timer quando fica inativo. Os 11 replays completos anteriores da arena 4
continuam passando, assim como os 16 da arena 6. **Os três novos percursos de
duas bombas ainda não estão certificados no step completo.** Falta preservar
a animação comum sobreposta à chama da canaleta e reproduzir sua reescrita,
que solicita a segunda ignição. Não contar os testes isolados do relógio
como mais três integrações completas. Próximo passo: confrontar esses três
replays com associação das bombas dos dois autores, então integrar essa
camada sem alterar os casos já verificados.

### Arena 4: três reativações no step completo (2026-11-02)

Os três percursos de duas bombas preservados na rodada anterior agora passam
no simulador completo. Esta rodada reutilizou a evidência REA/MCP verificada,
sem abrir outra sessão nativa. O extrator foi ampliado para associar bombas
estáticas pela posição da entrada (`+0A`) e pelo byte de autor (`+06`), em
vez de supor um único autor. As 783 amostras tiveram essa associação
reconferida contra o dump original. A cobertura é das primeiras duas entradas
estáticas; reutilização de slots e listas maiores ainda exigem ensaios.

O replay definitivo usado pelo teste é
`docs/sb2/SB2-CHANNEL-REPEAT-CLOCK-REPLAY.json`; versões derivadas anteriores foram
preservadas. Além de posições/estado vivo dos dois humanos, grade, bombas,
chamas, bolsa e RNG, o teste confere os autores das bombas e o relógio da
canaleta em cada frame. Os botões dos dois humanos são as únicas entradas
depois da restauração do cenário inicial. Há serialização após cada passo.

A primeira divergência não era do controlador da canaleta: P2 explodia dois
frames antes. No contador nativo 292, a primeira entrada muda de `8000` para
`C000`, e o temporizador da segunda entrada permanece em 6, 14 ou 20 nos
três ensaios. A rotina C0E0AB atualiza bombas em contadores pares; quando
C0E980 acaba de ativar o bit `4000`, retorna da varredura, sem visitar as
entradas seguintes naquele passo. Entradas já em animação continuam por
outro ramo. Bytes da ROM, atribuição parcial e os três pares de estados
conferidos estão em `docs/sb2/SB2-BOMB-SCAN-ROM.json`, gerado pelo extrator
`tools/sb2-research/extract_bomb_scan.py` com nova verificação REA/MCP e do
hash da ROM.

`updateBombs` compensa o passo par perdido pelas bombas estáticas seguintes
quando uma entrada anterior entra na preparação (fuse 2). Isso reproduziu as
três explosões de P2 sem alterar os 24 percursos completos de esteiras nem
os ensaios anteriores de bombas/encadeamento.

A segunda divergência era a chama comum escondida pelo efeito coletivo.
`channelCommonFlames` agora preserva sua origem, autor e frame de nascimento.
A varredura par de animações comuns continua por 26 frames, mesmo quando a
célula visível pertence à canaleta. Quando volta a escrever no piso, solicita
a ignição se o controlador está inativo; quando termina, restaura a célula
mesmo que a canaleta tenha escrito fogo no começo desse frame. As lacunas
sobrepostas e a próxima reposição coletiva permanecem independentes.

Assim, os casos 12/28 apagam o primeiro ciclo em 177, reescrevem a chama
comum em 178, reacendem coletivamente em 181 e terminam em 211. O caso 40
atinge o piso em 186, reacende em 189 e termina em 219. Esses tempos, as
lacunas de `(11,7)` e o índice/temporizador do controlador coincidiram em
cada um dos 780 passos novos, sem inserir solicitações observadas no modelo.
A arena 4 passou a ter 14 replays completos e 2.980 passos nativos, incluindo
os 11 cenários anteriores. Os testes isolados do relógio continuam separados.

Verificação desta integração: 1.391 testes compartilhados em 114 arquivos;
typechecks dos três pacotes passaram; diff sem erros. Os 35 arquivos
protegidos de SB4 mantêm seus hashes. Continuam pendentes inventários
especiais, mais bombas/slots, quatro jogadores, animação visual e arte.

### Arena 4: terceira bomba e sequência de três entradas estáticas (2026-11-02)

Nova sessão nativa REA/MCP, dois humanos e demais jogadores OFF, sem escrita
de RAM, estendeu os três intervalos anteriores a 340 frames. P1 recolocou
uma bomba no passo 145, assim que sua capacidade retornou na preparação da
primeira explosão. A terceira entrada ficou em `7F2200`, estado `8000`, autor
zero. A primeira e a segunda entradas ainda estavam presentes em seus ciclos.
Os dois humanos subiram e se retiraram para a direita, sobrevivendo ao final.

- Journal: `output/sb2-research/channel-three/journal.json`.
- Bundle: `docs/sb2/SB2-REA-CHANNEL-THREE.json`.
- Comparação: `docs/sb2/SB2-CHANNEL-THREE-COMPARISON.json`.
- Replay: `docs/sb2/SB2-CHANNEL-THREE-REPLAY.json`.
- Evidência: `ev_a19ab12ff4e9663533bec566a02b972c58ba99060850b4ce707dfcb9173f6529`.
- Script: `90237822-9de1-4101-845d-c2006f6801a1`.

As 1.023 leituras coincidiram: 398.970 células, 1.047.552 bytes de jogadores,
igual quantidade de estruturas candidatas, 5.237.760 bytes auxiliares e 42
palavras de glifos de itens; sem truncamento. Sessão encerrada após exportação.

O extrator passou a percorrer as oito entradas estáticas cobertas pelos
2.048 bytes do observador, associando posição e autor próprios de cada
entrada. Rejeita células sem associação e duplicidades; não supõe que o
índice do slot identifica o jogador. Não é suporte certificado aos 40 slots
originais ou à sua reutilização arbitrária.

Os três replays passam no step real, 1.020 passos nativos com entradas dos
dois humanos e serialização após todos os passos. Posições/estado vivo de
ambos, grade, todas as bombas e autores, fogo visível, bloco queimado/item
revelado, bolsa/RNG e índice/temporizador da canaleta coincidiram. O adiamento
da varredura também preservou o fuse da terceira bomba, inclusive enquanto
as duas entradas anteriores estavam em fases diferentes. A implementação
não precisou de outra regra para estes casos.

A arena 4 tem agora 17 casos completos e 4.000 passos nativos. As validações
anteriores da arena 6 e das correias continuam preservadas. Verificação:
1.394 testes compartilhados em 114 arquivos; typechecks dos três pacotes e
diff passaram. Os 535 arquivos do manifesto foram reconferidos por tamanho
e SHA256; os 35 arquivos protegidos SB4 conservam seus hashes.

Próximas lacunas permanecem: reutilização de entradas livres em ordem distinta
da criação, mais bombas, quatro humanos, inventários especiais e arte/animação.
Não tornar a arena selecionável com base apenas nestes percursos.

### Arena 2: captura nova e cinemática livre do gelo (2026-11-02)

O cenário de dois humanos já configurado foi retomado na seleção original.
Nove comandos LEFT, separados por esperas, levaram à arena 2; START iniciou
a partida. Não houve escrita de RAM nem nova configuração de jogadores.
A leitura confirmou seleção 1, jogadores 1/2 em estado `9000`, 3/4 OFF,
e P1 em `(32,48)`. Estado pronto preservado em
`output/sb2-research/ice-input/arena-02.state`; retomar esse arquivo nos
próximos ensaios em vez de repetir os menus. Sessão encerrada ao final.

- Journal: `output/sb2-research/ice-input/journal.json`.
- Bundle: `docs/sb2/SB2-REA-ICE-INPUT.json`.
- Comparação: `docs/sb2/SB2-ICE-INPUT-COMPARISON.json`.
- Replay: `docs/sb2/SB2-ICE-INPUT-REPLAY.json`.
- Evidência: `ev_08bab588aa30b2c67f7abfa9577978b4065cdbe5f709f006fa957d7fe851eb50`.
- Script: `12d898fc-2825-4592-8259-f3b8e7621119`.

Foram 389 leituras confrontadas, com 151.710 células, 398.336 bytes de
jogadores, igual quantidade de estruturas candidatas e 1.991.680 bytes
auxiliares; sem truncamento. Quatro percursos de 96 frames preservam:
RIGHT 8 seguido de soltura; DOWN 8 seguido de soltura; RIGHT 8 seguido de
LEFT 16 e soltura; RIGHT 8 seguido de DOWN 16 e soltura. P2 permaneceu parado.

Nos primeiros oito frames, os deslocamentos horizontais foram
`0.25,0.5,0.75,1,1.25,1.5,1.75,2`, levando X de 32 a 41. Ao soltar, o
movimento manteve 2 pixels por frame até a colisão; não houve desaceleração
nesse trecho. Na reversão, as velocidades foram `1.75,1.5,1.25,1,0.75,0`
e depois `-0.25,-0.5,-0.75,-1,-1.25,-1.5,-1.75,-2`. O frame zero ocorre
antes de inverter o sentido; não substituir por uma desaceleração linear
que passe por +0.5 e +0.25.

O extrator decodifica os pares inteiro/fração `+14/+16` e `+1C/+1E` das
velocidades e os bits de sentido em `+00`. Não ler esses pares como um
inteiro little-endian de 32 bits convencional. Magnitude zero independe do
bit de sentido; o teste normaliza o `-0` matemático do fixture original.
Posições e grades completas de todos os percursos foram mantidas.

`sb2-ice.ts` implementa um componente por eixo: aceleração de um quarto,
limite de dois, continuidade sem entrada e um passo de parada na reversão
quando a magnitude anterior ficou abaixo de um. Três testes comparam posição
e velocidade acumuladas desde o cenário inicial nos prefixos livres de
19/27/25 frames, totalizando 71. Nenhuma posição intermediária é injetada.
Os prefixos terminam antes do primeiro contato; não contam como replays de
colisão nem certificam os 384 passos completos. A troca de eixo permanece
preservada como evidência e ainda não foi implementada.

A arena 2 continua sem ID no step: faltam colisões, limites, resposta
transversal, distinção dos códigos de piso 7/8/9, bombas e interação com
inventário. A integração não deve reutilizar automaticamente o gelo de SB4.

Verificação desta rodada: 1.397 testes compartilhados em 115 arquivos e
os três typechecks passaram; diff sem erros. Os 538 arquivos do manifesto
foram reconferidos por tamanho/SHA256 e os 35 arquivos protegidos SB4
conservam seus hashes. Relatório em `docs/sb2/SB2-ICE-INPUT-TESTS.json`.

### Arena 2: quatro percursos completos no step (2026-11-02)

O ID interno `sb2-02` agora usa o criador nativo, bolsa/RNG da arena 2,
relógio PAL e controlador de gelo próprio. Os códigos 7/8/9 são preservados
nos dados de referência e tratados como transitáveis na grade de colisão;
a dinâmica específica dos pisos 8/9 ainda exige percursos próprios. Não foi
aplicado o efeito de gelo de SB4. A arena permanece fora do seletor público.

`sb2-stage2-controller.ts` guarda `vx/vy` por jogador em estado serializável.
A soltura conserva a velocidade, inclusive quando o chamador omite o input
inteiro. Uma entrada no outro eixo descarta a velocidade transversal e
inicia a nova aceleração. As consultas de colisão e a correção transversal
só acontecem ao cruzar um pixel inteiro; movimentos fracionários anteriores
são mantidos. O orçamento transversal/canto nos ensaios base é 1.25 pixel,
independente da velocidade longitudinal de gelo. O resolvedor SB2 existente
foi reutilizado, com parâmetro opcional de correção de canto cujo padrão
preserva os outros estágios.

Quando o avanço é limitado pela parede sem desvio transversal, o componente
de velocidade zera. O limite conserva a fração observada: RIGHT solto para
em X=64; DOWN solto em Y=96; a reversão à esquerda para em X=32.25. Não
recentralizar essa última posição para inteiro. Na troca RIGHT→DOWN, a
velocidade X zera no frame 9, mas Y avança .25/.5. No frame 11, a colisão
com o pilar restaura o eixo Y e corrige X de 41 para39.75. Depois corrige
X em passos de1.25 até32.25, enquanto Y retoma o avanço acelerado. Essa
sequência inteira é reproduzida sem inserir posições intermediárias.

`sb2-ice-step.test.ts` executa os quatro replays completos do fixture REA/MCP
preservado: 384 passos PAL. Confere posição e velocidade de P1, estado vivo
e grade após cada passo, serializando a partida a cada frame. Os inputs
neutros são omitidos para também conferir que o fluxo não interrompe a
inércia. Os 71 frames livres do teste isolado anterior continuam separados.
O teste do criador também inclui as quatro posições da arena 2; os testes
de bolsa/RNG e de filtragem da visão pública incluem o novo ID.

Esta rodada reutilizou a captura nativa anterior, sem reabrir menus ou
emulador. Verificação:1.404 testes compartilhados em116 arquivos, os três
typechecks e diff passaram. Os35 arquivos protegidos de SB4 mantêm hashes.
Não certificar a arena inteira: faltam outros percursos, pisos8/9, efeitos
de inventário, bombas sobre gelo, interações entre jogadores e arte/animação.

### Arena 2: plantio, corpo de bomba e explosão no gelo (2026-11-02)

Nova sessão do original retomou diretamente `ice-input/arena-02.state`, dois
MAN e demais jogadores OFF. Não houve repetição dos menus nem escrita de RAM.
Quatro percursos de 240 frames cobriram plantio ao cruzar célula, plantio
parado, retorno contra a bomba e plantio durante a soltura com inércia.
Sessão encerrada após exportação.

- Journal: `output/sb2-research/ice-bombs/journal.json`.
- Bundle: `docs/sb2/SB2-REA-ICE-BOMBS.json`.
- Comparação: `docs/sb2/SB2-ICE-BOMBS-COMPARISON.json`.
- Replay: `docs/sb2/SB2-ICE-BOMBS-REPLAY.json`.
- Evidência: `ev_6c2d232e1748d552ab8d549581723873cf372db3d4b82ed7e8440e13f33d278e`.
- Script: `c062cac9-fa4e-4de5-b969-c01692487e13`.

As 964 leituras coincidiram: 375.960 células, 987.136 bytes de jogadores,
igual quantidade de estruturas candidatas, 4.935.680 bytes auxiliares e 106
palavras de glifos de itens; nenhuma mensagem truncada.

RIGHT+A no oitavo frame cria bomba em `(2,1)`, embora o jogador estivesse
na célula anterior antes do avanço. A arena 2 agora processa o botão de bomba
depois do movimento, assim como a arena 6 já medida. As outras arenas
conservam suas ordens verificadas. Na saída lateral da bomba, o gelo não
aplica o recentramento lateral de objetos do resolvedor comum: o movimento
mantém a correção de 1.25 pixel e a fração final. A opção desse recentramento
continua ativada por padrão para os outros usos.

O plantio durante a soltura revelou o fim exato do alinhamento: X=34.25,
33 e32.75 nos passos18/19/20, conservando32.75 depois. O controlador de gelo
passou a usar alinhamento por parte inteira. Os percursos anteriores
continuam coincidindo.

Na reversão vertical medida, Y chega a77.25 com velocidade+.75 no passo21;
os passos22 e23 têm velocidade zero e o24 começa em-.25. O controlador
preserva o segundo frame zero com estado serializável de reinício vertical.
Os dumps mostram a liberação/rearme da trava e mudança de sentido nesses
frames; os caminhos C0C1E3/C0A2F3 foram examinados parcialmente. Não contar
isso como certificação de toda combinação de eixo, velocidade ou inventário.

O retorno contra a bomba para em Y=64.25 no passo34. A tentativa fracionária
seguinte leva a64, e o próximo cruzamento de pixel fica bloqueado sem mudar
a fração. O controlador reutiliza o teste corporal nativo já existente,
ignorando a bomba da própria célula durante a saída. Ao bloquear, restaura
o eixo longitudinal e zera sua velocidade, preservando eventual correção
transversal já executada. Isso evita a oscilação artificial64/64.5.

Os quatro casos novos passam no step completo:960 passos com posições e
velocidades dos dois humanos, estado vivo, grade, bombas/autores, chamas,
bloco queimado/item, bolsa e RNG comparados após cada frame; serialização
em todos os passos. O extrator agora preserva as velocidades nas estruturas
completas de jogadores. Os quatro percursos anteriores também passam,
totalizando oito casos e1.344 passos na arena2.

Verificação:1.408 testes compartilhados em116 arquivos, três typechecks e
diff passaram. Os539 arquivos do manifesto foram conferidos por tamanho e
SHA256; os35 arquivos protegidos SB4 conservam seus hashes. Ainda faltam
pisos8/9, outros sentidos/velocidades, inventários, chute/luva, multiplayer
ativo e integração visual. A arena continua interna.

### Arena 2: círculos, percurso automático e junções (2026-11-02)

A inspeção da imagem nativa `arenas-initial/arena-02.png` e da grade mostrou
que o código baixo9 corresponde aos seis círculos escuros,8 ao traçado
metálico e10 às duas junções centrais do fundo. Esses elementos não devem
ser generalizados como gelo comum. O código10 estava sob blocos na captura
inicial e, por isso, não apareceu como célula livre no criador interno.

Um ensaio novo REA/MCP retomou `ice-input/arena-02.state`, abriu o corredor
com uma bomba original em `(3,1)` e retirou o jogador para segurança. Depois
retornou ao corredor e aproximou-se do círculo `(3,3)`, sem escrever RAM.
Foram preservados `ice-floor/cleared.state` e `ice-floor/entry.state`; usar
estes estados nas próximas medições em vez de repetir a abertura do acesso.
Houve coleta de itens durante esse acesso: os primeiros três bytes de
inventário E0/E1/E2 eram1/1/1 em clear-0,1/2/1 em entry-0 e2/2/1 em entry-20.
Não tratar essa preparação como cenário de inventário inicial intacto.

- Journal: `output/sb2-research/ice-floor/journal.json`.
- Imagem: `output/sb2-research/ice-floor/transport-120.png`.
- Bundle: `docs/sb2/SB2-REA-ICE-FLOOR.json`.
- Comparação: `docs/sb2/SB2-ICE-FLOOR-COMPARISON.json`.
- Observações/ROM: `docs/sb2/SB2-ICE-FLOOR-OBSERVATIONS.json`.
- Evidência: `ev_ce2f5614ed3316841b4fdf0491f3a6abdf4fe3edd119c019b6ce38abed04ea63`.
- Script: `035dd089-35b1-4397-9899-1443fcbe6b84`.

As725 leituras coincidiram:282.750 células,742.400 bytes de jogadores,
igual quantidade de estruturas candidatas,3.712.000 bytes auxiliares e54
palavras de glifos; sem truncamento. A sessão foi encerrada após exportação.

No percurso entry, o jogador chega a `(64.25,74.75)` no passo21. No22, a
posição vai para `(64.25,80.75)`, a palavra+02 passa a0800 e ambas as
velocidades ficam zero. Permanece nessa posição até33. No34, Y vai para90.75
com velocidade2, e o percurso segue automaticamente. No48 está em
`(76.25,112.75)` movendo-se à direita apesar de DOWN continuar pressionado.
No80 está em `(128.25,132.75)`, após virar na junção; no96 segue à esquerda
em `(102.25,144.75)`. Não inventar uma interpolação simples para a pausa e o
lançamento de10 pixels: a sequência nativa está preservada para reconstrução.

Três variantes de200 frames repetem DOWN até20 e depois usam soltura, UP
ou LEFT. Soltura e UP seguem o transporte após ativar, conservando frações
Y distintas (.75/.5); o input efetivo +6E fica zerado durante o estado medido.
LEFT é aplicado antes da ativação e impede que a aproximação alcance o ponto
que inicia o transporte, mantendo Y=72.75. Isso não prova cancelamento de um
transporte já iniciado. Todos os725 estados foram extraídos com posições,
velocidades, células correntes/de fundo, modo, travas e direção.

A rotina C05841 despacha o transporte pela direção; C0586F e vizinhas
consultam8/9/10 nas células vizinhas do fundo. C05977 detecta código10 e usa
uma trava em+52 bit0040 para não escolher repetidamente na mesma junção.
A palavra em000406, mascarada por001E, indexa C5EB4D, cuja tabela é
`2,4,8,16` repetida quatro vezes. C5EB6D fornece o sentido oposto da direção
corrente. Se a escolha seria o oposto, o fallback lê C5EB4D usando o código
da direção corrente mais2, não o índice aleatório anterior. Os bytes estão
no relatório, com hash da ROM validado pelo extrator.

As seis escolhas observadas usam0406=34 (valor constante nestes percursos):
RIGHT2→DOWN8 no passo71 e DOWN8→LEFT4 no84, no percurso entry e nas duas
variantes que ativaram o transporte. `sb2-stage2-route.ts` reproduz essas
seis escolhas em teste isolado. Não substituir essa palavra pela randomWord
0400 do modelo de itens nem afirmar que0406 muda a cada frame; isso não foi
observado. O extrator confronta REA/MCP e o hash da ROM antes de emitir os
estados e eventos de junção.

**Integração ainda pendente:** esses percursos automáticos não passam pelo
step atual e não foram contados como replays completos. O módulo novo só
seleciona a direção na junção; faltam ativação, pausa, lançamento, avanço e
saída do circuito e integração da palavra0406. Os oito replays anteriores
de gelo/bombas continuam passando, mas não certificam a arena inteira.

### Arena 2 — preparação e lançamento identificados na ROM

`tools/sb2-research/extract_ice_launch.py` reconfronta os 725 estados do
journal com a evidência REA/MCP existente antes de extrair as transições.
Resultado em `docs/sb2/SB2-ICE-LAUNCH-OBSERVATIONS.json`: três ativações completas
(entry, neutral-route, opposite-route), todas com 12 quadros estacionários,
do índice22 ao33; lançamento no34. Não houve nova captura nem alteração de RAM.

C04468 controla esta preparação. Se o modo+02 ainda não tem0800, a fase
global7E5D0E bit0001 pode impedir a entrada. C04599 chama o recentramento
C0456D e grava+52=0801, +02=0800, +6A=0, +50=4; zera controles efetivos e
inicia a animação. C0456D altera as palavras inteiras de posição; as frações
permanecem. A máscara7E5D3C capturada é00FF.

Durante a preparação, C04468 aguarda+0C=0FFF, a sentinela final da animação.
Nos três casos ela aparece no33. No passo seguinte a rotina marca+52 bit0400,
C04540 marca0200 e escolhe a animação seguinte; C044E3 marca0100, aplica
deslocamento inteiro de8 em Y e velocidade2. O sentido inicial depende da
posição A8: abaixo de0480 desloca+8 e segue para baixo; a partir de0480
desloca-8 e segue para cima. Só a entrada superior foi observada nestes casos;
a entrada inferior ainda precisa de validação dinâmica. O avanço de2 no mesmo
quadro explica o deslocamento total+10 no lançamento capturado, sem postular
velocidade10. Os estados resultantes têm+52=0F01.

Os bytes C04468..C04622, C05763..C05840 e dados de animação C20950..C20975
foram preservados no relatório com SHA256 da ROM. Os ponteiros+70/+78
continuam tratados como dados gráficos. Ainda falta integrar preparação,
lançamento, percurso, saída e palavra0406 no step; não contar estas três
transições como novos replays completos ou declarar a arena concluída.

### Arena 2 — componente de preparação verificado

`sb2Stage2PreparationStep` em `sb2-stage2-route.ts` conserva a espera
medida e retorna separadamente o deslocamento inicial de8 e velocidade2.
Três testes comparam39 quadros autenticados (12 de espera e1 de lançamento
por percurso), serializando o estado entre quadros. São testes isolados,
não integração do step. A entrada inferior permanece somente dedução da ROM.
O componente ainda não é chamado por `moveSb2Stage2Player`; a integração
anunciada no começo desta etapa não foi concluída. Próximo trabalho: curvas,
saída e origem da palavra0406 antes de conectar o percurso completo.

Verificação atual:1417 testes shared em117 arquivos passaram; typecheck de
shared/client/server passou. Nenhum commit/push. Os testes client não foram
reexecutados nesta etapa; permanece o registro anterior da falha Naruto.

### Arena 2 — curvas, junções e saída aérea em componentes

`sb2Stage2RouteStep` implementa C05841/C05977: consulta8/9/10 no fundo,
recentra somente a parte inteira da posição ao virar, escolhe o ramo
perpendicular pelo vizinho8 e conserva a trava de junção até sair da célula10.
Três percursos verificam268 quadros (entry86; neutral-route91; opposite-route91),
com posições, velocidades, direção e trava comparadas e serialização por quadro.
A palavra0406 ainda é fornecida pela captura, não gerada pelo modelo.

`sb2Stage2ExitStep` reproduz120 quadros nos dois percursos que chegaram à
aterrissagem. A saída recentra Y para176 mais a fração, inicia subida com8
e desaceleração0,5. C05763 testa a palavra inteira+1C: quando ela zera,
ainda há fração0,5; a aceleração passa a1/16. Há um quadro parado adicional
para trocar o sentido após velocidade0. A aterrissagem ocorre ao alcançar
a célula armazenada em+CC, com recentramento inteiro e velocidade zero.
Os testes iniciam essa saída com a posição/velocidade/CC nativos medidos;
a detecção e criação da saída ainda não são testadas no step.

Relatório `SB2-ICE-ROUTE-COMPONENT-TESTS.json` preserva ROM e escopo exato.
São14 testes isolados do módulo; não contar como novos replays completos.
Ainda faltam ligação no step, origem/atualização de0406, entrada oposta e
interações de inventário/multijogador. Verificação atual:1422 testes shared
em117 arquivos passaram; typecheck dos três pacotes e diff-check passaram.
Nenhum commit/push.

### Histórico aleatório0400..041E identificado e integrado

C00CAA chama C00CDF, escreve o resultado em000400 e também no endereço
000400+(DP32&001E). Portanto0406 não é independente do PRNG existente: é
uma posição do histórico de16 palavras. Ela é atualizada em dois quadros
consecutivos a cada32 quadros; permanece entre essas atualizações. As seis
junções anteriores compartilham34 porque estão na mesma janela do histórico,
não porque0406 seja constante durante todo o percurso. O journal mostra
neutral-route:0406=12 no0,47 no28,189 no29,89 no60,34 no61,60 no92 etc.

`extract_random_history.py` reconfronta REA/MCP e hash da ROM; preserva
C00CAA..C00CDE e as16 palavras nos725 estados em
`SB2-RANDOM-HISTORY-REPLAY.json`. `advanceSb2ItemRandom` agora atualiza
`randomHistory` ao fim do passo PAL usando o contador nativo. Quatro testes
no step comparam semente e todas as16 posições em720 avanços e serializam
o estado a cada avanço. Não são replays completos da arena: os testes
exercitam o histórico e restauram seus valores iniciais da captura.

`publicView` remove o novo histórico; teste existente ampliado verifica
a remoção nas seis arenas internas sem alterar o estado do servidor.
A criação do histórico original antes da partida ainda não foi mapeada;
o preenchimento inicial vazio do modelo não deve ser chamado de estado
nativo confirmado. Próximo passo: restaurar o histórico capturado em um
replay de transporte completo e conectar preparação/percurso/saída ao
controlador; depois mapear a inicialização anterior ao primeiro frame.

Verificação atual:1426 testes shared em118 arquivos e os três typechecks
passaram. Diff-check e compilação Python passaram. Sem commit/push.

### Arena 2 — transporte conectado ao step e716 quadros comparados

`sb2-stage2-controller.ts` conecta detecção de círculo corrente, preparação,
lançamento, curvas/junções e saída aérea a `moveSb2Stage2Player`. O estado
serializável guarda preparação, direção/trava e saída/CC. O sorteio usa
`randomHistory[3]` do quadro anterior, sem injetar escolhas por quadro.
`steer` evita uma segunda atualização pelo eixo alternativo durante a espera.
Controles são suprimidos enquanto o transporte está ativo, conforme+6E=0;
`placeBomb` respeita o mesmo modo. Interações com bomba/ação ainda precisam
de novos ensaios nativos, não foram certificadas só por esses replays.

O extrator de bombas agora admite comprimentos variáveis com argumento-1,
preserva inventários E0/E1/E2, direção/modo/travas e histórico0400..041E.
Saída autenticada `SB2-ICE-TRANSPORT-VERIFIED-REPLAY.json`. Os quatro testes
no step restauram o estado1 de cada captura e comparam716 avanços: entry119,
neutral-route199, opposite-route199, lateral-route199. O índice0→1 foi
excluído: o primeiro frame após load_state usa controles latched do save,
não representados neste replay. Não contabilizar720 avanços completos.

Além de posição/velocidade, comparam ambos os jogadores, vida, direção,
inventário, fases do transporte, grade, bombas/autores, chamas, itens,
bag, semente e palavra0400, com serialização entre todos os passos. Dois
percursos atravessam aterrissagem e continuam depois dela; lateral-route
não ativa o transporte. Não são quatro caminhos aleatórios diferentes.

Verificação:1430 testes shared/118 arquivos e três typechecks passaram;
35 arquivos SB4 protegidos permanecem byte a byte; as duas alterações
comuns arena.ts/stage.ts continuam as únicas diferenças da baseline.
Todos os545 arquivos brutos do manifesto foram conferidos em tamanho e
SHA256. Visual/seletor continuam pendentes; a arena inteira não está
concluída. Sem commit/push. Relatório:SB2-ICE-TRANSPORT-TESTS.json.

### Arena 2 — novos ensaios MCP/REA, três passam e um expõe deriva incorreta

Novo worker MCP real Snes9x PID91504, sessão REA
b780653c-b5c1-4df3-83f0-36b193577248, script a85da985-0943-412b-aaed-9c218597792d.
ROM/core mantêm os hashes anteriores. Estado de entrada existente reutilizado,
sem menus, instalações ou escrita de RAM. Cada ensaio tem240 avanços: held-bomb
segura A nos25..110 (86 quadros, todos no transporte); delay-2/4/8 esperam
respectivamente2/4/8 quadros neutros antes da aproximação DOWN1..64.
Journal novo em output/sb2-research/ice-transport-interactions; evidência
ev_7fbc6438d7ca1d5509b7883a74bc650038fcecca6550e2b026d971484f68d3eb.
Todos964 reads confrontados sem truncamento;375960 células e987136 bytes
de jogadores conferidos. Sessão REA e cliente/emulador foram fechados.

Dos quatro novos testes no step, held-bomb,delay-4,delay-8 passam:717 avanços
(239 por caso, excluindo0→1 conforme limite anterior). Incluem aterrissagem
e quadros posteriores. A pressão de bomba é ignorada no original e no
modelo. O quarto caso delay-2 permanece como teste FALHANDO, sem skip/xfail.
Primeira divergência no frame6891 (índice2): original75,75/48, modelo76,5/48,25.
Os41 testes de replays anteriores continuam passando; resultado do arquivo:
44 passaram e1 falhou. Não apresentar a suíte shared atual como verde.

Causa localizada: após neutro, C0C139 desliga a aceleração horizontal
sem apagar a velocidade fracionária; C0C1E3 controla a trava vertical
separadamente. A aproximação mantém deriva X=-0,75 enquanto começa Y
(com passos iniciais48,48,48,25,48,25...). O controlador atual zera a
velocidade perpendicular imediatamente ao receber DOWN, simplificação
que não cobre esse estado. Não corrigir por deslocamento específico,
exclusão de mais quadros ou relaxamento de tolerância. Próximo trabalho:
restaurar acelerações/travas nativas e reproduzir a atualização dos dois
eixos com as consultas de colisão por pixel inteiro; manter os replays
anteriores como regressão. Bytes C0A2B7..A369 e C0C139..C279 preservados
no relatório de interações.

O caso delay-2 também observa nova palavra0406=158 na junção96. A escolha
sortearia UP, oposta a DOWN; o fallback nativo escolhe LEFT. Um novo teste
isolado passa, primeira validação dinâmica deste fallback com outro valor.
Os oito eventos não são oito caminhos geométricos diferentes.

Typechecks dos três pacotes passaram; módulo de rota15 testes passou.
A suíte shared completa não foi repetida após identificar a falha local.
Relatório:SB2-ICE-TRANSPORT-INTERACTIONS-TESTS.json. Manifesto passa a546
arquivos brutos com o novo journal. Sem commit/push; objetivo ativo.

### Arena 2 — deriva delay-2 corrigida sem excluir quadros

A investigação adicional distinguiu o estado de direção já aplicado (+5E/+6A).
No início1 de delay-2, a direção é DOWN; nos estados1 de entry/held-bomb/
delay-4/delay-8, é LEFT. O controlador passou a preservar essa direção
anterior em `iceFacing`, restaurada da captura nos replays. A deriva
horizontal existente é conservada na aproximação vertical já orientada,
até o alinhamento inteiro da coluna; não se trata de um deslocamento
específico do ensaio. Na deriva, a consulta de colisão ocorre quando X ouY
cruza um pixel inteiro e usa a coluna transversal anterior ao avanço.
Assim a parede inferior zera a velocidadeY nos quadros com cruzamentoX,
enquanto os quadros sem cruzamento conservam o avanço fracionárioY.

Comparação que orientou a correção: delay-2 estados1..3 têm X76,5→75,75→75
e Y48→48→48,25; nos16..18 X65,25→64,5→64,5 e Y48,75→48,75→49.
O caso passa agora até o240, com as mesmas tolerâncias exatas e sem retirar
novos quadros. Os quatro novos ensaios passam956 avanços; com os quatro
anteriores são1.672 avanços do transporte desde estados1 capturados.
Oito ensaios de gelo/bombas anteriores seguem passando (1.344 avanços);
portanto16 replays da arena2 cobrem3.016 avanços nos escopos documentados.
O relatório da falha foi mantido como histórico; situação corrigida em
`SB2-ICE-DRIFT-FIX-TESTS.json`. O arquivo de replays genéricos tem45 casos
passando, sem skip/xfail.

A correção abrange a deriva horizontal/entrada vertical medida; não declarar
certificadas as versões espelhadas ou outros inventários. O mapa permanece
interno. Verificação atual:1435 testes shared/118 arquivos passaram; três
typechecks e diff-check passaram. Os35 arquivos protegidos SB4 mantêm os
hashes originais. Sem commit/push.

### Arena 3 — quatro aberturas investigadas com novo MCP/REA

Reutilizada a seleção de dois humanos já salva, oito passos LEFT de menu
para arena3 e START; nenhuma instalação ou escrita de RAM. Criado estado
reutilizável em output/sb2-research/stage3-exits/arena-03.state. Tela original
inspecionada. Worker90252, sessão REA df975634-7b45-490d-8065-4e70e7fafdc9,
script d7316ce2-5aa2-4f97-89f4-9807f71782fa. Quatro ensaios240 quadros:
upper-left,lower-right,upper-right,lower-left. Estado e emulador fechados
após exportar ev_7acc48f553d88e19ccb87a8e4cd9deb06a7366d0ee039879b6c8efa0c5a0c2bd.
964 reads conferidos sem truncamento,375960 células e987136 bytes de
jogadores; as quatro grades iniciais coincidem com a captura3 já existente.

As aberturas ficam em colunas3 e11 no topo/base. C04DE1 despacha endereços
A8=0108/0808/0118/0818 para C050E0/C04F64/C04E20/C04EC2. Não confundir
essas rotinas de borda com o circuito de piso da arena2. A entrada superior
troca somente a palavra inteiraY para239; a inferior para17. Ambas fazem
OR0002 no estado principal: a física do primeiro quadro sobe mesmo na
entrada inferior. FraçãoY e X são preservadas. Observado: upper-left
24,25→238; upper-right24,25→238; lower-right233→15,75; lower-left233→15,75.
O componente `sb2Stage3TunnelEntry` reproduz esses quatro primeiros quadros
em testes isolados; não foi ligado ao step e não valida o restante.

A rotina verifica células/entidades na saída e usa7E5D04 como trava global;
escreve251 (FB) no destino atual/fundo e0400 em+02 do jogador. Observado:
upper-left ativa46/reserva(3,12)/gate1, libera52; lower-right ativa47/
reserva(11,0)/gate8, libera56; upper-right ativa148/reserva(11,12)/gate4,
libera154; lower-left ativa149/reserva(3,0)/gate2, libera158. Na continuação
há saltos adicionais de8 pixels: upper-left51 e lower-right55 (e seus
equivalentes à direita/esquerda). C05006/C051AE e C05264 contam pisos17
para deslocarY; ainda falta reproduzir essa consulta fora da grade visível.
Não substituir o conjunto por um wrap toroidal genérico ou ignorar reservas.

Relatórios:SB2-STAGE3-EXITS-COMPARISON/REPLAY/OBSERVATIONS/TESTS.json;
extrator `extract_stage3_exits.py` reconfronta REA/MCP e hash antes de emitir
os eventos e bytes C04DE1..C05286. Quatro testes isolados e typecheck shared
passaram. Último shared completo continua1435 da etapa anterior; não
contabilizar960 avanços observados como replays já implementados. Manifesto
recebe os quatro novos arquivos brutos, total550. Sem commit/push.

### Arena 3 — ID interno e quatro travessias completas no step

`sb2-03` agora usa a grade3 nativa no criador e movimento manual SB2.
`canPlayerEnterTile` reconhece as quatro células fora da borda nas colunas
3/11, necessárias para alcançar o limiar de entrada. O controlador cria
reserva251 no destino (representada internamente por Tile.Wall), conserva
frações e primeiro avanço de subida, percorre a faixa externa e aplica
o deslocamento inteiro de8 ao voltar à faixa visível, conforme os quatro
percursos capturados. Esta regra de8 é derivada das capturas; a rotina
completa de colisão que o causa ainda não foi reconstruída. Não apresentá-la
como port instrução a instrução ou como validação de outras velocidades.

Correção da hipótese anterior: C05006/C051AE são caminhos de entrada
obstruída. Com+02 bit0400 já ativo, os ramos C04E20/C04EC2/C04F64/C050E0
retornam imediatamente; portanto não explicam o deslocamento adicional
durante estas travessias livres. O encerramento da reserva foi localizado
em C0427B/C042D9: usa o proprietário em7E5D08/06 e o fundo em seu A8; ao
deixar piso17, limpa bits do grupo em5D04 e reservas nas duas bordas.
O controlador executa a liberação antes do movimento do quadro seguinte,
como observado nos quatro ensaios. Os bytes de limpeza estão no relatório.

`SB2-STAGE3-EXITS-VERIFIED-REPLAY.json` acrescenta5D04/06/08 autenticados.
Quatro replays no step passam960 avanços desde estado0 (nenhum quadro
excluído): posição/vida/inventário dos dois jogadores, grade/reservas,
bits e autores dos portões, modo0400, bolsa e PRNG/histórico, serializando
a cada passo. Bombas/chamas/itens permanecem vazios nesses ensaios; isso
não certifica suas interações com as saídas. Testes do criador confrontam
as quatro posições da arena3 e publicView cobre o sétimo ID interno.

Ainda não implementadas/certificadas: saídas ocupadas, exclusão entre
entradas simultâneas, mudanças de comando na faixa externa, outros
inventários, bombas e visual. O ID não foi posto no seletor. Próximo
trabalho deve usar esses casos nativos para completar as regras de
ocupação/entrada, em vez de presumir passagem livre em qualquer situação.

Verificação atual:1445 testes shared/119 arquivos e três typechecks
passaram;35 arquivos SB4 protegidos mantêm hashes; todos550 arquivos brutos
foram conferidos em tamanho/SHA256. Sem commit/push. Relatório atual:
SB2-STAGE3-EXITS-MAIN-STEP-TESTS.json.

### Arena 3 — ocupação, concorrência e contato alinhado conferidos

Novos ensaios nativos sem escrita de RAM: occupied-stay,occupied-leave,
cross-columns,same-column, cada um240 avanços. Preparação por controles
normais reutilizou arena-03.state e gerou aligned.state/occupied.state
para continuidade. Worker93228, sessão42f08cb7-c4c2-43f9-a9e8-290cded30102,
script0a61e17a-d4f7-480a-aaea-ff508cd96cb8, evidência
ev_1fd98fd1ad902a982cad373e5cb0ec7bfd6beb35d5b3313d24578a5f4425ddb0.
964 reads confrontados sem truncamento;375960 células e987136 bytes de
jogadores. Sessão REA e cliente/emulador fechados após exportar.

C05182 compara A8 de entidades com as duas células da saída (visível e
externa). O controlador passa a bloquear chegada ocupada/reservada e
reposicionar somente a palavra inteiraY para25 no topo ou232 na base,
sem avanço e preservando fração. Exemplo occupied-stay:24,25→25,25→24→25
→23,75→25,75; nenhum teleporte nos240 quadros. Quando P2 sai, P1 entra66
e libera72. O teste usa as posições de entidades na ordem nativa P1/P2.
Os quatro ramos da ROM testam5D04&0003, inclusive os da coluna direita.
Em cross-columns a esquerda entra46/libera52; a direita espera e entra53/
libera61. Em same-column ambos ocupam as bordas opostas e nenhum entra.
Não tratar isso como exclusão simétrica genérica entre todas as colunas.

O replay occupied-leave revelou contato após a passagem. A primeira
implementação dos portões passou os demais três casos, mas divergiu no87
quando P1 alcançou P2 parado. C069D8/C07EAE formam grupos por distância
inteiraX<13,Y<15; C06AB2 escolhe ramo vertical quando osX inteiros são
iguais. C06F46, sem oposição/parede à frente, impõe velocidade UP0,5 aos
dois. O controlador incorpora somente o ramo medido de dois vivos alinhados,
com o jogador inferior pressionando UP e superior sem direção. Atualiza
controles de contato antes do movimento; o jogador empurrado também move
sem input. Ao chegar ao alinhamento inteiro de parede/bomba, ambos param.
Empurrão começa87; ambos movem0,5 até180; no181 param em158,5/144,75.
A palavra5C8C também é comparada por quadro no novo fixture autenticado.
Não declarar implementados os demais grupos/direções ou outros estágios.

Os quatro novos casos agora passam960 avanços completos, sem exclusão de
quadros, relaxamento, skip ou xfail. Com os anteriores, arena3 tem oito
replays/1.920 avanços no step. Ambos os jogadores, inventários/vida, grades,
reservas/autores/modo, bolsa/PRNG/histórico e serialização são comparados;
bombas/chamas permanecem vazias nesses ensaios e não estão certificadas.
Relatório:SB2-STAGE3-OCCUPANCY-TESTS.json; fixture:
SB2-STAGE3-OCCUPANCY-VERIFIED-REPLAY.json.

Verificação atual:1449 testes shared/119 arquivos e três typechecks passaram;
35 arquivos SB4 protegidos inalterados. Cinco arquivos brutos novos no
manifesto, todos555 conferidos em tamanho/SHA256. Outras ordens de entrada,
três/quatro jogadores, outras direções de contato, comandos, inventários,
bombas/dano e visual continuam pendentes. Sem commit/push.

### Arena 3 — comandos durante a passagem e ordem inversa validados

Quatro novos ensaios240 quadros: upper-neutral,upper-reverse,lower-neutral,
cross-right-first. Estado existente reutilizado, sem menus/instalação/
escrita de RAM. Worker158892, sessão0acd12fe-df41-43e3-8e7c-41e0d42fcbf8,
script3201fb01-e944-41ab-969c-5ffb13cfd4ab; exportada evidência
ev_eaa39a1cda5743f39c8f87a07448d3f2567a56ad091d21550be7cdd3be526e6e.
964 leituras confrontadas sem truncamento;375960 células e987136 bytes de
jogadores. Sessão REA e cliente/emulador fechados.

O original mantém o comando vertical forçado até terminar a travessia,
mesmo com input neutro ou oposto. Na limpeza da reserva ainda há um último
quadro de movimento forçado: em upper-neutral, +6E=0800 e +52=0801 até51,
+6E=0800/+52=0000 no52, e +6E=0000 no53; Y222,5 permanece desde52.
No lower-neutral, soltar após47 não interrompe a chegada, liberada56.
O controlador passou a usar o sentido da passagem e a guardar uma direção
de liberação por um único passo PAL, serializável, independente da reserva
que já foi removida. O step não pula esse movimento quando falta input.

O ensaio de reversão ignora DOWN durante a primeira chegada, mas aceita
a inversão depois dela, com nova passagem62/liberação70 e retorno139/145.
Na ordem direita-primeiro a direita entra47 (gate8), esquerda entra53
enquanto ela ainda está ativa (gate9), direita libera56 (gate1), esquerda
libera59 (gate0). Isso confirma a assimetria5D04&0003 antes observada
na ROM e não uma exclusão mútua genérica.

Três novos testes inicialmente falharam pela ausência do movimento forçado;
agora os quatro passam960 avanços completos. A comparação de direção de
ambos os jogadores foi acrescentada aos replays da arena3, junto aos
checks existentes de posição, modo, reservas/autores, inventário, vida,
grade, bolsa/PRNG/histórico e serialização. São12 replays/2.880 avanços
no step para esta arena; os últimos casos não validam bombas/dano, outras
velocidades, comandos horizontais ou grupos maiores. Relatório:
SB2-STAGE3-CONTROLS-TESTS.json.

Verificação atual:1453 testes shared/119 arquivos e três typechecks passaram;
35 arquivos SB4 protegidos inalterados; todos556 arquivos brutos conferidos
em tamanho/SHA256. Mapa continua interno, sem publicação no seletor.
Sem commit/push.

### Arena 3 — plantio no limite e chegada, com duas explosões

Novos ensaios240 quadros: plant-near-top(A39),plant-in-tunnel(A47),
plant-release(A52),plant-after(A53); P1RIGHT1..26 eUP27..240, P2parado.
Reutilizado arena-03.state, sem menus/instalação/escrita de RAM. Worker158296,
sessão d5048e2f-10f1-4f7c-921c-6633573cb8c2, script
a7cc7315-dd92-4e3b-aa6a-c6278e8b7aa0; evidência
ev_987b9edbb7e31a9b435df5b6420c575cdba56ac604c0dd6e2b2bf3d60227034b.
964 reads confrontados sem truncamento;375960 células e987136 bytes de
jogadores. Observador também confronta as oito primeiras entradas de
bombas; os dois ensaios recusados não criaram entrada ativa observada.
Sessão e cliente/emulador fechados após exportar.

A39 planta(3,0), visível39..183; chama184..209. A47 não planta durante
a faixa externa. A52 não planta no quadro de liberação, apesar de a grade
ser limpa nesse quadro. A53 planta(3,12), visível53..197; chama198..223.
O modelo inicialmente criava bombas indevidas(3,13) no47 e(3,12) no52.
`placeBomb` agora recusa enquanto existe túnel ativo ou direção de liberação
do quadro, condição já necessária para reproduzir o controle forçado.
Os quatro casos passam960 avanços completos, incluindo autoria, grade,
chamas e término, além dos checks de jogadores, reservas e PRNG/bolsa.
Não houve alteração dos tempos da bomba para fazer estes ensaios passar.

Relatório:SB2-STAGE3-BOMBS-TESTS.json; fixture
SB2-STAGE3-BOMBS-REPLAY.json. Total da arena3:16 replays/3.840 avanços
no step; apenas dois destes novos casos contêm explosão. Isso não valida
dano, retry de A mantido, múltiplas bombas, saída bloqueada por bomba,
chute/luva ou plantio pela borda oposta. Os dois jogadores permaneceram
fora do alcance dessas explosões.

Verificação atual:1457 testes shared/119 arquivos e três typechecks passaram;
35 arquivos SB4 protegidos inalterados. Novo journal adicionado; todos557
arquivos brutos conferidos em tamanho/SHA256. Sem commit/push.

### Arena 5 — placa de alcance máximo identificada e integrada

Novo estado de dois humanos criado pela seleção já salva (seis LEFT),
sem instalação. Grade e imagem original inspecionadas. Uma bomba normal
removeu o bloco(4,1), com retirada por comandos, para chegar à placa(7,1).
Estados reutilizáveis arena-05.state/entry.state e duas imagens em
output/sb2-research/stage5-floor. Quatro ensaios240 quadros: walk,press-Y,
plant-pad,plant-before. Worker159536, sessão5d532f3b-92c8-4cfd-adf9-e764b2f1f1ba,
script1ceaa910-3150-4948-8b08-f5e02b25b866; evidência
ev_a6dbea785ba08cfd5d2dc7543d0b256317cc3b4340ee214d8ca4bcd24267261b.
964 leituras conferidas sem truncamento;375960 células e987136 bytes de
jogadores. Sessão e cliente/emulador fechados depois de exportar.

Andar e apertarY não alteraram modo/posição além do movimento normal
neste inventário. O handler do piso20 em C5EC0F aponta a C052E4 (RTL),
portanto não foi inventado um efeito de movimento. A bomba plantada na
placa expôs a regra: inventário de fogo permanece2, mas a bomba recebe
byte+07=9 (alcance10), contra1 (alcance2) fora dela. O modelo inicialmente
falhou no fogo à esquerda: só chegava(5,1), enquanto o original chegava(1,1).
C03583, chamado em C03541, verifica o modo da arena e varre a lista7E2FF0;
na placa grava9 em+07. C03761 inicializa essa lista varrendo o fundo20.
O helper `sb2Stage5BombRange` reproduz o plantio usando as posições do
fundo capturado, preserva o inventário e usa o sistema de explosão existente.
O extrator agora preserva alcance das bombas, comparado por quadro.

`sb2-05` é o oitavo ID interno; o piso20 é transitável. Quatro replays
passam960 avanços completos com ambos os jogadores, inventários, grade,
bombas/autores/alcances, chamas, itens revelados e PRNG/bolsa/histórico,
serializando a cada quadro. Dois deles contêm explosão: plant-pad visível
33..176/fogo177..202; plant-before1..144/fogo145..170. O caso press-Y só
comprova ausência de efeito nativo nessas medidas; a traduçãoY→ação do
Bombtop não foi validada por esse caso e não deve ser anunciada como pronta.

A placa queima dois blocos e revela dois itens no mesmo intervalo. O
extrator lê itens em ordem espacial da grade; isso não representa uma
ordem nativa de lista. O teste passou a ordenar ambas as listas por
coordenada antes de comparar tipos/posições/multiplicidade, sem alterar a
implementação de sorteio ou distribuição. Os tipos nas duas células e a
bolsa já coincidiam; a divergência era exclusivamente a representação
row-major do fixture. Nenhum check de conteúdo foi desabilitado.

Testes do criador e publicView foram estendidos a sb2-05. Verificação:
1463 testes shared/119 arquivos e três typechecks passaram;35 arquivos SB4
protegidos inalterados. Sete arquivos brutos novos; todos564 conferidos em
tamanho/SHA256. Outras placas, velocidades, dano, chute/luva, grupos e
visual continuam pendentes. Não publicar no seletor nem afirmar arena
inteira concluída. Sem commit/push. Relatório:SB2-STAGE5-FLOOR-TESTS.json.


### Arena 9 — fechamento das capturas e sondagem inicial da luva

Conferidas 966 leituras REA/MCP no bundle SB2-REA-STAGE9-ARROWS.json, script fe650f8f-5e79-4ba2-89af-90eab0f0636a, sem truncamento. Quatro percursos de 240 passos foram extraídos para SB2-STAGE9-ARROWS-REPLAY.json; ainda não são regressões do step do Bombtop.

No mesmo Snes9x PAL, PID160472, o estado glove-collected.state contém FF=1 após coleta natural, sem escrita de RAM. O arquivo anterior glove.state contém FF=0 e não comprova posse da luva. Quatro sondagens de 96 passos: A no primeiro frame, seguido de A mantido ou pulso Y/B/X no terceiro frame. Os campos observados +52 e slots8400..8700 não mostraram transporte; isso não prova ausência de habilidade nem determina seu comando correto. Há bomba estática a partir do frame1. As 388 leituras conferiram integralmente no bundle SB2-REA-STAGE9-GLOVE-BUTTONS.json, script84611e5d-ee98-47e7-b213-4affefeb0ced. Comparação em SB2-STAGE9-GLOVE-BUTTONS-COMPARISON.json.

Próximo passo: reconstruir a condição nativa de levantamento usando FF e a rotina de contato com bomba, antes de inferir interação com setas. Arena9 continua sem implementação interna e fora do seletor. Observador REA encerrado; cliente stage9Client permanece com o emulador carregado. Sem alteração de gameplay, commit ou push.


### Arena9 — resposta positiva no contato frontal

844 novas leituras REA/MCP comparadas sem truncamento: SB2-STAGE9-FRONT-CONTACT-COMPARISON.json, evidência ev_d6e496fa1278c06898edc30eab7bfa99bcb40c73a64780e5d4f4eb213cdd3572, script5cbf29f9-78a7-47c9-bda9-13b11cdc7c3c. Dois casos front-Y/front-A de180 passos e arrow-left/arrow-held de240 passos.

Nos dois primeiros casos, plantio A1, LEFT2..14, RIGHT15: slot8400 ativa no15 em(96,48), estado842A; no16 estado942A em(98,48), depois +2 pixels/frame até124 no29; volta à estrutura estática no30. O pulso Y ou A só ocorre17, portanto não causa a ativação15. O atributo FF=1 anteriormente chamado luva permite esta resposta ao contato direcional; a atribuição nominal e a hipótese de levantamento não estão confirmadas e precisam ser revistas. Não portar uma habilidade de levantamento com base nesse nome.

Na seta(1,1), plantio53 em nativo(32,48), jogador afasta RIGHT54..66 e volta LEFT67 isolado ou mantido até90. Bomba não move; jogador ficaX48. A saída à esquerda é parede: ausência de movimento não determina se há redirecionamento pela seta. Próximo ensaio deve usar seta interior acessível e reconstruir testes C0B1F8/C0B155, chamados após FF em C0AFAF. Bytes locais examinados manualmente, sem alegar disassembly REA de65816. Observador fechado; emulador e cliente stage9Client preservados. Sem gameplay alterado, commit ou push.


### Arena9 — redirecionamento positivo pela seta62

Corredor aberto por duas bombas normais, sem escrita de RAM; estado reutilizável stage9-interior/arrow-entry.state: P1 nativo(64.75,85.5), velocidadeE0=2, FF=1. A velocidade mudou por coleta durante a preparação, portanto não reutilizar tempos de deslocamento do estado anterior E0=1. 484 leituras confrontadas integralmente REA/MCP, sem truncamento, em SB2-STAGE9-INTERIOR-COMPARISON.json; extração dos quatro slots móveis por frame em SB2-STAGE9-INTERIOR-MOTION.json. Dois percursos completos de240 passos, mais duas leituras de preparação.

Caso arrow-down: plantio na seta(3,3), afastamento UP2..14, retorno DOWN15..40. Ativa slot8400 no15 em(64,80), estado8415; desloca DOWN2pixels/frame16..21 e volta estática22. A seta não alterou o lançamento feito de sua própria célula neste caso.

Caso enter-down: UP1..14, A15 na célula(3,2), UP16..26, DOWN27..60. Ativa no27 em(64,64); DOWN2pixels/frame28..32 atéY74. No33 salta/recentra para(64,80) e troca estado9415 para9414; no34..39 desloca RIGHT2pixels/frame atéX76, para no40. Evidência positiva: a seta62 redireciona a bomba que chega de cima para a direita, com ajuste de6pixels na transição observada. Não generalizar ainda a todos os sentidos, velocidades ou demais códigos60/61/63.

Próximo passo: localizar despacho nativo dos códigos60..63 no controlador móvel e capturar entrada de outros sentidos; depois integrar ao movimento existente de bombas e confrontar o step completo. Nenhuma arena nova liberada. Observador encerrado, emulador carregado no cliente stage9Client. Sem commit ou push.


### Arena9 — segunda seta confirmada e despacho identificado

482 leituras REA/MCP comparadas sem truncamento no bundle SB2-REA-STAGE9-SIDE.json, scriptf4ff3bf0-51cd-4451-95c1-162eabfa3217, evidência ev_ed6942a59c09db1b459b9a8f7b4197bd8bde38bb356686a1337f12596b1c8b21. Dois casos de240 passos. enter-right usa arrow-entry.state, UP1..4 LEFT5..15 A16 LEFT17..27 RIGHT28..61. Slot8400 ativa28 em(48,80), anda RIGHT2pixels29..33;34 ajustaX58 para64 na seta62, continuaRIGHT35..40 e para41. Logo o recentramento também ocorre sem mudar sentido.

enter61-left usa glove-collected.state, LEFT1..39 A40 RIGHT41..53 LEFT54..85. Ativa54 em(48,48), andaLEFT2pixels55..59;60 ajustaX38 para32 e muda estado942B para9429, depois DOWN2pixels61..74 atéY76; para75. Seta61 na entrada(1,1) redireciona para baixo. Isso resolve a captura anterior sem movimento: tentar iniciar na própria seta contra a parede não equivalia a entrar nela.

Busca estática dos compares C9 3C/3D/3E/3F 00 encontrou os handlersC10FE4/C1100B/C11032/C11059. Decodificação manual preservada com bytes e hash em SB2-STAGE9-ARROW-ROM-HANDLERS.json:60up,61down,62right,63left; velocidade2 e deltas de célula -128/+128/+2/-2. Somente61/62 têm validação dinâmica até aqui. C10F81 usa campo+C0 como trava de entrada, chamaC19BFB eC1C6CE antes dos quatro handlers; reconstruir essas condições e atualização da posição antes de portar. Nenhuma mudança de gameplay, commit ou push. Observadores encerrados; stage9Client continua carregado.


### Arena9 — primeiro componente portado, ainda sem integração

Adicionados sb2-stage9-arrows.ts e três testes de entrada/trava com a captura enter-down. ReconstruçãoC19BFB/C1C6CE: limite estrito de6pixels, obtido deC5D908 (não8); o chamador deve fornecer a posição após o avanço normal. No32, posição candidata74 fica na distância6 e não ativa; no33 candidata76 fica a4 e recentra80. A afirmação intermediária em comentário da conversa sobre limite8 foi corrigida após leitura da tabelaROM; não usar como evidência. Componente ainda não chamado pelo loop, portanto arena9 não é considerada implementada. Verificar bits+C0, reinício por chute e demais sentidos antes de integrar. Typecheck shared passou e três testes passaram antes da correção do limite; a execução final correspondente é registrada no resultado da ferramenta. Sem commit/push.


### Arena9 — confronto contínuo do componente de entrada

O teste sb2-stage9-arrows.test.ts agora usa os quatro percursos INTERIOR/SIDE, comparando 50 transições consecutivas com bomba móvel presente nos dois extremos. Calcula avanço normal2 a partir do delta+46 e confronta posição e trava+C0; cobre seta62 chegando de cima e da esquerda, início sobre62 sem redirecionamento, e61 chegando da direita. Criação/remoção são explicitamente excluídas desta verificação do componente, não do objetivo final. Os demais frames estáticos não são simulações de gameplay certificadas por este teste. Preservada a fração ao gravar somente parte inteira em C1C6CE. Os sete testes e typecheck shared passaram.

SB2-STAGE9-SIDE-MOTION.json deriva do journal já confrontado por SB2-STAGE9-SIDE-COMPARISON.json. O componente ainda não é chamado pelo loop: próxima integração precisa controlar início/colisão/parada, fusível, reserva e ocupação por quadro, além dos códigos60/63. Não aumentar a contagem de arenas implementadas. Sem commit/push.


### Correção de identidade dos itens de chute e luva

A investigação da arena9 encontrou uma troca na interpretação semântica dos atributos nativos: glyph1624/FF é chute; glyph1626/FE é luva. C0AFAF verificaFF antes do contato frontal que ativou a bomba sem novo botão na captura FRONT-CONTACT. C030D6 verificaFE na ação de levantamento, testa célula3 e chamaC02F6E. Bytes e limitações em SB2-ITEM-ABILITY-CORRECTION.json. Corrigido GLYPH_KINDS em sb2-items.ts e mapas de glifos dos três testes de replays. No teste de220 leituras de coleta, canKick compara agora inventory31/FF, canGlove compara inventory30/FE. Não alterada a evidência bruta: nomes históricos glove-collected.state etc referem-se na realidade a estado com chute e permanecem preservados. Afirmações anteriores glyph1624=luva e1626=chute estão revogadas.

99 testes focados passaram após a correção, incluindo replays de itens, esteiras, portais e setas. Os três typechecks passaram. Isso corrige a habilidade concedida, mas não certifica a física genérica de chute/luva como fiel ao SB2. Ainda falta integrar o controlador nativo da arena9. Sem commit/push.

Verificação final desta correção: suite shared completa passou, 1470 testes em120 arquivos (27,83s), incluindo regressões SB4. Typechecks shared/server/client passaram. Não houve teste visual nesta alteração de mapeamento.


### Arena9 — replays completos com inventário e ciclo móvel/estático

extract_warp_bombs.py passou a preservar FE/FF como glove/kick no inventário, quatro slots móveis com estrutura bruta completa e oito registros estáticos ativos. Extraídos novamente a partir dos journals previamente confrontados com REA: SB2-STAGE9-INTERIOR-FULL-REPLAY.json e SB2-STAGE9-SIDE-FULL-REPLAY.json. Quatro percursos de240 passos, 960 avanços e966 leituras incluindo preparação. Ainda não são replays aprovados no step do Bombtop. Evidência de ciclo em SB2-STAGE9-MOBILE-LIFECYCLE.json.

Transições móveis: arrow-down15..21/parada22/fogo144; enter-down27..39/parada40/fogo158; enter-right28..40/parada41/fogo158; enter61-left54..74/parada75/fogo182. Registro estático passa8000->9000 enquanto a entidade móvel está ativa e volta8000 ao parar; contador em+04 segue diminuindo, portanto não pausar/reiniciar fusível no chute. Preservados registros brutos sem impor ainda fórmula de conversão.

Inventários naturais diferem: arrow-down e enter-down têm capacidade2, enter-right capacidade3, enter61-left capacidade1. Todos têm FF1/FE0; velocidadeE0=2 nos interiores e1 no último. Corrige qualquer inferência de capacidade1 constante dos resumos anteriores. O futuro teste do step deve restaurar e comparar cada inventário observado, não neutralizar coletas. Próximo passo: usar estes replays na integração do controlador móvel e investigar início/colisão no contato direcional. Sem commit/push.


### Arena9 — integração interna dos percursos estáticos

Adicionado ID interno sb2-09, bolsa/RNG e layout9 capturados; códigos60..63 transitáveis. Nenhum ID SB2 está liberado no seletor. Os quatro casos de SB2-STAGE9-ARROWS-REPLAY.json agora atravessam o step completo:960 avanços desde estado0, posições e vida dos dois jogadores, inventário, grades, bombas/autor/alcance, chamas, itens, bolsa, RNG e histórico. Primeira divergência no kick-arrow28: bloquear contra bomba com correção de fração moviaX64.5 para64.25; o original mantém64.5. Reutilizado o bloqueio corporal já validado na arena6, sem trocar expectativa nem remover frames. Os69 casos desse arquivo passam.

Suite shared completa passou1474 testes/120 arquivos antes da extensão de dois testes parametrizados. Depois,43 testes dos arquivos sb2-step/public-view passaram com a nova arena, incluindo quatro spawns e ocultação de estado privado. Três typechecks passaram. Mecânica de chute/setas móveis ainda não ligada ao loop; não confundir os quatro replays básicos sem item de chute com os quatro replays móveis FULL ainda pendentes. Contagem atual:9 IDs internos parciais,0 SB2 selecionáveis. Próximo passo: integrar início/colisão/parada e entidade móvel, confrontando FULL-REPLAY sem omitir seus inventários/coletas. Sem commit/push.


### Arena9 — quatro regressões móveis ativas no step

Os quatro FULL-REPLAY foram adicionados ao sb2-warp-bombs-step.test.ts, sem corte do estado0 nem alteração de expectativa. Inicialização restaura FE/FF e cada frame compara habilidades, além dos inventários existentes. Bombas móveis confrontadas por posição contínua, separadas das bombas estáticas; não basta verificar a grade vazia durante o chute.

Primeiro enter-right divergia no frame7339: jogadorY81 em vez80. O controlador corporal reutilizado admite agora alinhamento inteiro opcional, ativado apenas em sb2-09. Corrigiu o percurso até o chute; arena6 mantém o padrão anterior. Após ajuste, todos os quatro novos casos chegam ao primeiro slot móvel nativo e falham: arrow-down7349,enter-down7361,enter-right7362,enter61-left6786. Falta criar sb2Motion no contato de chute; tryKick genérico usa slide/offset, não a entidade nativa. Próximo passo é início de chute nativo e primeiro avanço no frame seguinte, seguido por colisão/parada e controlador das setas.

Resultado atual do arquivo:69 passaram,4 falharam. Os quatro testes permanecem ativos. O último shared completo verde1474 é histórico e não descreve o estado atual. Typecheck shared passou após a mudança. Nenhum teste foi desabilitado nem expectativa nativa substituída. Integração9 continua parcial, fora do seletor. Sem commit/push.


### Arena9 — chute/setas ligados ao step, três replays móveis completos

Criado sb2-stage9-controller.ts e ligado a tryKick/updateBombs somente em sb2-09. Contato FF cria sb2Motion no centro com startedAt e trava8000; movimento começa no frame seguinte, velocidade2; seta usa componente já confrontado e mantém trava. Fusível existente continua. Corpo móvel consultado na posição contínua e alcance15 (estático16), preservando regra anterior da arena6. Esmagamento de item na célula ocupada reproduz C08A30/C0DDF7.

Parada: C0895F lê C5D904=4 para C19BFB estrito, antes de consultar célula adiante em C08AC6. Quando posição proposta está a menos4 de ambos os centros e há bloco/pilar adiante, devolve à célula estática e conserva fusível. Reproduz arrow-down22,enter-down40,enter-right41,enter61-left75; não certifica outras colisões.

Morte: capturas mantêm atributos e não apresentam espalhamento genérico no intervalo. sb2-09 evita dropItems genérico, que reiniciava capacidade/velocidade/chute e sorteava posições divergentes. Outras arenas não alteradas por essa condição. Três replays completos agora passam: arrow-down,enter-right,enter61-left (720 avanços móveis com criação/parada/fogo, jogadores, inventários, itens, bolsa e RNG desde0). Arquivo total72 passaram,1 falhou.

Único desvio ativo: enter-down159, frame7493, célula(2,3) com glyph1600 Bomb acende e item desaparece um frame antes dos braços principais160. No158 ainda sem fogo visível; célula de item permanece acesa mais tempo que braços, inclusive200;240 apagada. Não é divergência de curva/parada. Investigar efeito nativo de queima de item, sem modificar relógio geral ou remover expectativa. Teste permanece ativo. Typecheck shared passou. Sem commit/push; arena9 parcial e fora do seletor.

Correção do resultado final de typecheck: a última execução FALHOU com TS2305 em test/glove-players.test.ts:3, import ESCAPE_PRESSES não exportado por src/player-carry. Esses arquivos não foram alterados neste avanço; houve mudança do workspace desde os typechecks anteriores. A menção acima a typecheck aprovado refere-se à execução anterior e não ao estado final atual. Não modificar trabalho paralelo para ocultar a falha.


### Arena9 — oito replays completos verdes

Corrigida a queima de item exposto no enter-down: efeito separado da chama normal. C0DCDA escreve41 para tipo4; ponteiroC5F3F5 leva aC5F405 com sete quadros. Intervalo observado de fogo do item159..200 (42frames); braços160..185 (26frames). Artefato SB2-STAGE9-ITEM-BURN-ROM.json distingue decodificação manual, grade conferida REA/MCP e inspeção adicional MCP-only do registro7F0010, que não estava coberto pelo observador REA. A implementação restrita à arena9 pré-acende itens na etapa fuse1, mantém chama marcada sb2ItemBurn42 e bloqueia propagação adicional pela célula em queima. Demais tipos/contatos ainda precisam de ensaios.

Os quatro FULL-REPLAY agora passam desde0 até240, sem cortes ou expectativas alteradas. Somados aos quatro básicos, arena9 tem1920 avanços completos confrontados. Suite shared final:1482 testes/120 arquivos, sem falhas. Três typechecks passaram; o erro transitório ESCAPE_PRESSES não apareceu na última execução, sem alteração nossa nesses arquivos. Manifesto580 arquivos conferidos por tamanho/SHA256, zero divergências. Dos37 arquivos do baselineSB4, somente arena.ts/stage.ts comuns têm hashes diferentes;35 protegidos intactos e regressõesSB4 verdes.

Ainda pendem: validação dinâmica das setas60/63, outros sentidos de entrada, bloqueio por jogadores/bombas, reservas/plantio durante chute, parada por comando, cadeias, outros itens/inventários, quatro jogadores e arte. Não liberar seletor nem declarar arena9 completa. Próximo passo: capturar60/63 e colisões adicionais no emulador vivo/estado salvo antes de estender regras. Sem commit/push.


### Arena9 — seta60 e contato de retorno com jogador

No mesmo Snes9x carregado PID160472, corredor até(5,5) aberto por três bombas e movimentos naturais, sem escrita de RAM. Estado reutilizável stage9-up-arrow/entry.state em nativo(96.25,96), velocidadeE0=2 e FF1. 485 leituras REA/MCP confrontadas sem truncamento, evidência ev_9bf63befa1c13399c1e9fde7d7f0e2be345b393802750e62d8fb61aa4051e89b, scripta007b552-8a90-4b91-870b-7c0cb8a08483. Inclui três leituras de preparação e dois casos completos de240 passos.

A1,UP2..12,DOWN13 inicia bomba em(96,96). AvançaDOWN14..18 atéY106;19 recentraY112 na seta60 e inverte paraUP, estado9415->9417;20..22 sobe110/108/106. reverse-stay mantém jogador no corredor e bomba sai do slot no23; reverse-escape usaLEFT14..24, bomba continuaUP e só para50 na borda superior. Isso confirma seta60 e distingue bloqueio por jogador de bloqueio do mapa.

Ambos FULL-REPLAY adicionados sem cortes ao step. reverse-escape passou os240 avanços completos sem mudança de implementação (inclusive ida, reversão, retorno, parada, fogo e inventários). reverse-stay falha23, frame8193, porque o controlador ainda avançaY104 em vez de devolver à tabela estática. Resultado atual75 casos:74 passaram,1 falhou. Próximo passo: reconstruir C08537/C1050E e alcance do contato móvel com jogador, depois confrontar todo reverse-stay; ainda pendente seta63. Observador encerrado e cliente up9Call/stage9Client preservados. Novos artefatos brutos adicionados ao manifesto; não alegar nova verificação de todos os arquivos nesta rodada. Sem commit/push.


### Arena9 — retorno bloqueado por jogador aprovado

C08537 calcula célula ocupada+delta da bomba e compara ao+A8 do jogador antes do teste de centro para piso. No reverse-stay23, posição candidataY104 já pertence à linha4; célula adiante5,3 contém jogadorY79.5. Devolve bomba à célula5,4 (Y96), sem usar raio ajustado ao caso. Artefato manual com bytes/hash/limitações SB2-STAGE9-PLAYER-BLOCK-ROM.json. Controlador aplica regra a jogadores vivos não elevados; modos especiais nativos continuam pendentes.

reverse-stay passou240 avanços completos. Os seis replays móveis e quatro básicos totalizam2400 avanços da arena9 desde estado0. Teste compara agora também entry_latch+C0 de cada bomba móvel em todo frame, não apenas posição. Validação final focada:104 testes/3 arquivos (75 replays nativos,16 mecânicasSB4 e13 ciclo de mapasSB4) passaram. Três typechecks passaram. Último shared completo1482 continua histórico; não foi repetido por esta alteração restrita à arena9. Sem commit/push.

Próximo passo: liberar acesso à seta63 no jogo original, capturar sua entrada; depois expandir colisões/reservas/stop e estados de jogador. Nenhuma arena liberada no seletor; nove IDs internos ainda parciais.


### Arena9 — seta63 e todas as quatro direções demonstradas

Retomada do mesmo emuladorPID160472. Cinco escavações naturais no corredor superior, bombas em nativoX127.75/144.25/160.75/175.75/192.25,Y48, velocidade1.5; retirada para corredor5,2 entre explosões. Nenhuma escrita de RAM. Salvo stage9-left-arrow/entry.state em(208.75,48). Dois ensaios de240 passos: A1,LEFT2..12,RIGHT13; left-stay neutro depois, left-escape DOWN14..24. Slot móvel nasce13 em(208,48), RIGHT2/frame14..18;19 ajustaX218->224 e estado942A->942B, invertendo paraLEFT. left-stay para24 no retorno; left-escape segue corredor.

494 leituras REA/MCP comparadas integralmente, sem truncamento: SB2-STAGE9-LEFT-ARROW-COMPARISON.json, evidência ev_478f686ccff93f3ee75e1de019585594f879d4f6f860eb69da29ad7e8b359396, script309ac00f-b0b7-4e9a-be71-c034e6598d50. FULL-REPLAY com ambos os casos deriva do journal confrontado. Primeira falha foi do teste: mapa inicial só restaurava Bomb/Fire/Speed, convertendo item1624 já exposto em undefined; restaurados todos os glifos já implementados, sem mudar expectativa ou jogo. Os dois novos replays completos passaram sem alterar controlador.

Arquivo de regressão agora77 testes verdes; arena9 tem12 replays completos e2880 avanços. Cada código60..63 foi demonstrado dinamicamente e no step em pelo menos uma entrada; isso não certifica todas as entradas, inventários ou interações. Estado/observador REA encerrado, clienteleft9Call/stage9Client e estado salvo preservados. Adicionados três artefatos brutos novos ao manifesto, sem alegar nova verificação de todo manifesto. Pendências: outras entradas, stop, reservas/plantio, colisões com bombas e jogadores em movimento, cadeias, todos os inventários, quatro jogadores e arte. Sem commit/push.


### Arena9 — comando X identificado para parada; transição do fusível pendente

Seis novos casos240 passos no mesmo estado stage9-left-arrow/entry.state. A1 LEFT2..12 RIGHT13 DOWN14..24, pulso único25 de L/R/B/Y/A/X. L/R/B/Y/A não interrompem bomba; X remove slot móvel no próprio25 e devolve à célula12,1. Não generalizar negativos para todos os estados. Dois bundles separados para não exceder quota: STOP964 leituras e STOP-ACTIONS482, todos confrontados REA/MCP sem truncamento. Evidências ev_4b7aad1d11c6b75b5fe12e680bb46f639c6ea3713f24e94afddc559f59480c89/scriptadc62f52-3f40-4094-b079-191d03ae7623; ev_3a4dcceefb201e290dfc33973c763d9d25d5caf98650a90f604878591a3c2a5d/script6b8c426e-1030-42bc-815d-97785c05e6cd. Observadores encerrados; emulador carregado.

STOP-ACTIONS-FULL-REPLAY com A/X entrou no step. X mapeado a stopKick; stopKickedBombs para9 devolve a célula occupied, limpa sb2Motion/slide/offset sem substituir contador por fusível novo. A25 também planta segunda bomba, e esse replay passa completo. Quatro negativosL/R/B/Y ficam como evidência nativa; não adicionados ao step porque o adaptador atual não encaminha esses botões.

Resultado atual79 casos:78 passaram,1 falhou. X passa posição, inventário, grade e parada, mas difere em146 (frame9864): original ainda tem bomba estática; chama só148. A original/base explode146. Registro+04 mantém0E3D no24 e25 ao parar porX; só26 passa0E3C. Em143 está0E02,1440E01,146C000 e148fogo. Portanto a afirmação preliminar de fusível preservado sem impacto de tempo não está certificada: há transição da fase do contador. Não adicionar atraso2 cegamente. Próximo passo: capturar X em26 e outros alinhamentos, reconstruir ordem de atualização do registro ao comando. Typecheck shared passou. Sem commit/push.


### Arena9 — fase do contador ao parar por X confrontada

Quatro novos casos phase26/27/32/33 com240 passos e964 leituras REA/MCP, sem truncamento: evidência ev_a0565810765ee23a6c8c6ab1c444ecfe5172fb65390f2a2a34bae1bae5dbd06c, script41df8fc2-f85a-498a-8ab5-a8d57dd241d1. Mesma preparação de chute, pulsoX no índice indicado. Fase DP32 observada4194/4195/4200/4201 nos comandos; entradaC000 surge144/146/144/146 respectivamente. Isso confirma dois pares de parada par/ímpar em posições distintas.

Portado mapeamento condicional do fusível de mundo: ao devolver sb2Motion por comandoX em fase ímpar, +2frames restantes; em fase par sem deslocamento. Não reinicializa fusível e não aplica essa regra a parada por obstáculo/jogador. SB2-STAGE9-STOP-PHASE-ROM.json preserva bytes deC08BDA e distingue claramente modelo observado de transferência de fase de uma reprodução instrução a instrução do escalonador (ainda não realizada). Não generalizar confirmação a outra fase de nascimento nem paradas repetidas.

Os quatro novos casos mais action-X25 agora passam240 avanços completos. action-A também continua passando. Total arena9:18 replays/4320 avanços,83 casos no arquivo geral verdes. Validação final104 testes/3 arquivos, incluindo5 stopKick e16 mecânicasSB4; três typechecks passaram. Último full shared1482 permanece histórico. Novo journal adicionado ao manifesto, total589 entradas; sem nova auditoria completa nesta rodada. Próximo ensaio: variar fase de plantio e pararX novamente; depois reservas/colisões/4jogadores/arte. Sem commit/push.


### Arena9 — outra fase de plantio e repetição de X aprovadas

Quatro capturas240 passos, todas iniciadas no mesmo entry.state, agora neutro1/A2/LEFT3..13/RIGHT14/DOWN15..25. birth-even-control semX; birth-even-stop26 X26; birth-even-stop27 X27; birth-even-repeat X26 eX28, com soltura27. Nascimento da entidade móvel14, contra13 nos ensaios anteriores. EntradaC000 em144/144/146/144 respectivamente. A fase do comando, e não a fase de plantio, determina o deslocamento observado nos dois pares de nascimento; segundoX sobre bomba já estática não modifica novamente o contador. Isso não certifica chute novamente após uma parada nem X mantido.

964 leituras REA/MCP confrontadas sem truncamento: SB2-STAGE9-STOP-BIRTH-COMPARISON.json, evidência ev_58354ddc1647eeccfeeb20c6fc3c7db0da5961b228ad5b144e462dcce5d00771, script2d5c328d-d7f8-4e22-9c9e-d8db29e628bb. Bundle e journal preservados; observador encerrado, emulador carregado. FULL-REPLAY extraído e quatro casos adicionados à regressão sem mudar implementação nem expectativa. Os87 casos passaram. Arena9 total22 replays completos/5280 avanços. Manifesto recebe novo journal,590 entradas; não refeita auditoria completa nesta rodada.

Pendências prioritárias: chute após parada, reserva e plantio junto a bomba móvel, encontros entre bombas, quatro jogadores e visual; arenas10..12 ainda não integradas. Objetivo completo continua aberto. Nenhum commit/push.


### Arena9 — novo chute após X e término do fusível em movimento

Quatro capturas240 passos,964 leituras REA/MCP sem truncamento, bundle SB2-REA-STAGE9-REKICK.json, evidência ev_0269b0467d19956fb5a181e6175ca9b14c6f69ea92602d15d56b3663fbcbafb5, script945e1170-2e3d-4f6e-ad10-93fdece8c81b. A1 LEFT2..12 RIGHT13 DOWN14..24 X25 UP26..36 RIGHT37 gera segundo chute. rekick-stay neutro depois; demaisDOWN38..48; rekick-stop49 X49,rekick-stop50 X50. Entidade móvel13->parada25->nova entidade37. stay para por jogador48; escape mantém movimento até145; stop49/50 param no comando. EntradaC000146/146/148/146, confirmando a fase também na segunda parada depois de novo chute.

Três casos passaram sem alteração; rekick-escape revelou que a entidade móvel deve devolver à tabela estática antes da ignição: no145 a bomba volta à célula1,2;146C000; fogo148. Controlador9 passa a devolver quando fuse<=3, conservando contador e sem transferência adicional própria deX. Usa occupied e limpa slide/offset/sb2Motion. Não significa que todas as posições e fases de expiração móvel foram ensaiadas.

Quatro casos completos passaram após integração. Resultado final112 testes/3 arquivos:91 replays nativos,5 kick-stop e16 mecânicasSB4. Três typechecks passaram. Arena9 agora26 replays/6240 avanços desde0, sem cortes ou expectativas substituídas. Manifesto recebe journal,591 entradas; auditoria completa anterior permanece histórica. Observador encerrado; emulador/stage9Client ainda carregados. Pendências: reservas/plantio, encontros entre bombas, simultaneidade/4jogadores, todos os inventários, animação/arte. Sem commit/push.


### Arena9 — plantio no retorno e reserva do jogador

Quatro casos return-plant29/30/31/32,240 passos cada,964 leituras REA/MCP sem truncamento: evidência ev_f177b24ad4c4a0b8655474c7e3a94d855cfa325ac88836600d9ee495aee19ede, script36cb2d65-88bc-4826-b229-1c1d66067fa7. A1 LEFT2..12 RIGHT13 DOWN14..24 UP25..36, A adicional no índice indicado. Não há X25 nesta captura. Primeiro desvio comum26: bomba para antes do jogador entrar na linha1. Palavra2720 passa792 no25 (reserva DOWN anterior) para536 no26 (UP), embora jogador ainda esteja na célula664,linha2. C08537/C1050E também consulta reserva; implementada preparação antes do movimento com direção anteriormente armazenada.

Plantio30 confirmou ordem após movimento na arena9: Y57 no29 está linha2, Y55 no30 já linha1; segunda bomba nasce11,1, não11,2. PlantAfterMovement agora inclui9. Depois dessas correções todos95 casos passaram até240 com as verificações anteriores.

Fortalecido extrator para preservar2720/2722; arquivo novo SB2-STAGE9-PLANT-RETURN-VERIFIED-REPLAY.json mantém FULL anterior. Ao comparar reserva em TODO frame no step, quatro novos casos falham no primeiro frame9719: esperado[540,0], obtido[0,0]. O estado salvo conserva reserva RIGHT inicial540 apesar de A1 sem direção; ainda não modelada a continuidade dessa reserva após load_state. Não removerframe1 nem aceitar uma reserva inventada para passar. Próximo passo: examinar controles/reserva do estado inicial e a rotina que limpa2720 em inatividade; restaurar/modelar estado inicial adequadamente. Resultados finais atuais:91 casos aprovados/4 falhos no arquivo geral; com SB4/publicView120 aprovados/4 falhos; três typechecks passaram. Quatro trajetórias completas sem a nova asserção não equivalem à aprovação do teste atual. Observador encerrado, emulador vivo, novo journal no manifesto592 entradas. Sem commit/push.


### Arena9 — reserva inicial resolvida pela velocidade armazenada

C0A8D3 não usa simplesmente a direção visual: lê magnitudes+14/+16 e+1C/+1E, obtém sinais dos bits0/1 do estado e combina bits de direção; somente se ambas velocidades sãozero consulta+6E&0F00. C10592 usa esse resultado para2720 antes do movimento. Isso explica frame0vx1.5 e reserva540, frame1A sem direção mantém reserva540 a partir da velocidade anterior e depois zera velocidade; frame2LEFT passa imediatamente para reserva536 por fallback do comando. Na trocaDOWN->UP25, velocidade anteriorDOWN ainda reserva792;26 usaUP e reserva536. Artefato manual SB2-STAGE9-PLAYER-RESERVATION-ROM.json preserva bytes/hash e limitações. Não foi necessário cortar frame ou inventar flag de primeiro frame após load.

Substituída aproximação pela direção visual em prepareSb2Stage9. Runtime serializa sinais do avanço anterior em stage9Velocity; testes restauram velocidades da amostra0. Movimento9 mantém consulta corporal e alinhamento, preservando eixo/ausência de avanço inteiro para reserva seguinte. Não se afirma que magnitudes de toda velocidade nativa foram portadas: apenas sinais e fallback necessários às capturas.

Quatro casos PLANT-RETURN passam até240 com comparação estrita de2720/2722 em TODO frame, além de posições/vida/inventários, bombas/movimento/trava, fogo, itens, bolsa/RNG.95 casos no arquivo geral passaram. Arena9 agora30 replays completos/7200 avanços; continua parcial. Suite shared completa final1510 testes/121 arquivos, zero falhas. Manifesto592 arquivos auditados tamanho/SHA256, zero divergências; baseline37 arquivos tem apenas arena.ts/stage.ts comuns diferentes,35 protegidosSB4 intactos.

Typecheck shared e server passaram; root falhou no client test/player-rail.test.ts72/74: RailCard não possui hidden. Esses arquivos não foram alterados neste avanço, e não foram corrigidos para interferir em trabalho paralelo. A validação root atual não está verde. Próximas pendências SB2: reserva da própria bomba/plantio sobre reserva, colisão entre bombas, multiplayer4, demais estados e arte; arenas10..12 seguem pendentes. Sem commit/push.


### Arena9 — bomba móvel bloqueada por bomba estática

Quatro casos meet-plant29/30/31/32,240 passos cada,964 leituras REA/MCP sem truncamento: evidência ev_69322e0374dbb89602622bfea7f3692d87e409735c1a661b66df478bbd6bd66f, scriptdeb7fbae-dbcb-4727-8df1-56d18f870500. A1 LEFT2..12 RIGHT13 DOWN14..24 UP25..36, segundoA no índice indicado, RIGHT37,DOWN38..48. Primeira bomba para26 pela reserva do jogador e é chutada novamente37. Segundo plantio29 fica11,2 e bloqueia a saída do jogador: antigo controle não é prova de corredor sem obstrução. Plantio30/31/32 fica11,1; jogador sai da faixa e a bomba móvel para50 antes da estática, na célula12,1.

Primeiro desvio49 era reserva residual do jogador. No48 sua posição chegaY64 vindo63.5, mas velocidade nativa já ézero pelo limite do bloco seguinte. Antes o modelo tomava o avanço parcial0.5 como velocidade. Agora guarda avanço apenas quando consome o passo inteiro; chegada parcial ao centro bloqueado zera velocidade, reproduzindo2720=0 no49. Todos os testes anteriores preservados; outras correções fracionárias ainda precisam de cobertura própria.

Próximo desvio50 era falta de bloqueio pela bomba estática. C08ABC/C08AC6 faz probe perto do centro, depois examina código adiante:43 tem bit40 e não é44/50, portanto bloqueia. Controlador9 aplica mesmo teste estrito de centro usado para piso, incluindo bombAt adiante, e devolve a célula estática sem mudar fusível. Artefato manual com bytes/hash SB2-STAGE9-BOMB-MEET-ROM.json. Não valida colisão entre duas bombas móveis.

Os quatro replays passam até240 com reservas estritas, posições, habilidades/inventário, grades, slots móveis/trava, bombas/autor/alcance, fogo, itens, bolsa e RNG. Arena9 total34 replays/8160 avanços. Validação final99 casos gerais e34 testesSB4/mapcycle/stopKick,133 testes/4 arquivos; typecheck shared passou. Root clientRailCard.hidden permanece pendência histórica não reexecutada nesta rodada. Manifesto recebe journal593 entradas; última auditoria completa592 anterior. Observador encerrado; emulador vivo. Próximos passos: reservas da bomba móvel/plantio, duas móveis e quatro jogadores, depois arte; arenas10..12 ainda pendentes. Sem commit/push.


### Arena9 — dois slots móveis simultâneos e parada conjunta

Preparação natural a partir de stage9-left-arrow/entry.state: LEFT11 DOWN11 A1 UP11 RIGHT22 neutro180 LEFT11 neutro2. Abre11,3 (piso61), salva stage9-dual-mobile/entry.state em(207.75,48),speedE0=2,capacidade4 coletada naturalmente. Quatro casos240 passos,965 leituras REA/MCP incluindo preparação, sem truncamento: evidência ev_93fc613c46cfee39515c3e5f43aa9417dcd4b91f96d2dacba19ed099e7c302d2, script7d214332-212e-4e0a-b9ff-059ca4452485.

A1 LEFT2..12 RIGHT13 DOWN14..24 A25 UP26..36 RIGHT37 DOWN38. dual-free neutro depois; dual-stop40 X40;dual-stop41 X41;dual-follow DOWN39..50. Duas entidades nos slots0/1 aparecem37/38; nofree segunda volta45, primeira48. X40/X41 param ambas no próprio comando. follow segunda para45 e primeira só volta142 por fim do contador. Não houve colisão direta entre duas móveis nestes casos: simultaneidade de slots não substitui esse requisito.

Primeiro desvio13 mostrou que célula vizinha não basta para iniciar chute: novo estado chegaX191.25 no12 e avança192.75 no13, sem choque corporal; original não chuta. Contato é registrado durante movimento com posição proposta e corpo estático de16pixels (mesmo helper já validado), e só então tryKick cria entidade. Isso mantém chutes anteriores e gera primeiro chute deste conjunto apenas37. C0AF5F/C0B369/C0B49F/C0B8E7 chamam C0AFAF nos caminhos de contato; não se afirma que todo colisor nativo foi reconstruído.

Segundo desviofollow142: devolver pelo occupied do frame anterior usava1,1; original devolve1,2 após avanço do frame. Conversão por fim de fusível agora usa célula da posição proposta, sem reiniciar contador. Os103 casos gerais passam, incluindo quatro novos com posições/reservas estritas, múltiplas bombas e Xsimultâneo até240. Validação final124 testes/3 arquivos (5stopKick e16SB4) e typecheck shared passaram. Arena9 total38 replays/9120 avanços. Novo estado+metadata+journal no manifesto596 entradas; não refeita auditoria completa nesta rodada. Observador encerrado, emulador carregado. Pendências: encontro direto de duas móveis, reserva da bomba e plantio, quatro jogadores, demais inventários/estados e arte; arenas10..12 continuam sem integração. Sem commit/push.


### Auditoria de reserva móvel e preparação da arena10 após reinício das ferramentas

As ferramentas foram removidas/recarregadas durante uma chamada de separação de análise. Chamada abortada não retornou identificador de subagente e não há handle confirmado; não contar trabalho paralelo como executado. Sessão node_repl perdeu stage9Client; verificação de processo160472 não o encontrou. Portanto o emulador antigo terminou, não está simplesmente esperando. Não repetir instalações; próxima execução deve abrir novo cliente SDK/bridge existente e carregar estados preservados. Nenhuma captura nova realizada nesta rodada.

Nas estruturas móveis já confrontadas REA/MCP, +4C ézero nos percursos de chute observados. O teste geral agora compara palavra+A8 (célula ocupada) e+4C (reserva) para cada slot móvel em TODO frame, além de posição/trava. Os103 casos continuam verdes; ausência de reserva nestas amostras não comprova inexistência em todos os estados. Não transplantar para chutes a reserva antecipada da esteira sem evidência. Typecheck shared passou.

Análise da arena10 realizada diretamente e registrada em SB2-STAGE10-EVIDENCE-AUDIT.md. Teste de13 casos de movimento nativo passou. Confirmados32 frames do arco e deslocamentoX32.5->48 no percurso Y+RIGHT. Lacuna concreta: após preparo80 frames não há leitura imediatamente anterior ao salto; sample97 pertence à arena12,98 já é frame1 do salto10. Não usar97 como frame0 da arena10. Faltam casos de controle/colisão/borda para integrar loop. Auditoria distingue curva confirmada de mecânica completa. Nenhum ID adicional criado; nove arenas internas ainda parciais, nenhumaSB2 liberada. Sem commit/push.


### Arena10 — novo frame0 e controles de salto medidos

Reaberto bridge MCP existente, sem instalação, em NodeREPL: stage10Client/transport10, coreSnes9x1.63 PAL PID220840 com os mesmos hashes. Import ESM do SDK instalado retornou exports is not defined antes de iniciar worker; corrigido para require CommonJS da dependência existente, sem reinstalar. Estado selection.state tem1CCD=0A (arena11); LEFT10 neutro120 START20 neutro400 entra arena10,1CCD09. Frame5550 lido antes de salto: P1(32,48),P2(224,208),estado9000. Novo entry.state preservado.

Quatro casos160 passos desde0: pulse-right Y+RIGHT1 eRIGHT depois; hold-right Y+RIGHT todo o intervalo; pulse-neutral Y1 e neutro; pulse-reverse Y+RIGHT1,LEFT2..40 e neutro. Frame1X32.5/Y44.25,16X40/Y18,32X48/Y48,33X48/Y48 com modo0. Direção oposta no ar não muda deslocamento; após cleanup33, LEFT34..40 leva aX39.25 e neutro mantém. Sem direção, X32 durante todo arco e depois. Ymantido não causa segundo salto nestes160frames; confirmar ainda novo pulso após soltura.

645 leituras REA/MCP (uma preparação e4*161) confrontadas sem truncamento: ev_78b2fc98ff084f438463d1d7441beb47340b54590d8e4b80839f2ccc1ff4d915, script70115087-be6a-458f-ae0f-98c098820d0d. Bundle SB2-REA-STAGE10-JUMP-CONTROLS.json; quatro replays0..160 em FULL-REPLAY. Novo teste sb2-stage10-jump-evidence.test.ts confere arco32, origem0,aterrissagem33, equivalência pulso/manutenção160 e reversão após pouso. Seis novos testes e13 antigos passaram; typecheck shared passou. Esses testes de evidência NÃO certificam o step da arena10, ainda sem ID integrado.

Manifesto recebe estado/metadata/journal,599 entradas; não refeita auditoria completa nesta rodada. REA observador encerrado, cliente stage10Client e emulador carregados para continuar. Próximos ensaios: demais sentidos e novo pulsoY, junto à borda, bombas/fogo e posição de chão. Nove IDs internos parciais continuam fora do seletor; arenas10..12 não integradas. Sem commit/push.


### Arena10 — salto vertical, borda e reativação medidos

Quatro novos casos160 passos: pulse-left/up/down comY+direção1 e neutro depois; double-right comY+RIGHT1 e35, neutro demais.644 leituras REA/MCP confrontadas sem truncamento, ev_8df12bef0d8659ccd0f6c630f5c9c4d8126ec877e4647c875f043127ba44331f, script72a54a7b-0c78-49b8-a579-a47471d19f6b. Observador encerrado; stage10Client/PID220840 preservados.

Correção de escopo:32frames é duração horizontal/neutra medida, não regra universal. UP segue arco até28Y34.5, resolve29Y32.5, continuaUP1pixel/frame sem entrada;36Y25.5->37Y232.5 atravessa borda; estabilizaY208.5. DOWN segue queda além32:33Y52,34Y56.25,35Y60.75,36Y65.5,37Y70.5;38 resolveY67.5 e fica. Não interpretar Y visual como coordenada de chão ou deslocamento vertical linear0.5.

LEFT moveX32->16 durante arco32;33 limpa;34..49 X15->0;50X255;73X232;74 recentra224 e fica. A aproximação inicial de manter1px/frame até78 estava errada; teste agora confronta percurso e recentramento74, não ignora a transição. Novo pulsoY35 no double-right inicia segundo arcoX48.5->64 até66, limpeza67. Há retomada por novo pulso, em contraste com Ymantido da captura anterior.

Adicionado sb2NativeJumpFlightY: voo livre com velocidade inicial4 para cima, aceleração1/4 e passagem de zero, reproduzindo todos os frames aéreos destas trajetórias; helper de altura32 existente reutiliza o cálculo sem mudar limites horizontais. Não decide aterrissagem/borda e não é implementação completa da arena. Doze testes de evidência mais13 de movimento nativo passaram (25); typecheck shared passou. Oito replays capturados/1280 passos/1289 leituras agora existem para10, mas ainda não foram confrontados no step por ausência do controlador integrado.

Manifesto600 entradas após journalnovo; não refeita auditoria completa nesta rodada. Nove IDs SB2 internos parciais, arena10 semID, nenhum seletor liberado. Próximo passo: reconstruir campos de alvo/aterrissagem e passagem de borda antes de integrar; depois bombas/fogo e demais inventários. Sem commit/push.


### Arena10 — alvo e aterrissagem portados em componente serializável

Localizado+C0 como alvoY e+C2 como direção escolhida. C06852 inicializa+C0 com inteiroY&FF. C06789/C067A6 alteram bytebaixo+C0 em+1/-1 somente quando DP32 épar; alvoUP1=47,16=40,28=34,29=33; alvoDOWN1=49,32=64,37=67. C0665C/C06819 compara inteirobaixo do Y anterior ao avanço corrente com alvo ao descer; depoisC0669F escreve+C0 emYinteiro sem substituir fração. Isso explica UP aterrissar29 eDOWN38, sem impor duração32 universal. Bytes/hash e limitações em SB2-STAGE10-LANDING-ROM.json (decodificação manual, não disassemblyREA).

Adicionado sb2-stage10-jump.ts com start/advance puros e estado serializável. Atualiza alvo conforme fasePAL, compara antes de avançar, preserva fração ao pousar; direção horizontal fixa avança0.5pixel/frame. Bordas, entradaY e colisões de chão não são resolvidas por esse componente. No casoUP ele devolveY33.5 na escrita nativa; o original já executa depois passada automáticaUP e apareceY32.5. O teste declara explicitamente essa fronteira, sem confundir resultado intermediário com step completo.

Extrator passou a preservar jump_target_y e jump_direction em todos os jogadores novos. Reextraídos dois arquivos VERIFIED das oito capturas, conservando FULL anteriores e repetindo confronto REA/MCP. Oito testes novos confrontam alvo, posição em voo, transição de aterrissagem e estado após JSON a cada frame do primeiro salto. Double-right segundo salto continua coberto pelo teste de evidência, não alegado como segundo estado do controlador. Total33 testes/3 arquivos e typecheck shared passaram. Nenhuma captura nova neste avanço.

Arena10 continua sem ID no step; manter nove IDs internos parciais e nenhum seletorSB2. Próximo passo: reconstruir/portar controle de borda após aterrissagem e validar também segunda ativação dentro do loop; depois bombas/fogo/inventários/4jogadores e visual. Sem commit/push.


### Arena10 — componente de borda esquerda/superior confrontado até160

C08281 testa+52bit8 para manter controle forçado e limpa flags somente após sair do piso com bit80/43; C0838C inicializa+52=0809 e velocidade forçada por tabela; C0A145 aplica máscara de coordenadas. Bytes/hash e distinção entre leitura manual e modelo medido em SB2-STAGE10-BOUNDARY-ROM.json. Não alegar reconstrução instrução a instrução de todos os limiares a partir desses poucos trechos.

Adicionado sb2-stage10-boundary.ts para duas bordas observadas, sem inventar direita/inferior. LEFT: aterrissa33 emX16; avança-1 a partir34;49X0,50X255;73X232;74 recentra224, termina. UP: aterrissagem29 escreveY33.5 e primeira passada forçada dá32.5 no mesmo frame;36Y25.5,37Y232.5;52Y217.5,53 avança216.5 e recentra208.5. Nota: resumos anteriores apenas davam posição final em66, não instante de fim; limite exatoUP é53, não61.

Dois testes novos encadeiam componente de salto e componente de borda desdeframe1 até160, sem excluir o primeiro frame de voo, aterrissagem ou passagem. Comparam posição e bit de controle forçado em todo intervalo aplicável, com JSON entreframes. Ordem dos eixos explicitada pelo chamador: LEFT não move no próprioframe de fim de voo; UP move nesseframe. Esse encadeamento de componentes não é o step completo. Total35 testes/4 arquivos e typecheck shared passaram. Nenhuma captura nova nem mudança de mapasSB4 nesta rodada.

Próximo passo: capturar bordas direita/inferior com P2 e confirmar alvos/limiares antes de integrar10 ao loop. Permanecem bombas/fogo, colisões especiais, inventários, quatro jogadores e visual; arenas11/12 pendentes. Nove IDs internos parciais, zeroSB2 no seletor. Sem commit/push.


### Arena10 — quatro bordas e comandos opostos confrontados

Quatro novas capturas160 passos,644 leituras REA/MCP sem truncamento, mesmo estado inicial: p2-right/p2-down usam apenas controle2Y+direção1; p1-left-reverse enviaRIGHT34..73 apósY+LEFT1; p1-up-reverse enviaDOWN29..52 apósY+UP1. Evidência ev_f562a2d543c0d136a62b8f1de45244a0707fd06cc6bdb059bd3b8df498fd78ba, script1d727029-b24f-452a-9e3d-ede81aef24cd, bundle SB2-REA-STAGE10-JUMP-EDGES.json; VERIFIED-REPLAY preserva0..160 e campos de alvo. Observador encerrado; cliente/emulador220840 preservados.

P2RIGHT: salto224->240 até32,estadoforçado33,48X255->49X0,72X23->73X32 comflagszero. P2DOWN: alvo na aterrissagem38 é227 mas saída visível224.5 comcontroleforçado;46Y232.5->47Y25.5,62Y40.5->63Y48.5 comflagszero. Comandos opostos durante LEFT/UP não mudam os respectivos percursos medidos. Não prova comportamento de outros botões durante travessia.

Retração de hipótese anterior: UP29Y32.5 não demonstra uma passada automática de1pixel no próprioframe de pouso. A nova captura inferior é incompatível com essa hipótese (alvo227.5 apareceria228.5, mas é224.5). Modelo corrigido: na aterrissagem vertical sobre faixa externa, alinha inteiro ao centro da célula com offsets do mapa8/23, preservando fração. UP33.5->32.5 eDOWN227.5->224.5. Todos os eixos iniciam deslocamento forçado na passada seguinte.

Reentrada agora calcula proposta de1pixel, aplica passagemX256/Y208 e recentra quando volta ao intervalo jogávelX24..231/Y41..216. CentroX=floor((X+8)/16)*16, centroY=floor((Y+23)/16)*16-16, fração preservada. Isso reproduz os quatro sentidos e substitui condições anteriores específicas de eixo. Constantes/modelo são reconstruídos de capturas e offsets nativos, não apresentados como disassembly completo de toda rotina. Componente sb2-stage10-boundary ampliado aFacing; teste encadeia voo/borda e compara todos160frames dos seis casos, inclusive bitforçado e JSON.

Resultado39 testes/4 arquivos e typecheck shared passaram. Total12 capturas arena10/1920 passos/1933 leituras. Ainda não há arena10 no step: falta ligação, controlesY/visual e interações com mapa/bombas/fogo. Manifesto601 entradas depois do novo journal; não refeita auditoria completa. Nove IDs internos parciais e nenhuma arenaSB2 no seletor. Sem commit/push.

### Arena10 - integracao ao step e classificacao de auxiliares

Integrado sb2-10 ao criador e step: Y por borda de pressao, alvo/voo/aterrissagem e quatro bordas. Doze trajetorias completas160 frames mais103 replays anteriores passaram115/115. Adicionados quatro spawns e publicView para10. Nenhuma captura nova:1933 leituras dos tres bundles REA e journals MCP novamente confrontadas,1920 avancos reproduzidos.

Extrator classificava qualquer slot8400..8700 ativo como bomba movel. Auxiliar do salto tem+40=0, acao baixa0A/0B(bit0 orientacao) e jogador em voo aponta ao slot via+C8. Bombas moveis apontam via+40 a tabela7F2000..2700. Agora conserva candidate_entities, separa jump_proxies por vinculo/autoria e rejeita desconhecidos. Novos CLASSIFIED-REPLAY preservam evidencias anteriores.

Teste compara existencia/autoria/alvoY do auxiliar. Hipotese de X sempre atrasado0.5 foi refutada pelo segundo double-right:frame35 jogador e auxiliar48.5. X bruto preservado; ordem do auxiliar pendente. Posicoes X/Y do jogador comparadas integralmente, sem excluir frames. Typecheck shared passou. Execucao ampla com um worker/thread e heap limitado em andamento apos VirtualAlloc/worker exits no host; nao alegar suite completa verde antes do resultado.

Hashes37 arquivos-base: somente arena.ts/stage.ts comuns diferem;35 protegidosSB4 inalterados. Dez IDs internos parciais, zeroSB2 no seletor. Pendentes bombas/plantio/fogo/dano, colisoes especiais, quatro jogadores/inventarios, ordem do auxiliar e arte;11/12 pendentes. Sem commit/push.

Validacao final desta rodada:1558/1558 testes shared em124 arquivos, incluindo115 replays principais e regressoesSB4. Comando: node --max-old-space-size=384 --max-semi-space-size=8 node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1 --pool=threads, em packages/shared. Typecheck shared passou. Manifesto completo: 601 arquivos conferidos por tamanho/SHA256, divergencias=0. Hash calculado em streaming devido a memoria virtual limitada do host. Processo220840 confirmado vivo; nenhuma sessao Frida nova nesta rodada.

### Arena10 - plantio durante salto e contato com fogo

Novas capturas reais, sem escrever WRAM: mesmo estado entry da arena10, dois MAN e COMs OFF. GrupoPLANT: plant-before(A1,Y+RIGHT2),plant-together(A+Y+RIGHT1),plant-air(Y+RIGHT1,A8),hold-air(Y+RIGHT1,A2..45). Todos180 frames,725 leituras com preparo. REA ev_563aca9ed03cf9437e1d5ecec1e7be36abb875d7f021fd516996bf0d0b323393,script cf6009a9-e31c-47d3-8bfb-e208210b9d44; bundle SB2-REA-STAGE10-JUMP-PLANT.json. Plantio simultaneo e no ar bloqueados; hold-air planta34,apos limpeza do pouso33. Plant-before planta1,explode145,morre146 ja no chao. Todos4 replays passaram sem alterar producao.

GrupoFIRE: A1 e Y+RIGHT130/144/145/146,neutral nos demais frames,180 cada.724 leituras REA/MCP,ev_dc912d42fac2653838f7c2793da6a9ca6b4bbf582093c962a13562fb3e999c2b,script c0d7d085-8bc4-4aa1-8df0-676efb2e3cc5; bundle SB2-REA-STAGE10-JUMP-FIRE.json. Jump130 sobrevive todo voo e morre162,frame da limpeza do pouso,com fogo ativo. Jump144/145/146 sobrevivem ate180,pois fogo termina antes do fim do voo. Jump146 inicia no frame de contato com a chama ja existente. Prova estes quatro cenarios; nao generaliza para todos os danos/inventarios.

Tres replays FIRE falharam na vida antes da correcao. resolveFlameContacts agora ignora contato por chama enquanto existe stage10[player].jump; ao remover o voo o contato volta no mesmo frame. Testes continuam comparando posicao,vida,modo/alvo,bombas,chamas,grade,itens,inventario e RNG em todos os frames.123/123 replays principais passaram apos correcao. Typecheck shared passou com heap limitado; tentativa padrao paralela sofreu falta de memoria do host. Suite completa limitada em andamento.

Total arena10:20 capturas,3360 avancos nativos,3382 leituras REA/MCP. Ambos observadores encerrados apos export; emulador/cliente existentes preservados. Journals novos adicionados ao manifesto(603 entradas); apenas as duas adicoes verificadas nesta rodada, auditoria total anterior601 preservada. Pendentes outros danos, bombas com inventarios, colisao/contato, quatro jogadores e arte;11/12 pendentes. Sem commit/push.

Validacao final apos regra de fogo:1566/1566 testes shared em124 arquivos, incluindo123 replays principais; typecheck shared passou. HashesSB4 protegidos35/35 inalterados. CapturasPLANT/FIRE e transicoes resumidas em SB2-STAGE10-PLANT-FIRE-OBSERVATIONS.json. Proximo: capturar colisao/plantio no pouso com bomba ocupando destino e interacoes de dois jogadores; nao assumir ausencia de bloqueio a partir de voo livre.

### Arena10 - pouso sobre bomba, fracao vertical e dois saltos simultaneos

Dois grupos novos,4x180 frames cada,sem escrita de WRAM,mesmo estado inicial. LANDING: destination-rest(RIGHT1..13,A14,LEFT15..27,Y+RIGHT28),destination-exit(mesmo,RIGHT61..80),neutral-on-bomb(A1,Y2),repeat-on-bomb(A1,Y2/Y36).724 leituras REA/MCP,ev_821f3192819e1195f5b5af1d5d3e918fa058494b19419f96dddb0ef2971b16e0,script6da0508d-1e98-4e89-8b5e-e6252b129886. Bundle SB2-REA-STAGE10-JUMP-BOMB-LANDING.json. Quatro casos falharam antes da implementacao.

Pouso sobre bomba inicia deslocamento forcado1pixel/frame. RIGHT:voo28..59,saida60X49..66X55,67recentraliza64; comandoRIGHT mantido so atua depois. Neutro:voo2..33,saida34Y49..41Y56,42recentraliza64; novoY36 ignorado durante saida. Campo escape privado conserva direcao/posicao; comparador confronta flag+52bit8 tanto em escape quanto boundary. Ao sair da celula ocupada, aplica centro nativo com offsets8/23 e preserva fracao. Entrada vertical alinha inteiro antes do primeiro passo forcado. Bordas durante escape/obstaculos adjacentes nao estao certificados.

DIRECTIONS: destination-left(RIGHT1..13,A14,RIGHT15..27,Y+LEFT28),destination-down(DOWN1..13,A14,UP15..27,Y+DOWN28),destination-up(DOWN1..13,A14,DOWN15..27,Y+UP28),dual-jump-bombs(A1,Y+RIGHT2 no controle1;A1,Y+LEFT2 no controle2).724 leituras REA/MCP,ev_0b275b5429b57d66370c14eacbeb2dd91a2eb6e03d430a46ef12dc4550662edc,script720e76ff-5c84-4091-9545-b3ca3a64b81a. Bundle SB2-REA-STAGE10-JUMP-BOMB-DIRECTIONS.json. LEFT passou sem ajuste; UP/DOWN e dual revelaram divergencias adicionais.

C06852 escreve+1C=4 sem limpar fracao+1E. Movimento vertical1.25 anterior deixa.25; salto entao inicia-4 e nao-3.75,subida17frames eapice34pixels. Componente recebe fracao vertical anterior,transportada pelo deslocamento de chao observado. Formula e quadro a quadro confrontados nas duas trajetorias; outras velocidades/fracoes e choques de chao pendentes. C08447 usa+5E,default8(DOWN) sezero,e+C2 prevalece quando presente. Bytes/hash e limitacoes em SB2-STAGE10-BOMB-LANDING-ROM.json; leitura manual,nao disassemblyREA.

No dual,P1explode145/morre146;P2bomba explode147 eP2morre148. Regra global de congelar fusiveis ao sobrar um vivo parava indevidamente a segunda bomba. Arena10 agora mantem contagem apos primeira morte,conforme captura; demais arenas mantidas ate evidencia propria. Duas entidades auxiliares simultaneas e autoria conferidas,mas jogadores distantes: nao prova colisao entre jogadores.

Ferramentas: MemoryError ao carregar journal inteiro. Leitor incremental capture_json.py conserva registros e rejeita truncamento/separadores invalidos; verify_effects usa zip_longest para rejeitar quantidade diferente,extrator tambem percorre incrementalmente. Dois testes Python passaram(frentes de bloco,UTF8,nested,truncamento e sintaxe). Comparacao PLANT anterior725 leituras reproduzida identicamente com novo leitor. Sem relaxar validacao REA/MCP.

131/131 replays principais passaram; typecheck shared passou. Suite completa com1thread eheap limitado em andamento. Total arena10:28 capturas,4800 avancos,4830 leituras. Observadores encerrados apos export; cliente/emulador220840 preservados. Manifesto605 entradas,adicoes verificadas por hash/tamanho; auditoria total601 anterior continua identificada separadamente. Sem commit/push. Pendentes outros inventarios,obstaculos/bordas durante saida,dano na saida,colisao multiplayer,quatro jogadores e visual;11/12 pendentes.

Resultado final desta rodada:1574/1574 testes shared em124 arquivos,131 replays principais,typecheck aprovado e2 testes Python aprovados.35 arquivos protegidosSB4 preservam hashes anteriores. Continuar por colisao e pouso sobre outros obstaculos/saida junto a borda antes de certificar arena10; contato fisico entre jogadores nao foi ensaiado pelos saltos simultaneos distantes.

### Arena10 - saida sobre paredes/blocos, continuidade pela borda e fogo

Novos ensaios sem escrita WRAM usando o mesmo entry nativo. OBSTACLES: wall-right(RIGHT1..26,Y+RIGHT27),wall-middle(DOWN1..13,Y+RIGHT14),block-down(DOWN1..26,Y+DOWN27),bomb-left-border(A1,RIGHT2..14,Y+LEFT15).4x240 frames,964 leituras REA/MCP,ev_d0e96af76c8f67b27b4f8761241cd39111c31adeb3599172b21292c7264d4ddf,script1edfca31-53be-407b-b4b6-fd77ebcd867d. Bundle SB2-REA-STAGE10-JUMP-OBSTACLES.json. Todos4 falharam antes da ampliacao da saida forcada.

wall-right:pousa59X80.5,controle forcado,comeca mover60 e termina163X192.5. wall-middle:47X49/Y64.25 em voo;48alinhaX48,comeca mover49 e termina216X224. block-down:65Y104.25,66alinha96.25,comeca mover67 e termina139Y176.25. bomb-left-border:47X31.25,continua pela bomba/faixa externa,passaX0/256 e termina103X224.25. Isso confirma que saida nao se limita a bomba: C08281 conserva controle em superficies com bit80 ou codigo43. Modelo agora consulta paredes/blocos/bombas e envolve coordenadasX256/Y208 enquanto continua ocupado. Pouso sobre terreno alinha ambos eixos e avanca so na proxima passada; bomba isolada avanca na propria aterrissagem. Bytes/hash e limitacoes em SB2-STAGE10-OBSTACLE-ESCAPE-ROM.json(leitura manual e modelo medido,nao disassemblyREA).

ESCAPE-FIRE:A1,Y neutro110/111/112/113,neutral demaisframes,4x180,724 leituras REA/MCP,ev_00ec00d20774f31b05383a0da65b34bf91cab02d23276bd5a46f2a7ac2d7d7dd,script6b7431a3-a339-4bde-80e7-c4e0f7bdaf07. Bundle SB2-REA-STAGE10-ESCAPE-FIRE.json. Nos4 casos jogador esta em saida quando bomba explode145;146recentralizaY48 e libera controle,vivo;147morre. A saida forcada sobre obstaculos protege inclusive a passada final; contato de chama precisa voltar so na seguinte. nativeContacts agora nao amostra chama quando escape existia no inicio do frame. Regra de voo anterior,que permite morte na aterrissagem,continua separada e passa nos replays anteriores. Nao estender automaticamente a borda-fogo ainda nao ensaiada.

139/139 replays principais e typecheck shared passaram. Suite completa limitada em andamento. Resumo das transicoes em SB2-STAGE10-OBSTACLE-ESCAPE-OBSERVATIONS.json; todos0..240/180frames preservados/confrontados. Total arena10:36capturas,6480avancos,6518leituras. Manifesto607 entradas com duas adicoes verificadas,sem reescrever hashes antigos; auditoria total601 anterior permanece distinta. Ambos observadores encerrados apos export;cliente/emulador220840 preservados.

Pendentes mudancas dinamicas de obstaculos,contato fisico entre jogadores,borda-fogo,inventarios/velocidades,quatro jogadores e visual;11/12 pendentes. Continuam dez IDs parciais e nenhumSB2 no seletor. Sem commit/push.

Validacao final:1582/1582 testes shared em124 arquivos,139 replays principais e typecheck aprovado.35 hashes protegidosSB4 inalterados. Proximo: borda-fogo e contato fisico entre jogadores; depois inventarios/quatro jogadores e integracao visual. Nenhuma arena marcada completa.

### Arena10 - contato e fogo na reentrada com dois humanos no mesmo corredor

Preparacao somente por controles: P2UP40,Y+UP1,neutral150,UP40,UP2,neutral1 deixa P1(32,48),P2(224,48),sem modo ativo. Entry.state preservado junto ao journal;4leituras de preparacao verificadas pelo mesmo REA. Casos240frames:border-overlap(Y+LEFT1),border-fire175(Y+LEFT110 no P1,A30 no P2),border-fire165(Y+LEFT100 no P1,A20 no P2),border-walk-contact(Y+LEFT1,P1RIGHT/P2LEFT75..100). Evidencia ev_aa0927ba2e0be39127ebc374e4afe3653a04a7ac508337d4cf611feb6d8e832c,scriptbad41e31-f51f-4332-af7f-fe2fb7c68cfa;bundleSB2-REA-STAGE10-BORDER-PAIR.json.968leituras conferidas,960avancos reproduzidos.

Reentrada pode ocupar exatamente a posicao de P2(224,48) no caso observado. Os comandos de caminhada apos sobreposicao tambem conferidos,sem alegar todas as geometrias de colisao. Fogo175:morteP2 em176,P1 termina borda183 vivo e morre184;fogo165:morteP2 em166,P1 termina173 vivo,morre174. Regra existente de amostragem por posicao anterior ja reproduziu estes casos sem nova mudanca de producao. Nao adicionar imunidade de borda hipotetica apenas por esse resultado.

Replay inicializa alvoY/fracao vertical a partir do estado0,pois P2 tem salto anterior na preparacao.143/143 replays principais passaram. Ultima suite completa1582/1582 anterior aos quatro fixtures adicionais. Total40casos arena10,7440avancos,7486leituras(inclui preparacao). Manifesto atualizado com journal/entry/metadata novos. Sem commit/push. Proximo retomar arena11 e manter inventarios/quatro jogadores/visual e demais interacoes explicitamente pendentes.

### Arena11 - quatro bordas, soltura e projecao do lancamento

Reutilizado cliente/emulador220840. Entrou pelo selection.state(two-human-arenas),START20 e neutral400,arena11 confirmada1CCD=0A emframe5420. Entry.state preservado,doisMAN/COMsOFF,sem escreverRAM. Inventario inicial observado:speed2,capacity6,fire6(range7),kick1,glove1. Esse preset ainda nao foi aplicado a um novo ID interno11.

CONTROLS: P1LEFT/P1UP/P2RIGHT/P2DOWN nosframes1..20,neutral21..240.4capturas,965leituras REA/MCP,ev_cf4524b5a80697b8d56eda42ef61d2b17a6669473fade69fb11941e95e91992e,script10414f4b-5e9d-4a01-b898-d6c0fdb8730f;bundleSB2-REA-STAGE11-EDGE-CONTROLS.json. Todos ativam modo40 em5,modoC0 em28 e movimento normal71. Direcao do lancamento e para dentro:RIGHT/DOWN/LEFT/UP respectivamente. Projecao termina em159.8125/175.8125/96.1875/80.1875 no eixo ativo,nao em distancia inteira128.

CHARGE: release4(LEFT1..4),release5(LEFT1..5),interrupted(LEFT1..2,neutral3..4,LEFT5..8),reverse-charge(LEFT1..5,RIGHT6..80).4x160frames,644leituras,ev_637434f60547b602166eee5eca3af00d97df655269321d902440f257e5d042b8,script2f645f61-1503-4fd7-bcdf-2d12222b8159;bundleSB2-REA-STAGE11-EDGE-CHARGE.json. Release4 nao ativa;release5/reverse ativam5/lancam28/terminam71;interrupted ativa8/lanca31/termina74,origemX32.5 e fim160.3125. Campo+C4:release5 frames1..5=0,1,2,3,4;interrupted1..8=0,1,0,0,1,2,3,4. Nao modelar isso como simplesmente cinco frames consecutivos: facing e ordem de entrada precisam ser integrados.

Leitura manualROM C05F97/C0602A despacha preparo/lancamento;estado+0C=0FFF da animacao libera modo80. C06190/61CF/620E/624D compara inteiroX32/224,Y208/48,incrementa byte+C4 e inicializa em4,exigindo controles e facing correspondentes. C06122 usa tabelaC5E442 por facing*4:velocidade5 e desaceleracao fracionaria1800hex(3/32). C0606D limpa lancamento ao zerar inteiro da velocidade anterior. Bytes/hash e distincoes em SB2-STAGE11-EDGE-ROM.json;nao alegar disassemblyREA nem animacao reconstruida completamente.

Portado sb2-stage11-flight.ts puro/serializavel,sem ID11 nem ligacao ao step.43passadas reduzem velocidade antes de mover;44a sai do voo e move1.5(velocidade de chao observada).7 testes confrontam todos44frames ate fim das sete capturas que lancaram,inclusive origem fracionaria e comandos opostos;308observacoes comJSON entrepassadas. A projecao X/Y nao e altura visual do sprite:animacao/renderizacao permanecem pendentes. Preparacao23frames medida nestas capturas,mas ainda nao implementada como temporizador generico.

Validacao:150/150 testes direcionados(143replays principais+7projecoes),typecheck shared aprovado. Ultima suite completa1582/1582 anterior a esses novos fixtures/componente;nao relabelar como suite completa atual. Manifesto614 entradas,adicoes verificadas por hash/tamanho. Ambos observadores fechados apos export;cliente e emulador carregados em11,preservados noframe5580. Dez IDs internos parciais continuam;11 semintegracao. Proximo integrar gatilho/facing e preparacao por animacao,confrontar8casos no step e entao ampliar bombas/dano/itens/multiplayer/visual. Sem commit/push.

### Arena11 - ligacao do gatilho, preparacao e lancamento ao step

Adicionado ID interno sb2-11,reusando a grade/spawns capturados. Criador inicia inventario observado speed2(1.5pixel/frame),capacidade6,alcance7,kick/glove1;itemSkull exposto7,6(glyph160A) quando usa itens nativos. Codigo de grade4(item) passa a ser transitavel no builder. Teste inicial confronta inventario/item diretamente com captura,nunca so com valores da implementacao.

sb2-stage11-controller.ts: exige direcao e facing anterior correspondentes,inteiro do eixo na borda32/224/48/208,incrementa contador+C4 e inicia em4. Soltura zera contador;troca de facing aguarda a passada correspondente. Estado de preparacao bloqueia comandos antes do lancamento. Tabela C210A1 e amostras brutas explicam espera inicial2 e comandos1,2,2,3,4,8,total22passadas bloqueadas depois da entrada;gatilho5,lancamento28 nos casos originais,8/31 nointerrupted. O terminal0FFF capturado corresponde ao fim da preparacao. E reconstrucao temporal dos casos observados,nao implementacao completa do interpretador de animacoes SNES.

No movimento livre da11,limite de caminhada escreve apenas inteiroX32..224/Y48..208,preservando fracao. Sem isso o modelo andava30.5 onde original32.5;clamp inteiro reproduz alternancia32.5/32 dos quatro primeiros comandos de borda. Rotina estatica completa desse limite nao foi identificada;modelo inferido e confrontado com oito capturas. Lancamento usa componente puro existente,limpa contador ao iniciar e devolve controle apos ultima passada1.5.

Oito replays principais novos reproduzem todos1600avancos,inclusive carga,soltura,reversao e estados40/C0.151/151 replays passaram;nao houve captura nova nesta integracao. Sete testes puros permanecem. Criacao/quatro spawns/publicView ampliados para11;typecheck shared passou. Suite completa limitada em andamento. Ainda sem seletorSB2;nao certificar animacao visual,bombas/dano/interacoes/multiplayer a partir desses percursos de borda.

Validacao final da integracao11:1604/1604 testes shared em125 arquivos,151replays principais e typecheck aprovado.35 hashes protegidosSB4 permanecem iguais;somente arena.ts/stage.ts comuns diferem da base37,como ja documentado. Onze IDs internos parciais,nenhumSB2 no seletor. Proximo capturar bombas/fogo durante preparacao e lancamento,validar dinamica antes de visualizar/selecionar;arena12 ainda pendente. Sem commit/push.

### Arena11 - plantio, fogo e inventario na preparacao/lancamento

Cinco capturas200frames a partir do entry11,sem alterarWRAM: plant-before-charge(A1,LEFT2..6),plant-in-charge(LEFT1..5,A8),plant-in-flight(LEFT1..5,A35),fire-launch(A1,LEFT111..115),fire-charge(A1,LEFT125..129).1005leituras REA/MCP,ev_099d230a3cd8f092b620208f90ff846356edb8a234edd2d8d98463d84a4cf50d,scriptc9fd30cb-d719-4cb6-98d2-629e36b8bd3b;bundleSB2-REA-STAGE11-CHARGE-BOMBS.json. Observador encerrado depois do export;cliente/emulador preservados.

PlantioA8 durante preparo eA35 durante lancamento nao produzem bomba. Plant-before cria1,ativa6,lanca29,termina72;explode145. Fire-launch ativa115,lanca138 e permanece vivo apesar da explosao145;termina181. Fire-charge ativa129,bombaexplode145 e jogador morre146 ainda em modo40,com inventario6bombas/alcance7/speed2/kick/glove preservado e sem espalhar itens no ensaio.

Falhas concretas corrigidas: tres casos divergiam na grade de fogo porque o modelo queimava faixa externa0,1/1,0;burnRay agora limita bracos da arena11 ao interior1..13/1..11. Depois apareceram morte indevida em voo e reset/espalhamento de inventario no preparo. resolveFlameContacts ignora somente flight11 ativo,sem proteger preparacao;dropItems nao executa na morte da11,como exige a captura. Demais arenas conservadas. Nao alegar que essa unica morte prova todas as regras de inventario/multiplayer da11.

156/156 replays principais passaram;typecheck shared aprovado. Total arena11:13capturas,2600avancos,2614leituras. Resumo em SB2-STAGE11-CHARGE-BOMBS-OBSERVATIONS.json. Manifesto615entradas com journal novo verificado,sem afirmar nova auditoria total. Suite shared completa limitada em andamento. Pendentes fogo na transicao final do voo,capacidade/multibombas,demais comandos/itens,multiplayer,quatro jogadores e visual;12pendente. Sem commit/push.

Validacao final:1609/1609 testes shared em125 arquivos,156replays principais,typechecks shared/client/server aprovados individualmente. Client esgotou heap384MiB;com768MiB passou,sem mudarconfig.35 hashes protegidosSB4 inalterados. Proximo capturar aterrissagem11 com fogo ativo/obstaculo e interacoes de dois jogadores,antes de certificar dano/colisao. Onze arenas internas parciais;12 e visual ainda pendentes. Sem commit/push.

### Arena11 - contato com bomba, rebatida e fim de voo sobre fogo

LANDING-PAIR: preparouP2 apenasporcontroles(UP108,neutral1,LEFT43,neutral1),ficando159.5,48;P1permanece32,48. Entry salvo e duasleituraspreparatorias conferidas.4x240frames:landing-player(LEFT1..5P1),landing-bomb(mesmo,A30P2),landing-fire(LEFT110..114P1,A30P2/RIGHT31..60P2),landing-walk(LEFT1..5P1,RIGHT72..95P1/LEFT72..95P2).966leituras REA/MCP,ev_15d6cc76a386e39e9dd7ceeab9b3053502e42d775ad81773974b933e4da9cab9,script260f5d08-e104-4e45-8fd8-487eaff19c9d;bundleSB2-REA-STAGE11-LANDING-PAIR.json.

Sem bomba,P1termina71X159.8125juntoaP2X159.5 e comandos de caminhada posteriores conferem,sem afirmar todas geometrias de colisao. Com bomba,61proposta entra nocorpo16pixels;original mantemX144.40625 ezeravelocidade,geraentidademovel842E(emvezdeuma bombaestatica).62retornaaomovimentonormal eavanca1.5ate145.90625. Bomba anda2pixels/frame,92proposta222recentra224 e rebateparaLEFT,113paraestaticacelula10 por jogadorafrente. Transporte nativo existente da9 reutilizado na11,desligando setas e adicionando rebatida nafaixaexterna. Esse ensaio valida rebatida horizontaldireita;demaisbordas/verticalidade pendentes.

Caso landing-fire nao chegou ao destino de voo:colidiucom bomba aindaestatica170,zerouvelocidade;171terminouvoo em144.40625. Naochutouporquecontadorfinalbaixo. C0B1F8 exigebyte+04>=3,C0B155 verifica terreno/jogadoresafrente,C0AFAFassocia+40slotestatico ecombina bitsbaixos do jogador,explicando842E durantevoo. Gate do modelo>=6antesdodescontodapassada reproduzfasecapturada;outrasparidades/cutoffsexatos exigemcapturas. Bytes/hash em SB2-STAGE11-KICK-CONTACT-ROM.json,leituramanual,nãodisassemblyREA.

Para medir contato final sem interrupcao precoce,preparouP2RIGHT12/neutral1 apartirdoentryanterior:177.5,48. FINAL-FIRE: P1LEFT110..114 em todos;P2A1/30/31/34.4x220frames,885leiturasREA/MCP,ev_5041bd37374a61a791162cd739595bbeb3a1fd5c05cca2f92471c2f769398569,scriptcb16d511-e559-4a6e-b3c6-b439b231ea81;bundleSB2-REA-STAGE11-FINAL-FIRE.json. P1termina180X159.8125. ComA1 fogo acaba antes e sobrevive;A30/31/34 tem fogoativo e morre180,nopróprioframe emquevootermina. Regra de voo existente reproduziu transicao sem imunidadeextra.

164/164 replays passaram;typecheck shared aprovado. Totalarena11:21capturas,4440avancos,4465leituras. Observadores encerrados apos export;cliente/emulador preservados. Manifesto621entradas comnovosjournals/entries/metadadosverificados. Resumo em SB2-STAGE11-LANDING-OBSERVATIONS.json. Suite completa limitada em andamento. Pendentes outroscontatos/chutes,demaisbordas/paridades,comandosX/Y,coletas,inventarios,quatrojogadores e visual;12pendente. Semcommit/push.

Validacao final:1617/1617 testes shared em125 arquivos;164/164 replays principais tambem passaram apos ampliar verificacao de facing da11. Typecheck shared aprovado.35 hashes protegidosSB4 iguais. Proximo ampliar chute/rebatida para outros sentidos e paridades,comandosX/Y e capacidade;manter animacao/visual/quatrojogadores e arena12 como pendentes. Onze IDs parciais,nenhumSB2 no seletor. Sem commit/push.

### Arena12 - entradas iniciais e item expelido no piso central

Reutilizados cliente e emulador220840. Pelo selection.state de dois humanos: RIGHT10,neutral120,START20,neutral400 entra arena12,1CCD=0B,frame5550. P1(32,48),P2(224,208),inventario inicial1/1/1. Entry.state e screenshot preservados. A imagem mostra paredes azuis e pisos circulares,mas a aparencia nao comprova uma mecanica de setas.

INITIAL-CONTROLS: P1RIGHT/P1DOWN/P2LEFT/P2UP1..80,neutral81..240.965leituras REA/MCP,ev_a2f91a7e5bf522ea8754a012836876343dc8b6983db1fddc74da61c8b7ba3efe,scriptcbb54928-c615-4973-a4a1-ea0ed51f501e. Bundle SB2-REA-STAGE12-INITIAL-CONTROLS.json. Movimentos horizontais bloqueados junto ao spawn;P1DOWN para112 eP2UP para144. Esses casos nao ativam o piso central. Grade apresenta codigos0/2/5/6/11/12,nao os codigos23..30 que seriam sugeridos por interpretar a textura como setas.

CENTER-ENTRY: preparacao somente por controles:DOWN64,RIGHT64 deixa96,112;A1,LEFT52,neutral200 abre os blocos;RIGHT80,neutral1 deixa128,112. Durante essa aproximacao coletouFire:inventariofire passa1->2. Tres leituras de preparacao verificadas pelo REA;entry salvo. Casos200frames:center-held-down(DOWN1..80),center-pulse(DOWN1..13),center-action(DOWN1..13,Y14),center-bomb(DOWN1..13,A14).807leituras REA/MCP,ev_4fe3809fc4f075595e6740463e13f2c98ebfb08e28a5b461d80fd3ce83e09c7c,script571e7878-6347-47ee-b60e-adaf4588af13. Bundle SB2-REA-STAGE12-CENTER-ENTRY.json.

Na entrada9 jogador recentra128,128,flags81,e perde o Fire extra;nasce auxiliar8400 com+06=8000,+40=0,+7E=0200,+4A=1602. Em10 piso central4B vira chama41;em11 jogador9800/flags801. Chama dura ate51 e some52;item aereo reaparece no chao em129. As imagens9/16 foram inspecionadas,mas a identificacao segura do auxiliar veio do glifo1602 e da rotinaC093F6. Nao chamar o auxiliar de bomba movel nem considerarY/A14 teste de jogador vivo:ele ja morreu11. Gatilho/rotina exata do piso11 e diferenca para12 ainda pendentes.

Extrator antes rejeitava esse auxiliar desconhecido. Agora preserva todos em candidate_entities e classifica airborne_items somente por+7E0200,+4Aglifo valido,+06jogador8000/8100 e+40zero. Bombas com link estatico continuam separadas e desconhecidos continuam erro. Reextraido CENTER-ENTRY apos nova classificacao,sem descartar estruturas.

C093F6 consome registros de6bytes(flags,VX,VY) da trajetoria apontada por+43. A tabelaC5C7BC tem20registros e terminaFFFF;C09155 marca80 durante perda/espalhamento de inventario. Leitura manual,bytes/hash em SB2-STAGE12-AIR-ITEM-ROM.json;nao disassemblyREA. Portado sb2-item-flight.ts para um segmento:aplica velocidade anterior,carrega proximo comando e entrega pouso ao chamador. Primeiro segmento observado vai de128,112 em9 ate208,129 em30. Teste confronta21passadas nas quatro capturas,84observacoes,comJSON entrepassadas. Rebatidas seguintes e outras tabelas continuam pendentes;nao ligar segmento isolado ao step como mecanica completa.

Validacao:165/165 testes direcionados(164replays anteriores+1teste do segmento),typecheck shared aprovado. Ultima suite completa1617 anterior ao componente novo;nenhuma afirmacao de suite completa atual. Totalarena12:8capturas,1760avancos,1772leituras. Manifesto630entradas comnovosjournals/states/metadados/imagens verificados. Observadores fechados apos export;emulador preservado em12,ultimo frame6028 da inspecao visual. Onze IDs internos parciais continuam;12 semintegracao e nenhumSB2 no seletor. Proximo identificar chamada do piso4B,comparar entrada atrasada/retirada antes do centro e piso4C,portar ativacao e ciclo do item antes da integracao12. Sem commit/push.


### Arena12 - gatilho do piso11, registros de efeito e paridade

CENTER-GATE:4x200frames,804leituras conferidas; FLOOR-REGISTERS-160:5x160frames,805leituras; FLOOR-PARITY:2x160frames,322leituras. Comparacoes e replays classificados preservados com esses nomes em docs. Total validado arena12 agora19casos,3680avancos,3703leituras. Captura FLOOR-REGISTERS-PARTIAL preservada,mas excluida dos totais:1005leituras MCP excederam limite REA de16MiB. Repeticao160 completa resolve cobertura sem descartar o registro parcial.

ROM:dispatch C0435E/tabelaC5EBBF leva piso11 aC04623 e piso12 aC046E3. Piso11 recentra C0456D,aplica impacto C084BB e espalha inventario C0914A/C09155;cria registro porC0468F. Nao e gatilho por distancia estrita6:DOWN7 paraY120.75 permanece seguro;DOWN8 ja entra na celula e aciona no frame9 mesmo com neutral/UP. Casos stop-before/withdraw-before de CENTER-GATE receberam nomes imprecisos:ambos ja haviam entrado. DOWN7 seguidoUP8..12 nao ativa.

Observador novo rea-stage12-floor-registers.js inclui512bytes em7F0000. Extrator exige essa regiao e cobertura continua,sem aceitar capturas antigas que nao a observaram. Registro observado tem background0250,celula0490,tipo4,animacao0,intervalo3,timer0. Componente isolado sb2-floor-effect.ts avanca somente em fase impar:timer>1 decrementa;caso contrario animacao+=2,timer=3;animacao16 encerra. A atualizacao ocorre inclusive no frame de criacao quando impar. Centro original ativa9/fase606,chama10,encerra52. Delay1 ativa10/fase607 ja comanimacao2/chama;delay2 ativa11/fase608 comanimacao0 e chama12. Tres testes comparam todos os estados do registro e chama ate160;nao ha integracao ao step.

Piso12 superior:UP1..13 recentra no frame7 em128,96.5,flags0801;salta26,apice46 emY49,pousa66 em96.5;repete preparo67,salto86,pouso126 mesmo neutral. UP mantido altera percurso e provoca retorno pela borda. Proxy tem modo0 e flags1801;extrator aceita vinculo C8 maisflag1000 e estado0A,sem confundir comitem aereo/bomba. Salto12 ainda nao portado;demais trajetorias do item,animacoes,arte e integracao12 pendentes.

Validacao atual36/36 testes direcionados (32step,3relogio,1item) e typecheck shared aprovados. Ultima suite completa1617 anterior aos componentes. Manifesto634entradas;quatro journals novos tiveram tamanho/hash registrados,sem alegacao de nova auditoria integral. Frida parity exportado e fechado;emulador preservado no frame6172. Onze IDs internos parciais;12 semID e nenhumSB2 no seletor. Sem commit/push.


### Arena12 - reutilizacao da curva vertical do salto

O caso upper-pulse ja confrontado REA/MCP permite validar tres lancamentos26/86/146. A curva de sb2-native-motion.ts agora aceita velocidade inicial (padrao4 preservado);com5 reproduz95posicoes nativas,40frames nos dois primeiros voos e15 no terceiro. Origem96.5,apice49,primeiro deslocamento-4.75;frames66/126 aterrissam e67/127 voltam ao preparo. sb2-stage10-jump.ts reutiliza o mesmo calculo para a fracao de velocidade anterior,removendo duplicacao sem mudar a regra de aterrissagem. Teste sb2-stage12-spring-evidence.test.ts valida apenas arco neutro e transicoes observadas;nao e controlador integrado12.

Validacao240/240 testes direcionados em9arquivos:34curva/controlador10/evidencia12 e206replays/step/bordas/componentes,incluindo164replays principais. Typecheck shared aprovado. Nao houve novas capturas nem alteracao de mapasSB4 nesta etapa. Pendentes preparo/entrada/controle do piso12,reentrada,colisoes,trajectorias completas dos itens,integracao12 e visual das arenas. Sem commit/push.


### Arena12 - comandos no preparo,na partida e durante voo

Snes9x status confirmou processo220840/ROM e DLL anteriores,frame6172. Nova sessaoREA4935a6db-fbe7-4a1b-a551-9d09902f8874,script8906c8fb-361f-4f01-a246-2b9c1f5cbd05,observador floor-registers. SPRING-CONTROLS:4x160frames,644leituras,sem truncamento;ev_864e929c778fa46320b057fe8868970d5fe3ef02c848563f724858f0f064d2be. Entry central reutilizado. Todos UP1..7;prep-right/left aplicamRIGHT/LEFT8..25;launch-right aplicaRIGHT26..40;flight-right aplicaRIGHT27..40. Neutral nos outros frames,dois humanos.

Prep-right/left reproduzem todas as161posicoes/flags do upper-pulse neutro;comando no preparo nao determina direcao persistente nesses casos. Flight-right ficaX128 na partida26,anda0.5/frame27..40 ate135,para ao soltar,aterrissa66 e recentra128 no novo preparo67. Launch-right difere:anda1.5625/frame26..40 e1.1875/frame41..65 mesmo sem input,pouso inicia escape flags0809 no66 e retorna ao chao livreX224.125 no106. Nao portar essa velocidade como constante universal:precisa decodificar ramo de partida e capturar outras direcoes/solturas. ROMC0499A escreve velocidadevertical5 egravidade4000,guarda alvoY emCC;C6contem contadordevoo alto eflagsbaixos. Valores brutos estao nojournal,sem injetar WRAM.

Bundle SB2-REA-STAGE12-SPRING-CONTROLS.json publicado285134631bytes e confrontado com644leituras. Export retornou cleanup_incomplete/EBUSY no temporario docs/.rea-write-aDSZkK/content;nao repetir export nem confundir com falha do arquivo publicado. Diretorio temporario ainda existe. Frida fechado apos export. Replays/comparacao preservados;manifesto635entradas,novo journal com tamanho/hash conferidos. Totalarena12:23casos,4320avancos,4347leituras validas. Quatro testes spring passaram,incluindo equivalencia do preparo e deriva apos partida;os demais240 passaram na etapa anterior. Nenhuma nova integracao12 ainda. Proximo decodificar C047A5..C0499A e ramo de direcao,comparar launchLEFT/UP/DOWN e outras duracoes deinput antes de modelar impulso persistente. Sem commit/push.


### Arena12 - impulso horizontal de partida confirmado

LAUNCH-DIRECTIONS:UP1..7,neutral8..25,LEFT/UP/DOWN26..40 ouRIGHT somente26,neutral restante ate160. Quatro casos,640avancos,644leituras REA/MCP,ev_1a4e490c8ca46c817994c7c9ffe7827f1cf7835f986e894123bc77088e07f3f8,script8d4312f1-a536-4ddd-bb7b-d4194cd666d0. Bundle296370919bytes exportado semerro e Frida9781f7cc-472c-43a2-acab-7725ebe1e4b3 fechado. Comparacao e replay classificados preservados. DOWN cria proxy8400 estado8408 descendente;extrator antes rejeitou corretamente entidade desconhecida. Regra acrescentada exige vinculoC8,tipo0400,flags1000 eestado08,sem classificar como bomba/item.

C04936 seleciona ramo a partir do comando corrente na partida,C04B91 paraRIGHT escreve+14=1,+16=3000 (1.1875),velvertical5;LEFT C04A95 simetrico. Novo sb2-stage12-flight.ts reproduz voo horizontal livre com impulso persistente e incremento do input0.375. Validado emLEFT26..40,RIGHT26..40 eRIGHT26somente:120posicoes ateframe65,comJSON entrepassadas. Nao e controlador completo nem foi conectado ao step. Outros inputs/reversoes precisam captura. Pouso frame66 iniciaescape por terreno ocupado (flags0809),ainda nao integrado12.

UP/DOWN nao sao o mesmo salto horizontal:UP26Y90.75 eDOWN26Y93.75;alvosCC/ CD diferem e exigem decodificacao dos ramosC04B16/C04A0D. UP sai pela borda e retorna;DOWN terminaY151 neste ensaio. Manter pendentes em vez de generalizar a curva5.

Sete testes12 passaram(4evidencia,3voohorizontal). Manifesto636entradas com novo journal hash/tamanho conferidos. Totalarena12:27casos,4960avancos,4991leituras validas. Proximo decodificar ramos verticais,portar preparacao e controlador de pouso/escape aproveitando10 quando comprovado,completar item aereo e entao integrarID12. MapasSB4 preservados nesta etapa. Sem commit/push.


### Arena12 - ramos verticais e alvo movel

Correcao de enderecos anotados na etapa anterior:LEFT eC04B16,UP eC04A95;DOWN C04A0D eRIGHT C04B91. Bytes da ROM conferidos novamente. UP inicializa velocidade6 eCC=Yinteiro-48,DOWN velocidade3 eCC=Yinteiro+48;CD preserva origeminteira. Capturas LAUNCH-DIRECTIONS ja verificadas reproduzem72posicoes livres (UP26..60,DOWN26..62) comcurva parametrizada existente.

Leitura bruta dos mesmos journals:UP CC6030 na partida26,602F no27 (contador624par),6029 no40;DOWN CC6090/6091/6097. Apos soltura41 os alvos ficam41/151. Modelo vertical em sb2-stage12-flight.ts conserva origem/contador/alvo;altera alvo nos framespares cominputvertical;na descida compara Yinteiro anterior e recentra alvo preservando fracao. Nos dois casos medidos indica pouso61/63. DOWN Yfinal151 confere;UP no61 resolve terreno eescape na mesma passada,final48.25 emvez da projecao de alvo41.25,portanto esse resultado nao e reivindicado como integrado. Pendentes outrasparidades,inversoes e controles mistos antes de generalizar o controlador.

Sete testes de voo12 passaram:3horizontal,2curvavertical,2alvo/pouso. Nenhuma captura nova nem aumento de totais/manifesto;usadas as mesmas evidencias imutaveis. Integracao12 ainda pendente;proximo montar preparo/ativacao e reutilizar escape comprovado10 comreplays principais12,completar trajetoriasdeitens. Sem commit/push.

Typecheck shared aprovado apos o modelo vertical.


### Arena12 - preparo e selecao de partida compostos

Conferidos novamente ROMC20EB5..0ECF e campos brutos+0C/+70/+C6 do journal FLOOR-REGISTERS-160. Script de preparo possui comandos2/2/8/2/2 e terminal1FFF;espera inicial2 e passagem de liberacao explicam19passadas aposentrada7:bloqueado8..25,partida26. Nao interpretar tabelaC5EA3B como ponteiros24bits:ela contem indicesword deanimacao por facing. Tentativa de interpretacao como ponteiro nao foi usada na implementacao.

Novo sb2-stage12-preparation.ts recentra parteinteira preservandofracao,conta preparo e seleciona comando corrente somente na liberacao. Oito capturas imutaveis SPRING-CONTROLS/LAUNCH-DIRECTIONS validamposicao deentrada,18passadas bloqueadas,partida19 eprimeira posicaodovoo composta com componentes existentes. RIGHT/LEFT durantepreparo e soltos antes26 ficamneutros;RIGHT somente26 epartidasLEFT/UP/DOWN escolhemramoscorretos. Estado fazJSON roundtrip entrepassadas.

Quinze testes passaram(8preparo,7voo). Sem novas capturas nemalteracao dos totais4991leituras/4960avancos/27casos;nenhumID12 ouligacaoao step ainda. Proximo compor ciclo completo com gatilhopiso,voo,pouso/escape eefeitos/item,validando em stepemvezde somente componentes. Preservados mapasSB4,semcommit/push.

Typecheck shared aprovado apos componente de preparo12.


### Arena12 - primeiro controlador integrado ao step

ID interno sb2-12 adicionado a Sb2StageId/isSb2Stage/sb2ArenaNumber;layout usa captura12 e trata pisos11/12 como transitaveis. Fora do seletor. Piso11 ainda nao tem gatilho integrado:nao considerar arena12 pronta. stage12-controller conecta amostragem da celula anterior,entrada em12,recentragem,preparo19,vooneutro/horizontal/vertical,alvo,pouso eescape. Reutilizados componentes medidos. Rotina de saida forcada extraida de stage10-controller para sb2-jump-escape.ts e compartilhada com12;mesmas bordas,passo1 e alinhamento ao piso livre.

Harness principal inclui INITIAL-CONTROLS4casos eSPRING-CONTROLS4 maisLAUNCH-DIRECTIONS4. Doze replays/2240avancos no step comJSON entrepassadas. Compara ambosjogadores,posicoes,vida,inventario,grade,itens,bombas,chamas,RNG/history,preparo/voo/escape. Auxiliar Y:horizontal/neutro na origeminteira;vertical deriva1.375/frame alem do deslocamento do alvoCC,primeiraamostra parada. X auxiliar bruto preservado,nao certificado. Primeiraexecucao revelou harness limitado a proxies10;ampliado para12 usando estado do controlador,sem omitir proxies.176/176 replays principais passaram antes da extracao dohelper;na suitecompleta apos extracao tambem176 passaram.

Hashes37baseline verificados:35 protegidosSB4 iguais,apenasarena.ts/stage.ts comuns jaalterados diferem. Typechecks shared/server aprovados. Suitecompleta emandamento;nao declararverde antes de finalizar. Pendentes piso11/ciclodoitem,dano,plantio sobrepisos,outrasentradas/paridades,controlesmistos,multiplayer,visual. Semcommit/push.


Validacao final da integracao inicial12:1652/1652 testes shared em130arquivos,176replays principais incluidos. Depois adicionado teste dos quatrospawns12 ao criador e sb2-step passou33/33;essa ultima adicao e somente teste,semnovaalteracao deproducao. Typechecks shared/client/server aprovados (cliente768MiB). Os12IDs SB2 agora existem internamente,mas todos permanecem parciais eforadoseletor;nao declarar12arenasconcluidas. Totalpesquisa12 continua27casos/4960avancos/4991leituras;subconjuntointegrado12casos/2240avancos. Proximopasso prioritario integrar piso11 eitemexpelido,semperderparidade/cronologia;ampliar interacoesdo piso12 evisual. Semcommit/push.


### Arena12 - tabelas adicionais do item expelido

extract_item_flight_paths.py confere SHA256ROMdcf9cd8615a08c8050fd102702291808cafaffd428013f2dda3164130b7f08fd eextrai seis tabelas cujos ponteiros aparecem nos journals REA/MCP ja confrontados: C5C2B2(9comandos),C5C59C(16),C5C5FE(16),C5C7BC(20),C5CB90(8),C5CBC2(8). Total77comandos e terminadoresFFFF. Bytes preservados emSB2-STAGE12-ITEM-FLIGHT-PATHS-ROM.json;fontegerada sb2-item-flight-paths.ts. Constante antiga C5C7BC reutiliza fonte unica,semduplicar tabela.

Teste sb2-item-flight-paths confronta11casos deCENTER-ENTRY/CENTER-GATE/FLOOR-REGISTERS-160/FLOOR-PARITY:1247observacoes,126segmentos. ConfereXY,VX/VY eponteiro deproximocomando a cadaframe,comserializacaoJSON. Emcadafim de tabela a selecao seguinte ainda efornecida pela captura:teste NAO certifica decisao debater/pousar nemescolha aleatoria inicial. Normalizacao numerica de zero remove apenasdistincaoJS+0/-0 para velocidades nativasde magnitude0.

Leitura manualC093F6:aoFFFF testa codigo no7FC000 na celula atual;18/19/17,bloqueio40 ouchama1 impedem deposicao. Caminholivre escreveglifo+4A em7FA000,codigo44 em7FC000 eencerra auxiliar. Ainda falta reconstruir chamada de reset/selecaodetabela emC0939E/C093D1 e inicializacaoC09231. Nao usar interpretacao preliminar detabelaC5C9B0/facing como controlador:selecao observadaCB90 comfacing2 ainda nao ficouexplicada por essa leitura. Semcodigo inventado para preencher a lacuna.

Doze testes passaram(11novos+1segmentooriginal);typecheck shared aprovado. Nenhuma captura nova,totais ehashes brutos permanecem. Ultima suitecompleta1652 anterior aos novos testes;176replays principais naultima integracao12 continuamreferenciahistorica. Proximo reconstruir escolhadorebate/pouso eespalhamentodoinventario para conectarpiso11 aostep. Semcommit/push.


### Arena12 - selecao autonoma e ciclo de rebate/pouso do Fire

Causa raiz da lacuna anterior:foi lida C12BB9,mas JSLemC093E1 chamaC02BB9. A rotina correta usa tabelaC5CAA0,nao C5C9B0. C093D1 zera velocidades,+48=0 eA=0 chamaC02BB9 para grupo0. Facing2/4 selecionaCB90/CBC2,explicandoosponteirosobservados. InicializacaoC09231 usaC02C59,queconsultaC5C0B6. Historico0400anterior aativacao,mascara1E,selecionaFC6Ddirecao eEE0Fgrupo. Exemplos:word32->grupo5/right/C7BC;31->grupo3/up/C59C;19->grupo1/left/C2B2;24->grupo4/right/C5FE. Essa leitura corrige ainterpretacao preliminar,nao exigealterar ROMnememulador.

Extrator agora preserva28tabelas/369comandos:24inicias(6gruposx4direcoes) e4rebatesgrupo0. Metadados deixamclaro que somente subconjunto foi exercitado;bytesdosseletores/callsites earraysFC6D/EE0F preservados egerados emTS,semduplicacao deconstantes. ROMSHA permaneceverificado.

Novo sb2-scattered-item.ts recebeorigem/historico,selecionatrajetoria,executasegmentos,testa codigo nativo da celula aoFFFF e escolhe grupo0 ao rebater. Pouso bloqueado por17/18/19,flag40 ouchama1;casocontrario encerra. Teste11casos deixa de usarponteiroscapturados para escolhertrajetoria:confere asmesmas1247observacoes/126segmentos eprimeiraamostra deitemnochao. A grade nativa anterior a escrita do proprio item44 efornecida comoinputexterno;essa ainda nao egrade produzida pelostep. Na primeira tentativa,usargradepos-pouso rejeitava oprioitem44;corrigida fronteira deentrada emvez de afrouxar regra deocupacao.

Cobertura limitada aumFire porcaptura;outrosinventarios,multiplosauxiliares,flag8dereorientacao etodasdirecoesderebate continuam pendentes. Ocomponenteaindanao esta ligadopiso11/step;proximo conectargatilho/impacto,clockchama,espalhamento einventario para testarsemgradeoracle.23testesdecomponentes passaram antes da geracaofinaldosseletores;rerunfinal registradoaseguir. Semnovascapturas,semcommit/push.

Rerun final apos seletores gerados:23/23 testes passaram;typecheck shared aprovado.


### Arena12 - piso11 conectado ao step sem grade-oracle

Novo sb2-stage12-floor.ts conecta acionamento da celula anterior,recentragem,impacto nao letal que bloqueiaentrada,primeiro Fire excedente observado,registrodeefeito eitemaereo. updateSb2Stage12Floor roda depois doscontatos amostrados eupdateBombs,antesdoRNG. Item recemcriado nao avanca nessa passada. Clock impar podeacender noframe decriacao;dano vem do contatodo proximo frame. Chama sb2Floor tem relogio proprio eTTLderivado deatualizacoesrestantes,sem desconto genericodebomba. Piso11 fica consumido;codigodeocupacao doitem deriva da grade/bombas/chamas/itens da simulacao e pisos especiais capturados,sem lerfixture duranteexecucao. Itemusa RNGhistoryanterior,fazrebates epousa via componentejaextraido.

Harness principal agrega15casos aos176anteriores:todos27casosatuais12/4960avancos agora integrados. Compara posicoes,vida,inventario,grade,chamas,itensaereosXY/dono/glifo/ponteiro,itensnochao,RNG/history/contador,preparo/voo/escape. ParaFLOOR-REGISTERS-160 ePARITY compara tambemanimacao/intervalo/timer/atividade doregistroREA. Primeirafalhafoi interpretacao doharness:bit0800tambem ocorre em morto;preparo agoraexigeestadoativo,sem removerchecagemdevida.

Extensaoate200frames revelou remocaodocorpo no199 aposmorte11. ROMC20411..04D7 soma186framesdeanimacao,mais espera2=>188;metadadosbytes/duracoes emSB2-STAGE12-DEATH-ANIMATION-ROM.json. Modelo escrevecoordenadas nativas0,240 depois188. Outra falha reveloucongelamento,não chamadasextras deRNG:sample198 contador795 seed11611;199 contador796 masseed/historysemavanco;200contador796congelado. RuntimestoppedNativeCounter preservaessa transicao comapenasumsobrevivente,paraRNGna passada deencerramento epara oloopnas seguintes. Comoutrosjogadores/interacoes deencerramento ainda requerreplay. Morteaposimpacto nao passa pelodropgenerico doBombtop;inventario basal observado mantido.

191/191replaysprincipais passaram. Typechecks shared/server aprovados;suítecompletashared emandamento.37hashesbaselineverificados,35protegidosSB4iguais,somentecomunsarena.ts/stage.ts diferemcomoantes. Contagemdecapturasnaomudou. Pendenteespalharoutrosinventarios evariositens,capturarfogo/bombassobresaltos,pisoscomoutrosjogadores,maisdirecoes/paridades,animacoes/visual evalidacaodoseletor antesdepublicar. Semcommit/push.


Validacao final:piso11 integrado com1690/1690testes shared em132arquivos,incluindo191replaysprincipais (27da12/4960avancos). Typechecks shared/client/server aprovados.35arquivosprotegidosSB4 comhashesinalterados. Os12IDs internos permanecemparciais,foradoseletor. Proximopasso:capturar inventariosvariados no piso11 (velocidade,capacidade,habilidades,variosFire) para reconstruir ordem/quantidade deespalhamento;ensaiar fogo/bombas/ocupacao nosaltos12. Renderizacao/animacao eparidadefuncionalintegral dastodasarenas continuamrequisitosnaocumpridos. Semcommit/push.


### Arena12 - fogo sobre salto: nova lacuna funcional aberta

Reutilizados Snes9x220840/ROM eDLLidentificados,semreiniciar. SPRING-FIRE:quatrocasos200frames,entrycentral6012;A1,UPpor7framescomeçando40/70/100/110,neutralrestante.804leiturasconfrontadasREA/MCP,ev_df98b23736a2ea6b3805b53a4335b10d07ecc86e2ac1d9fe7905983f5bd3dee3,scriptaceb171a-9cc2-4154-b655-df73d8e54614. Bundle310401174bytesexportado,Frida643d6490-332a-4ac8-9259-076cd6c63259fechado. Manifesto637entradas comnovo journal hash/tamanho conferidos. Totalpesquisa12:31casos/5760avancos/5795leituras;subconjuntocompletamenteintegrado continua27casos/4960avancos.

Bombaem7,5 alcance3:em144aindaestatica,maspiso11em7,6jaacende;explosaocomum145. ROMC140B9 criaregistroviaC0468Fparaauxiliaratingindo11. Implementadopre-scan comfuse1 eparadadobraco no piso11ativo,semimpactarexpeliinventariodojogador. Vida:entradas40/100 morremnopouso165;70/110 sobrevivemate200. Preparacao evoo12 protegemfogo;naaterrissagemcontatovolta namesmapassada. Fire2nativo(range3) permaneceaposmorte,semitemaereo deexpulsao. ResolveFlameContacts eexclusaododropgenerico12ajustados. Testeindependente life-only4/4passou,masNAOsubstituivalidacaointegral.

Replaysestritosnovos4/4aindafalham,semignore:gradepad7,4 na146(40/100/110) ou148(70) diverge. Nativoalterna4C/fogo1conformeanimacaodopiso,enquantomodelomantemchamacomum. Entrada40/100restaura4Cem146/148/150/152,depoisficafogoate170;70restaura148/154/156..170;110restaura146..162pares. Entrada70tambematrasoupartidade155esperadapara157nativa;naoajustartimercomconstantepelo nome docaso. Issoapontainteracaoentreanimacaodopiso eefeitodefogo,naoaumaalternanciaglobalsimples. C0486F criaregistrospad em7E3D88,componteirosC5E973/C5E8E1;proximopassoinspecionarecompararesseclock peloREA. Seobservadoratualnaocobrir3D88,acrescentarregiao e repetirbatchmenorantesdecertificarcampos. Nao simular flicker comregraparidadead hoc.

Ultimachecagemmain195:191passam,4novosfalham;typechecksharedpassou. Ultimasuitecompleta1690ehistorica,anterioraessasalteracoes;naodeclarartreecompletamentegreen. Semprocessostestespendentes. Emuladorpreservadoem12/frame6212. Capturas/evidenciaspreservadas,semcommit/push.


### Arena12 - relogio do piso12 resolve os quatro replays de fogo

Inspecao mostrou que observador existenteja inclui3C00..3DFF,oquebasta para primeiroregistro3D88..3D97. Nao foi necessario repetir emulacao. extract_spring_pad_clock.py revalida804leiturasviaREAexigindoregiao3C00 eextrai somenteregistro0;naocertifica16slots. Replay SB2-STAGE12-SPRING-PAD-CLOCK-REPLAY.json preserva campos ebytes. ROMC5E8E1 tem18comandos8bytes,intervalos3/3/3/1x15,codigo4C,pointerterminaFFFF. Metadados emSB2-STAGE12-SPRING-PAD-ROM.json. Componente sb2-spring-pad avancaemfaseimpar,desenhaapenasquandocarregacomando,encerraapos18;quatrotestesconfrontamactive/timer/command ate200.

Causa funcional do flicker:desenhodo pad sobrescrevegradecom4C na passagemimpar;efeito dechamacomum voltareescreverfogo nas pares,enquantoseuefeitocontinuavivo. Novo backing stage12PadFlames preserva expiracao evisibilidadeenquantogradetem4C;duracao26continuaindependente. Nao foi implementadaalternanciaglobalsimples:timer nativo determinaquaispassadas redesenham. Exemploentrada40:desenhos146/148/150/152,clocktermina154;depoisfogo visivelcontinuamenteate170. Entrada70:desenhos148/154/156..170,conforme3/3/3/1.. .

Atrasoda partida:animacaodojogadortermina153 (17passadasapos136),masas duaschamadasfinais do dispatcher exigem piso12disponivel.154vefogoanterior=>espera;155ve4Canterior=>latchpronto;156vefogo=>espera;157ve4C=>salta. advanceSb2Stage12Preparation agoraesperadesenhodepiso nas duaspassadasfinais,conservandotempoanimacaoanterior. Osquatroreplaysstrictpassaramsemignorargrade ouajustarporcaso. Harnesscomparatambemrelogio3D88dentrodo step.

195/195replaysprincipaispassaram duranteasuitecompleta;31da12/5760avancosincluem4novoscomfogo. Typecheckshared inicialmenteapontouownerIdoptionalcomundefined;corrigido contrato paraownerIdobrigatoriofornecidopelobombario. Shared/servertypesaprovados.35hashesprotegidosSB4iguaisde37baseline,apenascomunsarena.ts/stage.tsdiferemcomoantes. Suítecompletaemexecucao,aguardarresultadoantesdechamarverde. Semnovascapturasnemalteracaodomanifesto637. Semcommit/push.

Suíte completa final:1702/1702testes em134arquivos;195/195replaysprincipais. Shared/servertypesaprovados;cliente emchecagemfinal. Nenhumreplayestritofalhandoaposcorrecao do clock. Proximo ampliarinventariosdo piso11 eoutroscontatos/animacoes antesdaintegraçãovisual.

Typecheck cliente aprovado tambem;shared/client/server verdes. Semcommit/push.


### Arena12 - inventario Bomb+Fire e quantidade aleatoria de expulsao

Preparacao semWRAMpatch:entrycentral6012 LEFT26/UP13/DOWN13/RIGHT26 coletaBombvisivelem5,4. Posicoesaposcomandos95.5,112 /96.75,96.75 /96.75,112 /128.25,112. Inventariofinalspeed1,capacity2,fire2. Entry.state/metadadospreservados emstage12-inventory-pair,frame6090. Quatrocasos200frames comDOWNpor9aposdelay0/1/2/30.809leiturasconfrontadas(5preparacao+804replays),ev_01945a78d745e389c6604919b644702d20f18d697e4923b0d8c72f130f4be573,scripta2465909-ef2f-4b11-b52b-29d34970a12e. Bundle324498197bytesexportado,Frida11f4c6eb-d620-4ff5-8d9d-342467b42790fechado. Manifesto640entradas,3arquivosnovos hash/tamanho conferidos.

ROMC09155 usa0404&0F parainicio econtagemC5EDFF;C08F02 usaC5EDDD parabuscarhandler,incrementandoindicequandoitemnaodisponivel,semavancarindiceapossucesso. Selecaodecadaitemaereousahistory0400+2*indice. Tabelas/bytes/callsitesemSB2-STAGE12-INVENTORY-SCATTER-ROM.json. Novo sb2-scatter-inventory implementa ramosBomb/Fire;outrosramosnativosNAOimplementadosainda. Quantidades1/2/3 eordemdebusca vemdatabela,naodepadraofixodeFire.

Delay0/1/2 temhistory0404=41,indice9=>quantidade1;busca encontraBomb,capacity2->1,Firepermanece2. Delay30 tem0404=162,indice2=>quantidade2;expulsaFire eBombnessaordem,ambosatributosvoltam1. Trajetoriasusamwords0400/0402separados. Modeloagoramantemdoisauxiliares simultaneos,pousoocupadoporoutroitemcausarebate,semconsultarfixture. Harnesscomparaglifosdeambosostiposalemdemultiplicidade eponteiros.

PrimeirafalhaesperadadoharnessmostrouantigaregraFirefixa. Aposselecao,duasfalhasnocorpo199:originalconservafracX.25aoretirarcorpo,modelozerava. CorrigidaescritadaspartesinteirasdeX/Ypreservandofracoes. Quatrocasosnovospassaram e199/199replaysprincipaispassaram duranteasuitecompleta. Shared/servertypesaprovados;aguardarresultadocompleto antesdeafirmargreen.35casos12/6560avancos/6604leiturasdepesquisa;78framesdepreparacaoem4comandosnaocontadoscomopassosunitarios. Emuladorpreservadoframe6290. ProximocapturarSpeed,Glove,Kick,FullFire/Skull evariositensparaextenderhandlersC08F02. Arte/animacaointegrada eoutrosrequisitosdas12arenascontinuampendentes. Semcommit/push.

Validacao final:1707/1707testes shared em134arquivos;199/199replaysprincipais;typechecks shared/client/server aprovados.35hashesprotegidosSB4mantidos. Semcommit/push.


### Arena12 - Speed e tres auxiliares; nova transicao pos-morte pendente

INVENTORY-EXPANSION preparouinventario[Speed2,cap3,Fire4] semWRAMpatch. Diario preserva primeira rota que morreu por esperarX79.75 no alcancedabombaX32(range3);recarregadopair-entry e repetidarota com esperaX112.25. Comandossegurosabriramblocos em128/160/192/224/64/32 na linhaY112,e96/160emY96.75;coletadosFireem1,6 e5,3 eSpeedem9,3. Posicaofinal160,80.25,frame8956;entry-fire preservado. Neutral emblocos16 selecionouhistory0404=12(frame9100,entry-speed) e7(frame9164,entry-triple),semalterarsemente. TrescasosLEFT1..12,neutralate200. Todosload/save viaMCPreal.89leituraspreparacao+603replays=692REA/MCP,ev_4afd6147a13b1a006f6808ca512df75466c8b251284631866d01783a13a06836,script442811e1-180e-4e84-983e-ec110a27dd6a. Bundle336593564bytesexportado,Frida8bdc9359-2104-424e-9587-31b239bc6359fechado. Manifesto649entradas,9novosarquivosjornal/entries/metadadoscomhash/tamanho conferidos.

Impactonopiso8,3ocorre7. Rich-fireexpulsaumFire,mantemSpeed2cap3;rich-speedexpulsaSpeed/Bomb,mantemFire4ecap2;rich-tripleexpulsaSpeed/Bomb/Bomb,mantemFire4cap1. AdicionadoramoSpeedC08F5B usandoindicesSB2_ITEM_SPEEDS,semdecrementolinearinventado. C08F02outrosramoscontinuampendentes. Tresauxiliarescomwordshistory0/1/2saoexecutados,namesmaordemdoslots8400/8500/8600.

NovafalhaY:em34trajetoriaverticalterminaY19,masonativo reinicia227. Nao ewrapemcadaframe:amostras28..33temY23/21/19/18/17/17. ROMC12F6C/C13076 fazbusca defundoem passos16,mascara1FF,aposrebate;contextofundonativo permiteY32..239. Implementadoreposicionamentoterminalvertical,semalterarcurvadovoo. Aposissoos3replayscomparamposicoes,vida,inventario,itens,auxiliares,ponteiros,RNG/history/contadorate198 (594avancos),semgradedo fixture durantesimulacao.

Ainda3falhasestritasna199:corposeesconde197,contadorpara197/198,mas199voltaaavancarestado/RNGedistribuiritensnochao. Rich-fire195phase3736seed28225;196phase3737seed11843;197phase3738seed11843;198phase3738seed11843;199phase3738seed30025/stateA803;200phase3739seed57179/stateA803. Portanto stoppedNativeCounterindefinido sofoi validado najanelaanteriorate200comretirada199,naotransicaocompleta. Naoaplicarregra2framesinventadaparafazerpassar:precisadecifrarrotina/scene seguinte. BuscaROMOR A800 encontrouC01BEA/C01C40/C01C83/C01CD4;C01BB6chamaC01A38e reinicializaflags/posicoes. Pode sertransicaodefase/rodada,aindanaoconfirmada. DetalhesWRAM/callsitesemSB2-STAGE12-INVENTORY-EXPANSION-OBSERVATIONS.json.

Atualvalidacao202replays:199passam,3novosfalhamaposamostra198;sharedtypecheckpassou. Ultimasuitecompleta1707ehistorica,naogreenatual. Naoocultarfalhasnemcortarfixture. Pesquisa12agora38casos/7160avancos/7296leituras;maincompleto35casos/6560avancos,mais594avancosprefixo dos3novos. Emuladorpreservado9364,clientes intactos,semtestespendentes. ProximoinspecionarC01BB6/C01A38 eestadoB9/00natransicao,portarsemreduziroobjetivo;depoisGlove/Kick/FullFire/Skull,demaisinteracoes earte. Semcommit/push.


### Arena12 - devolucao pos-morte identificada e integrada

NaoeraC01BB6/trocaderodada:marcaA8vemC0A1DC(OR2000,ANDEFFF)paraobjeto persistente fora datela. C0A7F7aoFFFFdeanimacaomarcaflag60bit0800,retirainteirosXYe chamaC097A0emBattle. C09712constroi tabela128posicoes;C097A0enfileirainventariorestante semalterarestats;C09614/C0963Econsomeumaentradaporpassada ecolocaitemviahistorico0400&FE. IssoexplicaRNGretomarsemchamadasaleatoriasextras;apenasoavancehabitualfinaldagameloop. Fontes/bytesemSB2-STAGE12-ITEM-RETURN-ROM.json. Interpretacoesanterioresdeparadapermanente/novarodadanaoforamconfirmadas eforamsubstituidasporrotina concreta.

Novoobservador rea-stage12-item-return.js adiciona3A00 e1E000,conservando3C00;coverageincluifila3B48..3C47 etabela7FE000. ITEM-RETURN:mesmastresentriesricas,LEFT1..12 e230frames.693leiturasREA/MCPsemtruncamento,ev_9e812e69e0b7da49a5d1663111090fc0e18b6f7e43adc350871095b604ab40a8,script5f17093f-3d99-4267-801b-baaec5dfdc6b,sourceSHA352474d9007c918b8fb83236daf7774a9dcb35e0b2d4c2e1b1570954eb0e7fa2. Bundle350188789bytesexportado,sessaoc0c025a7-9d60-46d5-9b80-69729f3ed132fechada. extract_item_return.py exigeregiao3A00/3C00/1E000 antesdeextrairegistros;replaynormal etabelaspreservados. Manifesto650entradas,novojournalhash/tamanhoconferidos.

Censo:percorre0204..07FE,rejeita17/18/19/44/1 eflagsC0,repeteordemespacialate128palavras. Nas3gradesha51/50/49posicoes elegiveis;as128palavrascoincidemexatamente. Filas remanescentes:Firecase[0,0,2,2,4],Speedcase[0,2,2,2],Triplecase[2,2,2]. Seletores0Bomb,2Fire,4Speed;FFFEconsumido,FFFFterminador. Cursoravancamesmo sedestinoficarocupado;naomutateatributos. sb2-item-return.ts reproduzcenso/fila/escolha,conectadoaposretirada/pausa. RegraobservadadeduaspassadasPALsuspensas docenso foiisoladaemresumeNativeFrame;naoreivindicaduracaouniversalemoutrasgrades. Counteroffsetajustadopararetomarnomesmocontadorantesdeincrementarpassadaseguinte.

Harnessrestaurapisos11jaconsumidosnopontoinicialdecapturasintermediarias,identificadosporcodigo0nagradeinicial ondeoriginaltem11;naoconsultafixtureduranteexecucao. Issoincluicentrop7,6consumidonasbombasdepreparacaoenecessarioparacensocorreto. Registroinativo/relogio16/3/3usadoscomocontextopreexistente,semreaplicarimpactoanojogadorvivo. Novoscasoscomparam128celulas efilaemcadapassadade199..230,alemdosdemaiscamposestritos.

Tresreplaysricos200agorapassam,e3novosestendidos230tambem.205replaysprincipaisincluidosnasuitecompletaemexecucao;sharedtypecheckpassou. Pesquisa12:41casos/7850avancos/7989leituras. Preservadoslimites:Glove/Kick/FullFire/Skull eoutrasduracoesdecenso,quatrojogadores,outrasinteracoes/arteaindapendentes. Emuladorreturn-tripleframe9394preservado. Semcommit/push.

Validacao final:1713/1713shared em134arquivos;205/205replaysprincipais. Shared/client/servertypesaprovados.35hashesprotegidosSB4inalterados. NenhumprocessodetesteouFridapendente. Proximoampliartiposdeitem,duracoesdocensoemoutrasgrades,contatos/multiplayer eintegracaovisual. Semcommit/push.


### Arena12 - Kick coletado,expelido e devolvido

Reutilizado entry-speed de inventory-expansion(9100). Somentecontroles: A1/DOWN22/LEFT64/neutral200/RIGHT85/UP22 abreup9,2 eright11,3,coletaSpeedextra eBomb11,4,deixando192,80.25,[speed3,cap4,fire4]. DOWN8/A1/DOWN8/LEFT64/neutral200/RIGHT64/UP24 abre11,2 ecoletaKick,frame9863. DOWN24/LEFT48/UP16 deixa96,80.25ao lado dopiso11intacto6,3,frame9951. Nativehistory0404=48 permiteKickretido. Neutralemblocos16 selecionacursor4(frame10351) paraexpulsaoKicke7(frame10703)paratresitens. Entries/metadadospreservados. KICK-INVENTORY:trescasosRIGHT1..12,neutralate230,757leituras(64preparacao+693replays),690avancosunitarios.

REAev_c028597228c755029f39022aa51fbcf4317bef4689753aa97ac581b4801da7ee,scripte001b9f0-14bb-408b-86b4-7bf4ecae056b,observadoritem-return. Bundle365009992bytesexportado,sessao7962ba3b-9248-42c0-9aa6-42a3998a4ec8fechada. Comparacao,replayclassificado efila/censo extraidos exigindoregioes3A00/3C00/1E000. extrator de retornoagoraignoraentry-before semomitirvalidacaoREA dessasleituras. Manifesto659entradascom9novosarquivoshash/tamanho conferidos. Pesquisa12:44casos/8540avancos/8746leituras.

C09058 consomeFF(Kick) eproduzglifo1624;handler5 adicionado aoalgoritmoC08F02. C5FF7Dindice8 devolveKickaposBomb/Fire/Speed;builderfilaeconsumidordestinoagoraincluem8. EstadosqueconservamcanKickcontinuamcomFF1aposmorte,eitemKicksurgeemdestinoescolhidopelohistoricosemalteraratributodocorpo. TirarKicknoproprioimpactomudaaordem:cursor4pulaGloveausente,consomeKick eSpeed,emvezdeconsumirdoisSpeed. Primerachecagem4atributos/itensaereosidentificouesseramofaltante;naotrocadaexpectativa.

Tresnovosreplaysstrictpassaramate230,comcenso128efilaemcadapassada,alemdosdemaiscampos. Typechecksharedpassou;regressaocompleta208mainemexecucao. Nenhumaafirmacaodechutebomba12validado:soinventario,expulsaoretorno. Glove/FullFire/Skull,interacoesdehabilidades,quatrojogadores easpectovisualde12eoutrasarenascontinuampendentes. Proximaetapadeveincluirauditoriaderenderizacaodos12IDs ereutilizacaodeassetsexistentesparaavancartambemvisual,semabandonarrequisitosfuncionais. Semcommit/push.

Validacao final208/208mainreplaysaprovados;sharedtypecheckverde;35hashesprotegidosSB4inalterados. Ultimasuitecompleta1713anterioraos3casosKick;naoreexecutadapormudancalimitadaaessesramos,semalegacaodesuitecompletaatual. Semcommit/push.
# Integracao visual dos itens aereos — 2026-11-04

O cliente apresenta `stage12AirItems` com o atlas existente de itens, usando as
coordenadas nativas sem adicionar outro arco. Itens em voo passam sobre os
obstaculos; itens no chao mantem o filtro anterior. A animacao do brilho nao
depende das coordenadas fracionarias em movimento.

Validacao direcionada: 41/41 testes (15 de apresentacao, 19 de efeitos SB4 e 7
de tiles). Previa em `apps/client/test/visual/sb2-air-item-preview.html`, com
fixture derivada dos casos nativos `kick-triple` e `kick-eject`, indice 12.
A captura headless parou na inicializacao grafica; a segunda tentativa com
renderizacao por software foi rejeitada pela revisao automatica. Conferencia
visual continua pendente; a imagem produzida nao comprova o resultado.



## Arena12: investigacao de habilidades, 2026-11-04

31 leituras nativas entre9951 e11756 confrontadas integralmente entre REA e MCP, sem divergencias. Observador somente leitura encerrado apos exportar SB2-REA-STAGE12-ABILITY-SURVEY.json. Journal e estado final em output/sb2-research/stage12-ability-survey/.

A rota abriu blocos, coletou Bomb e nao obteve Glove. No fim, a grade ja mostrava fechamento nas bordas; nao reutilizar este save tardio para novas rotas longas. O contador de replays funcionais permanece208: este ensaio nao certifica descarte de Glove.

Novo extrator extract_scatter_abilities.py confere hash e bytes de quatro ramos simples da ROM. Glove: C0903E decrementa FE quando positivo e emite1626; retorno usa seletor7, atributoFE e glifo1626. Kick permanece o ramo dinamicamente validado. Glifos1608/1620 permanecem sem nome funcional. Nenhum ramo novo foi habilitado no runtime sem captura correspondente.

Proximo passo: obter Glove num save nativo anterior ao fechamento, capturar retencao/descarte/retorno e integrar os casos no replay principal.


## Arena12: luva descartada, retida e devolvida — 2026-11-05

A rodada seguinte produziu Glove nos slots15/17/23, permitindo coleta por comandos nativos. Preparacao V2:77 leituras REA/MCP iguais; save glove-entry.state no frame12160, P1(128,112), Speed1/Bomb2/Fire4/Glove1. A captura anterior interrompida pelo limite do executor foi preservada como parcial e excluida dos totais. O journal da preparacao foi separado novamente e contem somente suas77leituras.

Dois casos completos de230passadas: glove-eject e glove-retain.472leituras comparadas sem divergencias, incluindo10sondagens de fase. REA ev_4218cc82005b00f1e4e2eb43c05a0670c8bb24c792cdb9bdc1b2f4a6a403db2a, script0393e2aa-5d22-4c7d-9e41-c8860b34cb02, sessao encerrada.

Implementado C0903E: atributo Glove removido ao selecionar handler4; sprite1626 segue as trajetorias ja extraidas. Na retencao, fila de retorno inclui seletor7 e devolve Glove sem alterar atributo do morto. Replays confrontam inventario, itens aereos, grade, RNG, fila128palavras e censo128palavras.210/210replays principais passaram; shared typecheck passou;35hashes protegidos SB4 iguais. Isso nao certifica levantar/arremessar bombas com a luva.

Captura incremental via NDJSON elimina a regravacao integral por quadro; chamadas longas devem usar timeout explicito ou lotes curtos. Worker atual PID52388; MCP via clientG, transporte trG; nao ha sessao Frida aberta. Proximo trabalho deve atacar habilidades restantes e integracao visual ainda pendentes, sem repetir a escavacao: usar glove-entry.state ou glove-retain.state.


## Arena12: controles de levantamento/arremesso — 2026-11-05

Quatro casos4x160passadas e644leituras REA/MCP sem divergencias. Bundle SB2-REA-STAGE12-GLOVE-CONTROLS.json, evidencia ev_381377e7f946df705464037ba1dc3699edf7fbc16b463605f1907174527feeea, script3d557008-4b49-4f3f-8e1e-7c8b5364fb5b. Sessao1cd71afe-b98a-462c-ba5c-a13489641043 encerrada. Extrator extract_glove_controls.py exige cobertura4x160 e compara novamente bytes REA antes de emitir replay.

Manter A1..80 nao levanta; registro12000 fica8000 e passaC000 em143. Usar B3..40 depois de plantar tambem nao levanta. Novo A3 apos soltar no2 muda registro para9000. Soltar em41 cria proxy842B; proxima passagem9423; aterrissagem54 em(4,5), vindo de(7,5). Caso soltar A com RIGHT em21 cria842A na posicao129,96, aterrissa34 em(10,5). Portanto estes dois arremessos horizontais percorrem3casas e13atualizacoes aposcriacao. Coordenadas incluem elevacao: nao acrescentar segundo arco. Nao confundir registro9000 com bomba de chao, nem proxy842A/B com salto de jogador ou item sem vinculo; link2000 aponta registro12000.

Nenhuma nova paridade no runtime declarada:210casos principais continuam como ultima validacao; estes4ensaios ainda exigem modelagem de transporte/fusivel/voo e integracao no replay principal. Proximo passo: extrair ponteiro/tabela do proxy e confronto do fusivel antes/durante/depois do levantamento, incluindo duracao completa apos pouso. MCP clientG permanece disponivel no worker52388; sem Frida aberta.


## Luva: tabelas horizontais e reaproveitamento do interpretador — 2026-11-05

Extrator extract_glove_paths.py confere a ROM e usa o ponteiro43..45 do primeiro proxy capturado, sem inventar tabela. EsquerdaC5CF04 e direitaC5CEB4 tem12comandos6bytes, seguidosFFFF. sb2-glove-flight.test.ts confronta cada coordenada e ponteiro de ambos os proxies, incluindo a celula estatica no primeiro pouso.2/2testes passaram usando diretamente start/advanceSb2ItemFlightSegment, componente ja existente no runtime dos itens. Nao foram adicionadas constantes aproximadas para o arco.

O contador principal permanece210: os2testes novos validam o interpretador, ainda nao a integracao da bomba carregada no step. Proximo passo: estado serializavel do arremesso associado a bomba; conservar autoria/fusivel e atualizar posicao ao pousar. O registro estatico9000 fica estavel enquanto carregado, mas o campo04..05 volta a mudar durante o voo; nao assumir pausa de fusivel em voo por analogia aoSB4. Capturar ciclo completo e decodificar esse campo antes de alterar a regra comum.


## Luva horizontal integrada ao step — 2026-11-05

Bomb.sb2Throw serializa direcao,autor do arremesso,frame de nascimento e segmento nativo. air.ts cria o voo ao soltar A, posiciona o proxy inteiro apos movimento no frame inicial e avanca as tabelas12comandos nos seguintes. Pouso livre ocorre na celula nativa. Animacao de soltura bloqueia movimento ate carregar o ultimo comando; a captura RIGHT mostra129.25 em21..33 e retoma em34. Sem essa trava o replay falhava em22.

Fusivel retoma contagem durante voo horizontal nativo apos nascimento, preservando pausa enquanto carregado; a verificacao do ciclo completo ate explosao continua pendente, pois os ensaios terminam em160. Vertical e pousos ocupados continuam no comportamento comum anterior e nao foram certificados como nativos. Nao chamar a luva completa.

Extrator principal classifica auxiliares ligados a registro9000 como thrown_bombs, separando correia/chute; confronto do step verifica todas as posicoes. Entradas do teste passam hold e distinguem borda de A nos4casos de controle. Bombas carregadas/em voo nao aparecem na lista de bombas do chao.214/214replays principais +2trajetorias passaram;44regressoes comuns bombas/luva passaram;15testes cliente bomb-motion passaram;tipos shared/client passaram.35hashes protegidos SB4 iguais.

Cliente usa coordenadas nativas da bomba e nao acrescenta outro arco. Conferencia visual renderizada permanece pendente; teste de posicao nao certifica arte/sombras. Sem commit/push. Proximo passo: capturar fusivel completo e arremessos verticais/obstaculos antes de ampliar suporte; saves glove-entry e glove-retain continuam disponiveis.


## Luva: ciclo completo do fusivel e limite de levantamento — 2026-11-05

Oito novos casos,1990passadas e1998leituras REA/MCP iguais, sem truncamento. Tres lotes: LIFECYCLES(3x250/753reads,ev_64f03cd08f230c06747ce1d77fb02500d8cac3cce2d78abc14abcd1cfe7f161f); FUSE-BOUNDARY(3x200/603reads,ev_58c1fa199a9bfa02821a5b68316b73469d803ec507ded486bf168ab46d203df3); FUSE-BOUNDARY-FULL(2x320/642reads,ev_b879e74348ae5c7fea23fbc4396e680c7174c6c7a816b2de5a9bb05c17d8af03). Todos os bundles exportados e sessoes fechadas.

Falhas reais corrigidas: contagem reinicia no frame da soltura, nao no seguinte; C02F6E recusa levantar se byte04<04; entradas136/137 aceitas,138/140 recusadas. Soltura antecipada espera16frames do levantamento:136 dispara152;137 dispara153. Estado sb2LiftReadyAt serializa o preparo e bloqueia controles durante ele.

Com fusivel curto, o temporizador9000 para em01 durante voo, impedindo explosao no ar. No pouso,C10757 aplica minimo38 ao temporizador restante. Modelo usa equivalente113+(contador&1) antes da passada estatica, conferido em ambos os lados da paridade ate explosao e fim das chamas. Metadados e bytes em SB2-STAGE12-GLOVE-FUSE-ROM.json. Bombas retidas por40/80frames explodem nos samples183/223, respectivamente; ensaio original sem levantar explode145.

222/222replays principais +2trajetorias +44regressoes comuns=268testes passaram;tipos shared passaram;35hashes SB4 protegidos iguais. A certificacao continua limitada a arremessos horizontais com pouso livre. Vertical,obstaculos,outros jogadores e bordas ainda pendentes;nao marcar objetivo completo. Sem commit/push. Worker52388/clientG permanece ativo,sem Frida aberta.


## Luva vertical, quiques e borda superior integrados — 2026-11-05

Dois casos2x240passadas/482leituras REA-MCP iguais. Bundle SB2-REA-STAGE12-GLOVE-VERTICAL.json, evidencia ev_84c81ea3364a1d4777a8aa647da5da11966ce555d136657dcb669f20e588b51d, scriptf0e1a467-a23e-473e-89ad-d060a79c6019; sessao encerrada. UP/DOWN apenas no frame21 apos levantar3..20.

ROM: UP C5CFCE16comandos,DOWN C5CF5419comandos. UP quica em38/48/58/68/78/88; no68 sai de18 para226 ao procurar faixa valida do fundo em passos16. Pousa98 em(7,9). DOWN rejeita pad7,8,quica41 usandoC5CBF4 e pousa51 em(7,9). Segmentos de quique e busca de faixa coincidem com os ja implementados para itens. Reutilizado advanceSb2ScatteredItem com tabela inicial opcional; sem segundo algoritmo de quique.

Bomb.sb2Throw agora preserva Facing e path; renderizacao existente acompanha coordenadas em todas as direcoes. Ocupacao da arena12 e compartilhada por sb2Stage12NativeCode. Trava de soltura12passadas independe do comprimento vertical16/19. Replay principal agora compara tambem ponteiro43..45, alem de cada coordenada, posicao de jogador, pouso,grade,itens,RNG e explosao.

224/224replays principais +2trajetorias +44regressoes=270testes shared passaram;15testes cliente passaram;tipos shared/client passaram;35hashes SB4 protegidos iguais. Nao certifica impactos em outros jogadores,bombas/itens nos destinos,arremessos horizontais nas bordas ou todas as interacoes durante transporte. Conferencia visual renderizada ainda pendente. Sem commit/push. Worker52388/clientG ativo,nenhuma Frida aberta.


## Luva: jogador,bomba ocupante,caveira queimada e cadeia — 2026-11-05

Lote tardio CONTACTS:488leituras REA/MCP iguais,ev_86f24188164cce64132f78ad58d80797198b3d14b9d703f683e5d17f91001ac0. Revelou fechamento nativo noframe12719,por isso foi preservado como evidencia mista,sem declarar paridade completa. Preparacao refeita com comandos de P1/P2 em paralelo a partir de glove-revealed.state:entrada12366,P1(128,112),P2(175.25,112.25). Novo lote EARLY:2x240passadas,483leituras iguais,ev_82017bcfac705fda78052c2a7a6d80c274b8d91a478570926600ba029a151112. Sessoes exportadas e fechadas.

Jogador atingido no34 recebe flag0081 ate61,libera62:stun28passadas PAL e quique para casa11,5. Bomba ocupante rejeita pouso,mas nao aplica stun ao jogador sobre ela. Replay agora compara tambem stun positivo/negativo.

Caveira queimando ejetada em161(player) ou147(bomb). C0EE71:centroY-14,grupo3das trajetorias,direcao a partir de historico indexado por5C12incrementado2mod1E. Cursor inicial0passa2. Reutilizadas tabelas da luva e interpretador de itens para todos os segmentos. Extrator corrigido:tipo0200+glifo+autor temprecedencia sobre+40residual de slot reciclado; antigo CLASSIFIED e V2retidos,EARLY usa classificacao corrigida. Nao confundir caveira com bomba movel.

Causa raiz do desvio de cadeia:freezeBombFuses ao morrerP2 impedia bombaP1 de terminar. Arena12 agora continua fusivel como observado. C0E0AA interrompe varredura quando uma entrada arma; chamas de entradas posteriores atrasam2frames,assim como fusiveis posteriores ja faziam. Bomb.sb2Slot e Flame.sb2BombSlot preservam essa origem/ocupacao. Na cadeia12,braco encontra chama existente e nao estende alcance. C0DCDA de itens comuns reaproveitado da arena9; metadados fonte em GLOVE-CONTACTS-ROM.json.

226/226replays principais +2trajetorias +44regressoes comuns=272testes passaram. Tipos shared/client passaram.35hashes SB4 protegidos iguais. Fechamento nativo ainda pendente;capturas tardias devem ser retomadas para esse requisito,nao descartadas. Outras ocupacoes,escudo de bomba carregada e interacoes de transporte ainda pendentes. Sem commit/push. Worker52388/clientG ativo;sem sessao Frida aberta.


## Relogio e primeiro trecho do fechamento nativo integrados — 2026-11-05

Duas capturas de600passadas,1202leituras REA/MCP iguais. NEUTRAL ev_7549b623185f511db22339cd5f0170ca062948f687c935ae447008a5bf0d7d7f; CLOCK ev_787e70e42883ddc833c87ff0980df6ac8de9e9dca9b494e10231c7b94fd16db2. Observador ampliado rea-closure-clock.js inclui5E00 e10B00;este ultimo candidato ficouzerado,nao e o relogio ativo. Relogio ativo em5E10minutos,5E12segundos,5E14contador. FonteC11C1C conta00..40inclusive:65quadros por segundo exibido,nao60. C0D83E habilita fechamento em0:33.

C0D5BB usa clock3,quatro desenhos C5E25A e terminador:15passadas por casa. OrdemC5E1C9 extraida integralmente da ROM,com FE apos80posicoes e FF final. A captura valida23posicoes:primeira linha inteira,incluindo paredes,mais coluna direita. PrimeiroC1 noframe12719;P2morre13049 e relogio/fechamento param. C1 e bloco solido,nao fogo:flagsC0 devemser preservadas ao interpretar tipo1. Imagem nativa confirma blocos azuis.

Novo sb2-battle-clock.ts ligado ao step SB2,estado serializavel e removendo bombas/itens/chamas da casa fechada. matchResult e HUD consultam o relogio nativo;opcao explicita null preserva tempo infinito. Motor de pressao SB4 permanece separado. createMatch SB2 usa2minutos quando nao especificado;opcoes explicitas mantidas.

Main replay closure-clock compara todos os registradores,grade,vida,inventario,RNG e clock por600passadas,com JSONroundtrip. Os2replays CONTACTS tardios agora passam completos,tambem confrontando relogio/fechamento.229/229replays principais +2trajetorias +44regressoes +43morte-subita/tempo/SB4 +1infinito=319testes shared passaram;20cliente passaram;tipos shared/client passaram;35hashes protegidos SB4 iguais.

Nao certificar fechamento completo:aneis internos,marcadorFE,extensao,outras arenas e interacoes com jogadores em movimento ainda requerem execucao nativa. Tabelas restantes sao evidencia estatica. Sons e animacao visual de queda ainda pendentes. Worker52388/clientG ativo,sem Frida aberta. Sem commit/push.


## Fechamento padrao:80casas e paradaFE validados — 2026-11-05

P1/P2 mantidos no interior a partir do save CONTACTS-EARLY;300quadros neutros levaram ao12666. Captura continua em3lotes A600,B600,C300,1500passadas e1503leituras REA/MCP iguais,sem truncamento. Evidencias A ev_187854d9c985432ae61a4587959435b2bc52aae907a806217d8fd80347d408ce; B ev_8b069f126ff0c8d80092e262ed6533ee4c2cdf59cb03d5ca98e1d2e3cfb8ea20; C ev_e452f02decdc94984e87733ff007ec81c1aa51b8faf85742a518c07ec2354389. Sessoes exportadas/encerradas.

RINGS-CONTINUITY.json comprova igualdade dos131072bytes de WRAM nas fronteirasAB/BC,80mudancas paraC1,intervalos15 e ambos humanos vivos durante todos os trechos. MarcadorFE para a configuracao nativa1C68=0;frame13919 terminaindex81/flags7. Corrigida ordem da flagativa4: deve ser escrita antes de lerFE/FF,portanto fica preservada na parada. Flag3anterior falhou no confronto do registrador.

Tres replays novos integramo step com grade,relogio,flags,timer,indice,animacao,celula,RNG,vida e itens comparados em cada passada. A parada nao congela o relogio: fim doC em0:11/contador19. Isto certifica os dois primeiros aneis e FE da configuracao padrao;extensao interna1C68!=0 ainda e somente extraida da ROM e requerexecucao.

Validacao ampla realizada apos esta ampliacao:node heap384/semi8,vitest run maxWorkers1/minWorkers1/poolthreads em packages/shared.1743/1743testes,136/136arquivos passaram(89.73s),incluindo232replays principais. Shared typecheck passou;35hashes protegidos SB4 iguais. Ultimos20testes focados cliente continuamcomo ultimo resultado;nao foi refeita suite completa cliente nem certificada arte de queda.

Proximo passo:tempo restante ate0:00 e empate,ou acesso nativo a opcao de extensao interna,antes de certificar fechamento completo nas12arenas. Estado atual terminaem14166(com ambos vivos),MCPclientG/worker52388;Frida encerrada. Sem commit/push.


## Ponto de retomada — 06/11/2026 (Claude Code): arenas entregues no seletor

Decisão do usuário: priorizar entrega. As 12 arenas passam a ser jogáveis no seletor usando as
grades, spawns e mecânicas já extraídas e validadas acima. A validação visual nova é por
comportamento e comparação lado a lado com as capturas nativas do Snes9x, não por paridade de
RAM quadro a quadro. Nada de commit/push.

- Evidências pesadas movidas (nada apagado): 106 JSONs não usados por testes (12,1 GB) e
  `output/sb2-research` (20 GB) agora em `E:/Projetos/bombtop-src/sb2-evidence/`
  (`moved-docs.txt` lista os arquivos; `output-sb2-research/` mantém saves como `glove-entry.state`).
  Os JSONs que os testes leem continuam em `docs/`.
- Shared: `SB2_STAGES` em `SELECTABLE_STAGES`; `stageMaxPlayers` (4 nas SB2). `BattleSession.nextStage`
  pula arenas SB2 com 5 jogadores; se nenhuma da rotação comporta, usa `sb4-01`
  (`test/room/sb2-map-cycle.test.ts`, inclui delta de snapshots das 12).
- Bots: `sb2ChannelDanger` em `bot.ts` (arena 4: fogo que chega a uma casa da canaleta queima o anel
  inteiro). Antes os 4 bots morriam juntos no tick 716 em toda seed (`test/bot-sb2.test.ts`).
  Smoke de 36 partidas (4 bots × 3 seeds × 12 arenas, `.agent/sb2-smoke.ts`): sem exceções.
- Cliente: atlas SB4 reaproveitado por tema (`SB2_TILE_ATLAS` em `render/stage-art.ts`); pisos SB2 em
  `public/sprites/sb2-floors.png` (`scripts/build-sb2-floors.py`), posicionados por
  `render/sb2-floor-decals.ts` a partir de `SB2_STAGE_CAPTURES[n].background` + estado
  (números dos painéis da 7, sentido da esteira da 8, alçapões usados da 12); `render/sb2-floor-art.ts`
  no renderer; miniaturas em `ui/stage-preview.ts`. Nomes em `ui/stage-names.ts`, guia em `ui/map-guide.ts`,
  preset "12 arenas SB2" no painel de fases.
- Verificação visual: `/mapas` com as 12 arenas rodando com bots, comparadas com
  `arenas-settled/arena-01..10.png` e `hidden-initial/arena-11/12.png`: blocos, pilares, spawns e pisos
  especiais nas mesmas casas; painéis da arena 7 mostrando 4/3 como no original.
- Suítes: shared 1761 testes (todos passam após atualizar 3 asserções que diziam "SB2 fora do seletor"),
  server 50/50, cliente 1313/1314 (falha `naruto-recolor` é pré-existente: regiões dos olhos desatualizadas,
  arquivos não tocados). Typecheck ok.

Pendências conhecidas (não inventadas, do próprio código/relatório):
- Arena 12: alçapão (piso 11) prende o jogador e acende fogo; o código diz "impacto não letal" mas na
  prática mata. Confirmar no emulador.
- Arena 7: `p.speed` reescrito todo tick pelo painel; itens de velocidade/caveira rápida/lenta parecem
  sem efeito. Confirmar no emulador.
- Arena 2: `stage2TransportPhase` nunca é escrito (fica 0). Arena 3: checagem de túnel ocupado usa a
  coluna 3 também para a 11.
- Arte: primeira versão procedural; animações (canaleta acesa, mola, transporte do gelo) ainda usam só
  as chamas/movimento do sim. Bots não conhecem pisos especiais além da canaleta.
- Fechamento interno (`extended`) e time-up/empate da arena 12 seguem sem execução nativa
  (capturas TIME-UP A/B em `bombtop-src/sb2-evidence/output-sb2-research/stage12-time-up`, não extraídas).


## 06/11/2026 (cont.): cinco jogadores e fim de tempo nativo

- Pedido do usuário: todas as arenas com 5 jogadores. `SB2_FIFTH_SPAWN` (`sb2-native-motion.ts`): casa de piso
  comum mais perto do centro, fora de painel/placa/trilho/alçapão/caveira; blocos em `clear` só saem com 5
  jogadores (com até 4 a grade é idêntica à original). Removidos `stageMaxPlayers` e o pulo de rotação.
  Smoke 5 bots × 3 seeds × 12 arenas sem exceções.
- Lacunas fechadas com evidência já existente: arena 12 (morte após impacto no piso 11 está nas capturas,
  remoção do corpo no 199); arena 7 (bolsa sem Speed, caveira sem rápido/lento: tabelas da ROM); arena 3
  (os quatro ramos nativos testam `5D04&0003`, inclusive a coluna 11: fiel à ROM).
- REA: `tools/sb2-research/extract_time_up.py` confrontou TIME-UP A (ev_8d48cb71…, script 09dbbe32, 601 leituras)
  e B (ev_b11d768b…, script f9081bef, 241 leituras) com a WRAM do MCP Snes9x: todas iguais. Achado: 0:00 no
  frame 14862; o contador corre 0..64 de novo; volta a 0 em 14927; em 14928 (contador 1) os dois vivos passam
  a `0x98xx` juntos (eliminados = empate) e o relógio congela. O sim declarava empate já em 14862.
  Corrigido (`Sb2BattleClock.zeroWrapped/expired`, `matchResult`); fixture `docs/sb2/SB2-STAGE12-TIME-UP-CLOCK.json`,
  teste `test/sb2-time-up.test.ts`. Extração completa em `bombtop-src/sb2-evidence/time-up-extract.json`.
- Ainda abertos: fase de transporte da arena 2 (`stage2TransportPhase` nunca escrito; replays nativos passam com 0)
  e extensão interna do fechamento (`1C68 != 0`), que exige nova execução no emulador.

## 06/11/2026 (cont.): fase de transporte da arena 2 resolvida

- A "fase" que C04468 consulta antes da entrada no círculo é 7E5D0E bit0001 (seção "preparação e lançamento").
  0x5D0E é a palavra das flags do fechamento (C0D83E liga bit0001 em 0:33); `extract_warp_bombs.py` já a lia
  como `transport_phase`. Logo, com o fechamento iniciado, o círculo não inicia o transporte.
- `sb2-stage2-controller.ts` agora lê `closure.flags & 1`; o campo morto `stage2TransportPhase` saiu.
  Todos os replays nativos tinham 5D0E=0 e continuam passando. Teste `test/sb2-stage2-closure.test.ts`.
  Limite: dedução estática + identidade de endereço, sem captura nativa da arena 2 em fechamento.
- (Atualizado abaixo: extensão interna validada em 08/11.)

## 08/11/2026: extensão interna do fechamento (1C68) validada no Snes9x com REA

- Ambiente refeito: a pasta `BombtopTools/mcp-snes` tinha sumido (a ROM europeia fora baixada pelo Codex em 31/10).
  Núcleo Snes9x 1.63 fae2fea rebaixado do buildbot (sha256 9573c48f…, outra build); `mcp-snes` recriado só com
  SDK MCP + Zod. ROM fornecida pelo usuário: Super Bomberman 2 (USA), sha256 0a4b4a78… (NTSC). As regiões
  C0D5BB/C0D83E/C11C1C e a tabela C5E1C9 são iguais byte a byte às da europeia, nos mesmos endereços.
- Origem de 1C68 (ROM, rizin): único escritor é CC1869 (`LDA #FFFF / STA 001C68`). CC1926 compara os 4 dígitos
  da senha (7F0028..2E) com a tabela CC0000 (11 entradas); casou → 1C6A = índice. CC17D4: 1C6A == 0A → CC1869.
  Entrada 10 = **5656**. Ou seja: a extensão é a senha 5656 da tela PASSWORD; sem ela 1C68 = 0 (padrão).
  As entradas 0–9 (4361, 6442, 3903, 9564, 7735, 1111, 5462, 6763, 8784, 6925) são do modo normal.
- Ensaio (worker + `rea-closure-extended.js`, sessão REA 2ad11f9e…, evidência ev_be38dc88…, script 77a8d905…):
  senha 5656 → 1C68=FFFF/1C6A=0A confirmados na WRAM; Battle single, P1/P2 MAN, P3/P4 OFF, 2:00, G-Bomber OFF,
  arena 1; P1 levado a (4,5) e P2 a (10,7) a bomba. 800 leituras integrais a cada 3 quadros desde 0:36.
  REA reteve 734 amostras (67–800, orçamento de 16 MB): 298.738 comparações com o MCP, nenhuma diferença.
- Resultado: índice 80 (FE) → 82 no mesmo despacho; 118 casas fechadas na ordem exata da tabela (38 além do FE);
  P2 esmagado em (10,7) = casa 87 na leitura 649, fim da rodada. Sem a extensão o sim pararia no FE.
- `tools/sb2-research/extract_closure_extended.py` gera `docs/sb2/SB2-CLOSURE-EXTENDED-5656.json`;
  `test/sb2-closure-extended.test.ts` compara relógio, os cinco registradores e vida em cada leitura até 649:
  o sim já reproduzia (`extended: true`). Mutação com `extended: false` falha na leitura 464, como esperado.
- Bombtop continua com `extended: false` (padrão do jogo sem senha). Capturas em
  `bombtop-src/sb2-evidence/output-sb2-research/closure-extended-usa`. Limite: NTSC/USA, só arena 1.
