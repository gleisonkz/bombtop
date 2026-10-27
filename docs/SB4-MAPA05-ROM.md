# Mapa 05: medições da ROM

ROM japonesa SHA256 bdd90b49bf08d0d0a80e4b4ec811084d470355c648c49a28a0e838cbf1ea8f92. Ensaios com dois jogadores humanos, sem AI.

## Integrado

- Velocidade inicial normal: RIGHT mantido desloca um pixel nativo por atualização. O máximo anterior do Bombtop dobrava essa velocidade.
- Capacidade inicial de cinco bombas e alcance de seis casas no mapa 05.
- Alcance inicial comum de duas casas nas arenas SB4. O controle no mapa 03 queima um bloco a duas casas. A rotina C12013 escreve alcance 2/6 nas bombas dos mapas 03/05; REA leu a tabela C11A77: `02 03 04 05 06 07 08 09 0A 0A 01 0A 0A 0A 0A 0A`. O inventário aumentado não demonstra outro tipo de bomba.
- Arenas autorais preservam seu alcance inicial anterior.

Evidência local em `.agent/sb4-rom`: `stage05-speed-right.json`, `bomb-range-init-write-traces.json` e `normal-bomb-range-spawn-control.json`. Leitura REA da inicialização: ev_67335040b0e93d4bf7ff9fd4fd677daf8c5f4349eaa22b0bf9ff0de32b6b3ed0.

## Cordas: ainda não reproduzidas fielmente

A investigação independente reproduziu 95 ensaios e 27.920 frames. Caminhar normalmente à esquerda/acima para em x31/y47 sem choque. Fixtures que alteram somente a posição para além desses limites acionam trajetória e recuperação: não provam que o contato normal com a borda deva atordoar.

O contador 0394 tem 64 incrementos na fase C21032, após uma trajetória anterior. Portanto não equivale a um stun total de 64 frames. Os controles preparados à esquerda/acima recuperam nos frames 101/93, respectivamente. Input latched, direção e travessia da borda influenciam o ensaio.

Controle entre mapas: `stage05-rope-wall-control.cjs/json` aplica a mesma fixture externa x23/y80 também no mapa 03. Ambos entram em C22026; o mapa 03 volta ao normal no frame 106, com percurso diferente. Assim, C22026 é compartilhada e sua ativação isolada **não comprova um efeito exclusivo da corda**. O trace `stage05-rope-gate.json`, confrontado com bytes REA ev_c4d20923a31eafa565cb77642159d5511c83dea5f25bf45c84f8f513166bd7db, mostra C2163C lendo a célula apontada por player+80, mascarando EFC0 e aceitando CC80/EC40. Outros gates leem player+45, +4B e +5C. Ainda falta comprovar sua semântica completa.

A aproximação de stun 20 ao caminhar na borda foi removida. Um controle adicional em quatro lados (`stage05-rope-walk-control.cjs/json`) mantém C2141C e contador zero durante 240 frames por lado; os quatro testes do simulador também exigem movimento livre depois de soltar a direção contra a borda. Falta identificar como o jogador alcança a corda no original e implementar trajetória, travessia, recuperação e animação com esse gatilho. Não substituir por um timer isolado extraído do contador.

Relatório completo e replays: `.agent/sb4-rom/stage05-rope-report.md`, `stage05-rope-verification.json`, `stage05-rope-hashes.json`.

## Push contra a borda: gatilho real distinto da caminhada

`stage05-rope-push.cjs/json` prepara direção com input, posiciona ambos jogadores em pontos válidos e compara Y8 com ausência de Y. Não escreve estado de habilidade, timer, mapa ou rotina. Alvo à esquerda (32,80), atacante (48,80): Y causa C21F36 no alvo no frame 2, C21005 no 3, C21032 no 4, retorno a C2141C no 71. O alvo termina em (31,80); o atacante avança até (32,79). Sem Y não ocorre essa sequência. O teste à direita também reproduz as transições 2/3/4/71. Os testes superior/inferior não ativaram Push nessa preparação; são inconclusivos, não prova de ausência da mecânica.

REA verificou C21F36..C21FC6 (ev_706b4d5c2e852bcdec475ac8964653139023d6f56ca33db9085e921e714b05f1) e C21005..C2105E (ev_9ddf841a7c4d7568ec92a661d140a213dd35ba0f30b68f767d679df5c27e559d). O segundo contém reset de +94, instalação de C21032 e incremento/comparação com 0040. O simulador ainda rejeita Push quando a célula atrás do alvo é parede; essa divergência fica pendente até delimitar a regra completa de colisão e recuperação.
