# Bolas do mapa 03: decisões de direção verificadas

Investigação de 26/10/2026 no root `D:\Programação\Jogos\New folder\bombtop`, HEAD `0a2cba33551229826aeb80a6d5ffcc70eb9f256f`. ROM Japan SHA256 `bdd90b49bf08d0d0a80e4b4ec811084d470355c648c49a28a0e838cbf1ea8f92`, executada em núcleo isolado do MCP SNES. Nenhum byte da ROM foi alterado.

## Correção da interpretação anterior

Os primeiros replays mostraram a bola indo para o lado da bomba. Isso não era a regra geral: o trace mostrou uma tentativa inicial para longe da bomba, bloqueada por um soft block. A bola desviou e acabou indo para a bomba. Um controle que removeu explicitamente apenas o próximo bloco na WRAM fez a bola seguir para longe da bomba. A alegação anterior de aproximação obrigatória foi substituída por essa regra comprovada.

## Evidência

- Bolas nos tiles `(5,5)` e `(9,7)`, objetos WRAM `0x1580` e `0x1520`; funções idle `C3:07C3` e móvel `C3:0930`.
- Execução `C3:085A..092F` registra ativação, sorteio e tentativa do próximo tile. `C3:087D` aponta para as tabelas `[1,2,3,0]` e `[3,2,1,0]`, escolhidas por paridade do valor sorteado.
- O router tenta continuar; em caso de bloqueio, prefere um dos lados, depois o outro e por fim inverte. A preferência é sorteada na ativação e conservada durante os oito segmentos.
- Velocidade de 1 pixel por atualização, orçamento de 128 deslocamentos: oito segmentos de 16 pixels, não necessariamente oito tiles distintos.
- Dois replays com seed de roteamento controlado em `C3:085E`, sementes 0 e 2, registraram ordens 3 e 2 e próximos estados 899 e 2697. Cada fixture conserva todos os 129 pontos (inicial + 128 deslocamentos).
- O primeiro segmento não quebra um bloco que impeça a partida. Após avançar, há uma tentativa de quebrar bloco por segmento antes de procurar desvio. O trace registra o limite em `+0x26` e a chamada `C1:4288`.
- Idle não mudou durante o controle negativo de 650 atualizações.
- Bombas do mapa inicializaram contador 126, confirmado em quatro colocações reais.

REA leu `C3:07C3..0A42`, evidência `ev_7f183582d2ce5f08216ffcdbcf8d88bdda7ca6ea6195b5ef14d5590082d2d8fc`. Leitura de `C3:5489`, que chama o RNG com Y=FFFF: `ev_ebb567e86fd2257a81fbe3d29ef5a8345049ece4557513f8b43972f3946e2755`. A multiplicação usa oito bits do limite; a escolha da preferência resulta de `floor(nextSeed*255/65536)&3`.

Artefatos em `.agent/sb4-rom/`: `rea-stage03-ball-bytes.json`, `rea-stage03-ball-rng.json`, `stage03-ball-choice-executed-trace.json`, `stage03-ball-open-forward-control.json`, `stage03-two-turn-orders.json` e os relatórios `stage03-*`. Fixtures explicitam as escritas de posição, seed ou tile de controle; não representam partidas sem intervenção.

## Integrado

`stage-balls.ts` é responsável por ativação, movimento e previsão. O router agora conserva avanço por segmento, preferência de desvio e orçamento serializável; vira e inverte em corredores. `sb4-rng.ts` centraliza a operação também usada pelo carrinho. A previsão dos bots usa a mesma rotina em uma cópia, sem modificar a partida. Testes confrontam os 128 movimentos das duas fixtures e a imutabilidade da previsão.

O fuse normal SB4 foi integrado em 126, preservando esse valor no tick de criação. A atualização seguinte reduz para 125. Os bots, bombas previstas no cliente e som de colocação usam o mesmo contexto de fase. Arenas autorais, remote/pierce e maldições curta/longa conservam seus comportamentos anteriores; estes últimos ainda precisam confronto específico com a ROM.

## Pendências

Danos a jogadores, colisão com outras bolas, interação detalhada com bombas/itens, reativação, destruição por chama, prioridade de várias explosões simultâneas e variantes de layout ainda não estão comprovados integralmente. A simulação libera imediatamente o bloco atingido; o tempo de animação e colisão da destruição nativa ainda precisa port. A agenda global de todos os sorteios não foi reproduzida.

A correção cobre as decisões de movimento dos cenários medidos, não conclui todas as interações do mapa 03.
