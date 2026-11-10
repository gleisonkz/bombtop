# Arena10 — auditoria das evidências existentes

Esta auditoria usa arquivos locais já capturados por REA/MCP. Não houve nova execução no emulador nesta rodada.

## Confirmado nas capturas

- `docs/sb2/SB2-REA-PLAYER-OBSERVATIONS.json`, evidência `ev_67648619c804019bae10fe8d6ecec3e581c261249431469bc4b603fba8d70329`, contém estruturas completas dos quatro jogadores, sem truncamento no registro usado pelo teste.
- `output/sb2-research/motion/complete-journal.json`: carrega `arenas-initial/arena-10.state`, avança80 frames e envia Y+RIGHT em passos unitários. O journal antigo usa chave `args`, diferente de `arguments` dos journals recentes.
- Amostras98..129 correspondem aos frames1..32 do salto; sample130 é o33. A altura calculada de `+18/+1A` coincide nos32 frames com `phase*(31-phase)/8`, máximo30. O teste `packages/shared/test/sb2-native-motion.test.ts` confronta a estrutura bruta e esta curva, não o step.
- As quatro posições iniciais da arena10 estão no mesmo bundle e no mapa `SB2_SPAWN_POINTS`.

## Inferência limitada

A altura usa como referência o chão nativoY48 desta trajetória. Isso não prova que o campoY seja chão durante outros saltos: ele incorpora elevação visual. O índice de célula+A8 também muda durante o arco; não tratá-lo como célula de chão sem reconstruir seu uso.

## Não demonstrado para integração completa

Não existe amostra de jogadores imediatamente depois dos80 frames de preparação e antes do primeiro Y+RIGHT: a amostra97 pertence à arena12. Portanto não usar sample97 como frame0 do salto10. Faltam soltura/manutenção/repetição deY, outros sentidos, início sem direção, colisão com pilares/blocos, contato com bombas e fogo em cada fase, inventários e quatro jogadores. A trajetória de32 frames não prova a regra completa de travessia de borda. O helper puro não implementa a arena no loop e não autoriza seletor.

## Próxima execução necessária

Reabrir o bridge MCP existente sem instalação, pois o antigo processo160472 terminou após reinício das ferramentas. Carregar um estado conhecido da arena10, preparar naturalmente e capturar frame0 completo. Usar observador REA de todas as estruturas e grades; capturar Y isolado, Y+RIGHT, pulso único seguido de direção/neutral e salto junto à borda, sem editar RAM. Confrontar REA/MCP antes de portar estado serializável de salto e separar posição de chão/elevação no renderer existente.

## Pontos calculados da estrutura bruta

[
  {
    "sample": 98,
    "x": 32.5,
    "y": 44.25
  },
  {
    "sample": 113,
    "x": 40.0,
    "y": 18.0
  },
  {
    "sample": 129,
    "x": 48.0,
    "y": 48.0
  },
  {
    "sample": 130,
    "x": 48.0,
    "y": 48.0
  }
]

## Atualização: nova captura com frame0

A lacuna de frame0 descrita acima é da captura antiga e foi resolvida em `SB2-STAGE10-JUMP-CONTROLS-FULL-REPLAY.json`: quatro casos0..160, dois jogadores humanos, preparo natural desde selection.state e estado salvo em stage10-jump-controls/entry.state. Comparação REA/MCP `SB2-STAGE10-JUMP-CONTROLS-COMPARISON.json` confere645 leituras sem truncamento. Os seis novos testes de evidência passaram; não são integração no step. Faltam outros sentidos, novo pulso após soltura, colisões/controle de chão, bombas/fogo e bordas.

## Atualização: sentidos verticais, borda e novo pulso

`SB2-STAGE10-JUMP-DIRECTIONS-FULL-REPLAY.json` acrescenta quatro casos160 passos com644 leituras confrontadas. O limite32 não é duração universal: UP encerra fase aérea29 e atravessa borda superior; DOWN cai até37 e resolve aterrissagem38 emY67.5. A rotina `sb2NativeJumpFlightY` modela somente Y visual livre (aceleração1/4 com transição por zero), não posição de chão nem duração/colisão. LEFT mantém avanço automático1px/frame após limpeza33, cruza0->255 no50 e recentra232->224 no74. Novo Y+RIGHT35 após soltura inicia outro salto até66 e limpa67. Doze testes de evidência passaram; não equivalem à integração no loop.
