# Paridade de mecânicas — Super Bomberman 4

Levantamento inicial de 25/10/2026 para orientar melhorias do Bombtop como jogo de batalha inspirado no Super Bomberman 4 de SNES. Comparações abaixo distinguem comportamento testado no Bombtop, observação da ROM e referências externas. Não representam uma equivalência completa do jogo.

## Referência e limites da engenharia reversa

- ROM local analisada: `Super Bomberman 4 (Japan).sfc`, SHA-256 `BDD90B49BF08D0D0A80E4B4EC811084D470355C648C49A28A0E838CBF1EA8F92`.
- Cabeçalho original confirmado no deslocamento `0xFFC0`: `SUPER BOMBERMAN 4`, mapeamento `0x31`, vetor de reset `0xF074`. O emulador SNES exibiu uma fase jogável com personagens, obstáculos e cronômetro.
- O REA 6.7.0 executou o Rizin 0.9.1 via CLI sobre a ROM inteira de `0x200000` bytes, reconhecida como Super NES. O mapa `iS` expôs 32 bancos canônicos `C0–DF`, com 64 KiB cada, e espelhos de ROM. A instrução de entrada em `C0:F074` é `SEI`, seguida de inicialização de registradores do console; a sequência contém `XCE` e `REP`, evidenciando código 65816. O hash da ROM permaneceu inalterado.
- Uma versão de desenvolvimento do REA em `D:\Programação\rea` adicionou o formato `snes-rom` e verificou a importação profunda da mesma ROM pelo Ghidra 12.1.4 com a extensão `ghidra-snes` e o processador `65816:LE:24:snes`. O relatório `D:\Programação\rea\build\snes-verification\report.json` registrou 32 bancos com evidências independentes de leitura, 36 segmentos mapeados (ROM, espelhos, WRAM e MMIO), 357 procedimentos identificados e 22 strings. O reset em `0xF074` foi decodificado como `SEI`; o endereço `0xC0F074` foi associado ao offset `61556` do arquivo. Evidência principal: `ev_dfd04e7e908f50645be2ebc074bdbd5df3c4a4c9fd5e34c0f5dbe2fc316b406d`.
- Evidências do REA na sessão: `ev_126b28d765121628c8b809b83367c1f9520b13c1a5b12448336c81336fd4654e` (`iI`) e `ev_c235edcb993b4a7708da90ed9ab1b98891a4e8ec4ac8cdfae7ff49d0fca9e8e5` (`pd 32 @ 0xc0f074`). A execução do Rizin pela CLI funcionou mesmo quando a operação MCP direta retornou erro interno. O levantamento antigo do banco isolado e a inspeção estática de JavaScript permanecem em `.agent/rea-bomberman4-evidence.json`.
- Limitação de integração: a conexão MCP deste turno ainda apresenta o catálogo anterior ao suporte `snes-rom`, então sua operação `open_binary` rejeita o `.sfc` mesmo com a implementação corrigida validada no checkout de desenvolvimento. É preciso reconectar o REA atualizado para novos pedidos MCP dessa capacidade. A análise estática 65816 também continua sujeita a ambiguidades de flags `M/X`, instruções `PLP`/`RTI`, saltos indiretos e bytes de gráficos, áudio ou dados compactados. Os 357 procedimentos identificados não são 357 regras de jogo confirmadas; a equivalência exige reconstrução e comparação de rotinas específicas com execução controlada no emulador.

## Comportamentos já verificados no Bombtop

