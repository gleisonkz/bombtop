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

| Estação nativa | Descritor | Scripts C3 | Atualizações móveis | Retorno do controle em atualizações lógicas |
| --- | --- | --- | --- | --- |
| `(128,112)` | `C3:95DC` | `96CA / 9A6A / 9D9A` | `308 / 272 / 302` | `402 / 367 / 407` |
| `(192,144)` | `C3:95F0` | `A102 / A402 / A7D2` | `268 / 336 / 374` | `362 / 431 / 469` |
| `(128,208)` | `C3:9604` | `AC2A / AFF2 / B332` | `312 / 274 / 308` | `406 / 368 / 402` |

Contagem por entradas CPU do objeto `0x14C0`, separada de frames de vídeo: `cart-centre-logic-entry-trace.json`, `station-bottom-logic-controlled.json`, `station-right-evidence.json`. As 42 chamadas de boarding somam-se à atualização que inicia o embarque. Há chamadas móveis sem deslocamento em algumas rotas e diferenças reais na saída; elas não foram reduzidas indiscriminadamente a 51. Os timers reproduzem estas fixtures; física geral de salto, obstáculos na saída e atrasos de vídeo não foram portados integralmente.

O sorteio de estação foi observado em `C3:02AF`, Y=3, antes de criar o objeto. O resultado indexa a tabela `C3:95DA` com stride20. Trace: `cart-initial-station-selection-trace.json`; bytes REA: `ev_237f643ec0d3ac88cbf8d71751222b093b89ea29e93c0e2ea90ec0af88a70b97`. O runtime usa a mesma operação RNG16 para estação e depois trajeto. A posição da estação libera seu collider de bloco no template provisório; geração nativa de blocos e itens sob a estação continua em aberto.

Relatórios: `.agent/sb4-rom/station-bottom-report.md` e `station-right-report.md`. Nove trajetórias Group 1 não comprovam todas as variantes dos outros grupos.

## Nova diferença encontrada nas bombas, ainda sem alteração de regra

Uma bomba colocada por A na fixture normal de dois humanos inicializou `WRAM 0x87A=126`, por escrita executada em `C1:1FC7`, e decrementou a cada atualização em `C1:3CE9`. A rotina passou a explosão em `C1:3DB8`. Artefatos: `bomb-first-ten-frames.json`, `bomb-timer-write-trace.json`, `bomb-timer-original.json`. REA leu os bytes de inicialização (`ev_d33e4e555835dfc75ff64ac58f7797c0c18a60ac6d3e7f62431bce99e26be11d`) e do contador (`ev_8cb5d6ce99491d66aefba9ae6033a5b78e7402c2fef7bf76e98a32fc305f6357`). O valor 126 também foi lido em `C1:56EA` (`ev_cce91f64a1a6f7c69f95f25eaabfdff1f8fa639046f4427818ee1eb23e8787b6`).

Isso contradiz os 180 ticks atuais do Bombtop nesse caso. Confirmar outras arenas, tipos de bomba, maldições e a ordem de atualização de spawn antes de alterar a regra global ou as arenas autorais. As tentativas de expor o passageiro às chamas não chegaram a embarcar antes da explosão e **não provam imunidade**. O teste de bomba contra carrinho parado não mediu extensão da chama atrás dele; portanto também não prova bloqueio de raios.

## Pendências

O mapa 03 confirmou a inicialização de bombas em 126 em quatro colocações reais, fortalecendo a investigação do temporizador acima. Ver `SB4-BOLAS-ROM.md`; a regra de fuse ainda não foi alterada.

1. Extrair grupos/variantes restantes e substituir timers de saída por física geral de salto confirmada.
2. Confirmar danos a adversários protegidos, bombas, itens, imunidade do passageiro e o que ocorre com a estação durante destruição/pressão.
3. Validar visualmente os trilhos e reproduzir animações de embarque/desembarque no estilo visual do Bombtop.
4. Substituir layouts fixos e distribuição de blocos aproximados por geração comprovada. Os estados originais diferem entre partidas; `USUAL` é explicitamente provisório.
5. Investigar os outros onze mapas com o mesmo rigor. Testes verdes da simulação não provam paridade com a ROM.

## Validação desta correção

95 testes focados shared e 48 focados client passaram no root ativo; typecheck de shared/server/client e build Vite/PWA passaram. A suíte shared ampla anterior teve 803 passes e quatro falhas: três snapshots de partidas autorais e o teste de aquecimento da IA. O agente client relatou suíte ampla com 1098 passes e quatro falhas fora do renderer, em maniac-health-hud/stage-rotation-panel; o coordenador confirmou os 48 focados, o typecheck e o build. Nenhum snapshot foi regravado para ocultar diferenças concorrentes. Bridge saudável, mas duas tentativas limitadas de adquirir a fila compartilhada retornaram queue_timeout; nenhuma captura do cliente é alegada nesta rodada. Nenhum commit/push.
