# Paridade de mecânicas — Super Bomberman 4

Levantamento inicial de 25/10/2026 para orientar melhorias do Bombtop como jogo de batalha inspirado no Super Bomberman 4 de SNES. Comparações abaixo distinguem comportamento testado no Bombtop, observação da ROM e referências externas. Não representam uma equivalência completa do jogo.

## Referência e limites da engenharia reversa

- ROM local analisada: `Super Bomberman 4 (Japan).sfc`, SHA-256 `BDD90B49BF08D0D0A80E4B4EC811084D470355C648C49A28A0E838CBF1EA8F92`.
- Cabeçalho original confirmado no deslocamento `0xFFC0`: `SUPER BOMBERMAN 4`, mapeamento `0x31`, vetor de reset `0xF074`. O emulador SNES exibiu uma fase jogável com personagens, obstáculos e cronômetro.
- O REA leu os bytes do banco `0x8000–0xFFFF` por meio de uma cópia binária auxiliar ignorada pelo Git e analisou estaticamente o pacote JavaScript compilado do Bombtop. Evidências exportadas para `.agent/rea-bomberman4-evidence.json`.
- Limitação: a ROM é de SNES/65816. O REA disponível aceita `6502` somente em um espaço de endereços menor e o Rizin retornou `ERR_REA_WINDOWS_NATIVE`; portanto, a leitura dos bytes **não comprova** a lógica completa das rotinas nativas de jogo. A inspeção de JavaScript foi estática, parcial e não executa a aplicação.

## Comportamentos já verificados no Bombtop

| Mecanismo | Evidência local | Resultado |
| --- | --- | --- |
| Arena em grade e partida com bot | Sala criada e partida iniciada no Chrome via Codex Browser Bridge; estado `13×11` e dois participantes | Funcionou no teste pontual |
| Até cinco participantes | `packages/shared/src/constants.ts`, `packages/shared/src/arena.ts` | Implementado |
| Pavio e explosão em cruz, barreiras, blocos destruíveis | `packages/shared/src/bombs.ts`, `packages/shared/test/bombs.test.ts` | Coberto por testes |
| Reação em cadeia sobre chamas persistentes | `packages/shared/test/bombs.test.ts` | Corrigida: bomba colocada ou aterrissando em chama detona no tick correspondente |
| Chute, soco, luva, bombas remotas e perfurantes | `packages/shared/src/kick.ts`, `air.ts`, `bombs.ts` e testes respectivos | Implementações próprias testadas; tempos e regras exatos da ROM ainda não estabelecidos |
| IA com escape de bombas | `packages/shared/src/bot.ts`, `test/bot.test.ts` e `test/bot-escape.test.ts` | Corrigida a fuga com obstáculos, a preferência por rotas sem caveiras e o controle invertido; seeds 8, 20, 64 e 72 passaram |

## Diferenças verificadas ou lacunas importantes

1. **Itens do estágio clássico:** uma tabela de referência do modo de batalha lista 8 bombas, 5 fogos, 3 velocidades, 2 ovos, 2 luvas, 2 socos, 2 push, 3 chutes e 1 crânio no estágio inicial. O Bombtop sorteia itens ocultos por pesos globais (`ITEM_WEIGHTS`, `ITEM_CHANCE`); isso não reproduz a composição por estágio.
2. **Ovos e montarias:** a ROM usa ovos no modo de batalha. No Bombtop, `ITEM_WEIGHTS.egg = 0`, embora a lógica básica de montaria exista. O desenho do cavaleiro ainda usa uma forma simples no renderizador; reativar ovos requer concluir apresentação e validar interações.
3. **Fases:** Super Bomberman 4 oferece diferentes arenas e regras. O Bombtop tem `classic`, `conveyor` e `warp` implementados, mas `STAGES` seleciona apenas `classic`.
4. **Modos de batalha:** o original inclui Battle Royale, Tag, Champion e Maniac. O Bombtop prioriza batalhas online; equipes, sequência Champion e personalização Maniac não foram demonstradas neste levantamento.
5. **Controle remoto:** o Bombtop ainda aciona o pavio automático de três segundos para bombas remotas. Fontes da série descrevem detonação à escolha do jogador. Confirmar o comportamento específico no Super Bomberman 4 antes de alterar todas as regras de temporização e a previsão dos bots.
6. **Bomba no ar:** o Bombtop reduz o pavio durante o voo, embora um comentário do tipo `Bomb` indique pausa. A regra original não foi comprovada. É necessária reprodução controlada antes de mudar esse contrato existente.

## Critério de validação contínua

Cada ajuste deve partir de uma referência identificável, reproduzir o desvio, acrescentar teste de regressão e passar pela suíte compartilhada, pelo typecheck e pelo build do cliente. Alterações de IA exigem partidas determinísticas e verificação de desempenho. Para validação visual, usar a ROM/emulador como referência observável e uma partida local no navegador; não inferir regras de colisão a partir de imagens estáticas.

Na validação desta rodada, 750 testes automatizados passaram (315 compartilhados, 412 cliente, 23 servidor). A alteração intencional das trajetórias dos bots atualizou as três fingerprints de replay determinístico após duas execuções com resultados idênticos. O benchmark passou em todos os cenários, com limite de p99 de 4,17 ms por tick. Foi também verificado no Chrome o fluxo menu → sala → adicionar bot médio → iniciar partida → vitória do bot contra o jogador inativo → retorno ao lobby. Essa observação não equivale a uma prova de paridade integral de todas as mecânicas da ROM.

## Referências externas complementares

- Itens por estágio, levantamento de jogadores: https://game.bad-person.net/gamenote/superbom4/superbom4_item_battle.html
- Modos e arenas descritos na wiki da série: https://bomberman.fandom.com/wiki/Super_Bomberman_4
- Efeito geral de bombas remotas: https://bomberman.fandom.com/wiki/Remote_Control

As referências comunitárias acima orientam hipóteses e prioridades. Para equivalência exata, confirmar cada ponto com execução controlada da ROM ou análise nativa compatível com 65816.