| Mecanismo | Evidência local | Resultado |
| --- | --- | --- |
| Arena em grade e partida com bot | Sala criada e partida iniciada no Chrome via Codex Browser Bridge; estado `13×11` e dois participantes | Funcionou no teste pontual |
| Até cinco participantes | `packages/shared/src/constants.ts`, `packages/shared/src/arena.ts` | Implementado |
| Pavio e explosão em cruz, barreiras, blocos destruíveis | `packages/shared/src/bombs.ts`, `packages/shared/test/bombs.test.ts` | Coberto por testes |
| Reação em cadeia sobre chamas persistentes | `packages/shared/test/bombs.test.ts` | Corrigida: bomba colocada ou aterrissando em chama detona no tick correspondente |
| Chute com parada manual, soco, luva, Push, bombas remotas e perfurantes | `packages/shared/src/kick.ts`, `push.ts`, `air.ts`, `bombs.ts` e testes respectivos | Implementações locais testadas, incluindo controles e rede; tempos e regras exatos da ROM ainda não estabelecidos |
| IA com escape de bombas | `packages/shared/src/bot.ts`, `test/bot.test.ts` e `test/bot-escape.test.ts` | Corrigida a fuga com obstáculos, a preferência por rotas sem caveiras, os controles invertidos e a recusa de um teletransporte com saída em chamas; seeds 8, 20, 64 e 72 passaram |
| Inventário de itens da arena clássica | `packages/shared/src/arena.ts`, `sb4-stage-definitions.ts`, `test/arena.test.ts`, `test/items.test.ts` | Distribuição determinística de 28 itens conhecidos, inclusive 2 ovos e 2 Push; total limitado aos blocos disponíveis. Contagem derivada de pesquisa comunitária, ainda sem extração da ROM |
| Catálogo das 12 arenas do Battle Mode | `packages/shared/src/sb4-stage-definitions.ts`, `test/sb4-stage-definitions.test.ts` | Nomes e inventários de referência codificados, com contagens indeterminadas preservadas nas fases 5 e 8; layouts e armadilhas originais ainda não integrados |
| Montarias e ovos | `packages/shared/src/mount.ts`, `test/mount.test.ts`, guia de itens | Ovos aparecem nos blocos e concedem montaria. O emulador exibiu criaturas montadas; as artes e habilidades do Bombtop ainda são aproximações |
| Alternância entre arenas | `packages/shared/src/stage.ts`, `test/room/session.test.ts` | Rodadas alternam `classic → conveyor → warp → classic` |
| Bomba remota | `packages/shared/src/bombs.ts`, `test/bombs.test.ts`, `test/remote.test.ts` | Pode ser detonada por ação e por reação em cadeia; conserva o pavio enquanto o proprietário estiver vivo |
| Regras configuráveis do Battle Mode | `packages/shared/src/room/session.ts`, `pressure.ts`, `protocol.ts`, `apps/client/src/ui/lobby.ts` | Anfitrião seleciona 1–5 vitórias, TIME 1/2/3/5/∞ e Sudden Death ON/OFF; sala e clientes sincronizam; fim por tempo resulta em empate se não houver último sobrevivente |
| Relógio do round | `packages/shared/src/arena.ts`, `apps/client/src/render/battle-clock.ts` | Para TIME finito, prazo de encerramento é distinto do início da pressão; o contador exibe tempo restante de partida, inclusive após a chegada dos blocos |

## Diferenças verificadas ou lacunas importantes

1. **Itens do estágio clássico:** a referência do modo de batalha lista 8 bombas, 5 fogos, 3 velocidades, 2 ovos, 2 luvas, 2 socos, 2 itens Push, 3 chutes e 1 crânio. O Bombtop agora distribui os 28 itens na arena clássica. Falta confirmar as contagens, a distribuição espacial e a mecânica do Push diretamente na ROM.
2. **Ovos e montarias:** ovos estão disponíveis e as montarias já funcionam na simulação. O renderizador ainda desenha uma elipse simples sob o personagem montado; animações, criaturas e peculiaridades de habilidades precisam de fidelidade visual e comportamental adicional.
3. **Fases:** o catálogo de 12 arenas do SB4 existe como dados de referência, mas a rotação jogável ainda contém apenas três layouts locais. O bot já verifica perigos e obstáculos na saída do teletransporte, mas sua busca de caminhos ainda não calcula integralmente a travessia do portal nem os deslocamentos pelas esteiras. Regras e layouts específicos da ROM ainda precisam ser reproduzidos.
4. **Modos de batalha:** o original inclui Battle Royale, Tag, Champion e Maniac. O Bombtop agora permite escolher vitórias, tempo, Sudden Death e uma sequência dos três layouts autorais; equipes, sequência Champion, personalização Maniac e as doze arenas originais ainda faltam.
5. **Controle remoto:** bombas com proprietário vivo aguardam o acionamento e ainda explodem em chamas. O tempo exato após a morte do proprietário e o comportamento da detonação em série exigem comparação direta com a ROM.
6. **Bomba no ar:** a implementação atual pausa o pavio no voo e enquanto está carregada. A regra original ainda requer comparação controlada entre frames do emulador e o estado dos objetos.

