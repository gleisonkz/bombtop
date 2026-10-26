# Assets das 12 arenas SB4 no estilo Bombtop

As 12 capturas em `concept/references/sb4-battle/` foram revisadas individualmente. A arte foi regenerada usando os pixels dessas referências e o atlas atual `apps/client/public/sprites/tiles.png` como guia de acabamento, luz e perspectiva. Não são recortes ampliados dos screenshots nem extração da ROM.

## Contrato e arquivos

Cada `apps/client/public/sprites/sb4-battle/tiles-NN.png` mede **1920×128**, RGBA: quinze células de 128×128 em uma linha, escala de runtime 0,125. Células 0–2 são pisos A, 3–5 pisos B, 6 bloco, 7 pilar, 8 borda, 9–14 destruição. Não há HUD, personagens ou itens das capturas nesses atlas.

| Nº | Arena | Família de materiais |
| --- | --- | --- |
| 01 | Usual | Piso verde, tijolos cinza, pilares de pedra |
| 02 | Fast 'n Slow | Metal cinza esverdeado, cobre e mecanismos dourados |
| 03 | Rolling Sugedama | Pedra clara, volume de palha dourada, grade verde e ouro |
| 04 | Push and Fall | Vegetação, rocha com musgo, raízes e terra |
| 05 | Numb Bomb | Ladrilhos ocre, isoladores de cobre e borda elétrica |
| 06 | Surprise Floor | Pedra azul-petróleo, painéis ciano e rocha dourada |
| 07 | Hide and Blow Seek | Madeira escura, vidro/gelo ciano e folhagem |
| 08 | Spinny Slots | Piso creme, ouro e decoração de cassino |
| 09 | Seesaw | Alvenaria industrial verde-petróleo, caixas vermelhas e neon |
| 10 | Costume/Cosplay | Piso verde escuro, máscara dourada e palco magenta |
| 11 | Trolley | Tábuas marrons, cargas coloridas e vigas douradas |
| 12 | Flag Tag | Pedra arenosa, formas douradas, vegetação e borda azul |

Os blocos das fases 05 e 08 são células de compatibilidade do atlas, não evidência de blocos nesses mapas. A referência 05 não tem blocos destrutíveis e a captura 08 deixa os corredores livres.

`tiles-source.png` é a fonte gerada de 1086×1448: grade 9×12, com linhas de alturas irregulares. O empacotador usa limites verticais medidos, registrados no manifesto, e remove dois pixels horizontais e quatro verticais de contorno. Isso evita que faixas das linhas seguintes contaminem os tiles, defeito identificado na primeira revisão. A troca das células de bloco das linhas 08/10 corrige a disposição da fonte e está explícita no manifesto. O PNG fonte é preservado sem alteração.

Os três primeiros quadros de destruição compõem os efeitos de fogo já existentes sobre o próprio bloco de cada fase, com compressão progressiva ancorada no chão. Os três últimos reaproveitam escombros, brasas e cinzas do atlas padrão. Não são seis novos desenhos por material; continuam sendo uma aproximação para pedra, vegetação e metal.

## Objetos especiais

`props.png` mede 1536×128, com doze células RGBA de 128×128. Há também os arquivos individuais `prop-*.png`.

Ordem: relógio (02), bola (03), abismo (04), cerca elétrica (05), painel direcional (06), folhagem (07), roleta (08), interruptor da roleta (08), gangorra (09), máscara (10), carrinho (11), bandeira (12).

São **sprites estáticos sem mecânica ou animação integrada**. A fonte `props-source.png` tem transparência real e regiões medidas em `props-manifest.json`; os recortes preservam uma escala comum de 128/432, com margem transparente. O abismo é uma imagem, não uma colisão. A cerca elétrica e a gangorra também ainda precisam de regras e estados.

## Prévia e integração

`materials-preview.png` reúne doze amostras na ordem 01–12, quatro por linha. Os `art-preview-NN.png` usam a mesma grade demonstrativa para comparar materiais: **não reproduzem o layout original, a distribuição de itens ou as armadilhas**. As variações de piso são estilizadas; continuidade perfeita das juntas entre todas as seis variantes não está comprovada.

O renderizador usa os atlas próprios nas arenas `sb4-01` e `sb4-02`, as únicas arenas SB4 atualmente selecionáveis. O catálogo visual aceita números 01–12. Os assets 03–12 estão preparados, mas seus layouts e mecânicas não foram habilitados como se estivessem completos. Arenas autorais continuam com o atlas padrão, e falhas de carregamento mantêm o fallback.

Foi conferida a troca 01 → 02 → classic no renderizador Pixi real pelo Codex Browser Bridge, com 195 tiles por arena, texturas de 128 pixels e tint branco nos atlas próprios. Isso valida carregamento e seleção visual, não paridade de gameplay com a ROM.

## Reprodução e verificações

Na raiz do projeto:

```powershell
python apps/client/scripts/pack-sb4-tiles.py
python apps/client/scripts/pack-sb4-props.py
python apps/client/scripts/test-sb4-tiles.py
pnpm -C apps/client exec vitest run test/sb4-map-references.test.ts test/sb4-stage-art.test.ts test/stage-tiles.test.ts
```

`manifest.json` registra dimensões, índices, fontes e SHA-256 dos doze atlas. `props-manifest.json` registra os limites dos objetos, a escala e o estado de integração.
