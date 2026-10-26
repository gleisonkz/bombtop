# Bolas do mapa 03: evidência e correção parcial

Investigação de 26/10/2026 no root `D:\Programação\Jogos\New folder\bombtop`, HEAD `01b77bb3f09f7d756c15326f46970b9bb93b7e15`. ROM Japan SHA256 `bdd90b49bf08d0d0a80e4b4ec811084d470355c648c49a28a0e838cbf1ea8f92`, executada em núcleo isolado do MCP SNES. Nenhum byte de ROM foi alterado.

## Confirmado

- Bolas nos tiles `(5,5)` e `(9,7)`, objetos WRAM `0x1580` e `0x1520`; funções idle `C3:07C3` e móvel `C3:0930`.
- Bombas reais adjacentes ativaram as duas. A preparação alterou somente a posição de P1; bolas, explosões, obstáculos, timer e RNG não foram escritos.
- Primeiro deslocamento para o lado da bomba, oposto ao sentido de propagação da explosão.
- 128 deslocamentos consecutivos de 1 pixel por atualização: oito segmentos de 16 pixels. A distância líquida pode ser menor por curvas e inversões.
- Idle não mudou de posição durante o controle negativo de 650 atualizações.
- Bombas deste mapa também inicializaram 126, por escrita em `C1:1FC7`.

REA leu `C3:07C3..0A42`, evidência `ev_7f183582d2ce5f08216ffcdbcf8d88bdda7ca6ea6195b5ef14d5590082d2d8fc`. Bytes em `.agent/sb4-rom/rea-stage03-ball-bytes.json`; execução, inputs, escritas de fixture, capturas e trajetórias em `.agent/sb4-rom/stage03-*`.

## Integrado

O Bombtop inicia a bola em direção à bomba, avança `TILE/16` por atualização e limita o orçamento a `8*TILE`, serializado em `travelRemaining`. A previsão dos bots usa a nova velocidade. Teste vermelho antes da mudança e verde após ela: deslocamento inicial de 1 pixel e parada após 128 atualizações em corredor livre.

## Ainda não reproduzido

A ROM vira e inverte em corredores; o Bombtop ainda para diante de obstáculos. A escolha geral de direções, colisões com blocos/bombas/itens/outras bolas, danos a jogadores, reativação durante movimento e variantes de layout precisam investigação específica. Esta correção **não conclui a mecânica das bolas**.

Os 128 pixels foram confirmados nos dois ensaios; não são oito tiles distintos. Testes locais de dano e bloqueio de chamas protegem a implementação existente, mas não comprovam todas essas regras na ROM.