### Regras de tempo e fechamento, com limites de evidência

O manual japonês da Hudson (páginas impressas 18–21) documenta BATTLE de **1–5 vitórias**, TIME de **1, 2, 3, 5 minutos ou infinito**, Sudden Death **ON/OFF** e o caso de empate por tempo. No Champion, a pressão inicia quando falta **1 minuto** em uma rodada de 3 minutos. Fonte primária: <https://device.report/m/e7abfbb7124a6b665cb95cfbc97fefda226528c86e76322afdc191c15fb6818c.pdf>.

No Bombtop, TIME finito termina a rodada em empate se mais de um jogador continuar vivo; a eliminação no mesmo tick tem prioridade na versão atual, uma **hipótese ainda não verificada na ROM**. A pressão começa quando falta um minuto em qualquer duração finita, generalização provisória a partir do Champion. Sudden Death ON avança pela espiral inteira; OFF ainda faz cair a borda exterior, mas interrompe a pressão antes do centro. **O limite de uma volta externa é aproximado, sem medição direta na ROM.** A opção infinita preserva o comportamento anterior do Bombtop: não há empate por relógio e a pressão começa após 3 minutos. Cronologia, cadência e alcance dos blocos do SNES continuam pendentes de teste controlado.

## Critério de validação contínua

Cada ajuste deve partir de uma referência identificável, reproduzir o desvio, acrescentar teste de regressão e passar pela suíte compartilhada, pelo typecheck e pelo build do cliente. Alterações de IA exigem partidas determinísticas e verificação de desempenho. Para validação visual, usar a ROM/emulador como referência observável e uma partida local no navegador; não inferir regras de colisão a partir de imagens estáticas.

Na validação atual, passaram **633 testes de `packages/shared`, 933 de `apps/client` e 43 de `apps/server` (1.609 testes no total)**, assim como o typecheck de todos os pacotes e o build do cliente com PWA. As três fingerprints dos replays de bots foram reproduzidas de forma idêntica duas vezes antes da atualização dos snapshots; o benchmark de todos os cenários passou, com limite p99 de 4,17 ms por tick. A simulação da parada manual, sua propagação pela rede e a interrupção da previsão visual estão cobertas por testes. Os novos controles de regras também passaram pelos testes de interface, host Wi-Fi e rede Colyseus. Em uma rodada anterior, o Chrome percorreu menu → sala → adicionar bot médio → iniciar partida → vitória do bot contra humano inativo → retorno ao lobby. Os cinco controles móveis, incluindo PARAR e DEF., foram inspecionados geometricamente em uma área de 390×844 px sem cortes; falta validar as interações em um dispositivo real e conferir as novas opções do lobby em uma captura real. Esses testes não comprovam paridade integral das mecânicas da ROM.

## Referências externas complementares

- Itens por estágio, levantamento de jogadores: https://game.bad-person.net/gamenote/superbom4/superbom4_item_battle.html
- Modos e arenas descritos na wiki da série: https://bomberman.fandom.com/wiki/Super_Bomberman_4
- Efeito geral de bombas remotas: https://bomberman.fandom.com/wiki/Remote_Control

As referências comunitárias acima orientam hipóteses e prioridades. Para equivalência exata, confirmar cada ponto com execução controlada da ROM ou análise nativa compatível com 65816.
