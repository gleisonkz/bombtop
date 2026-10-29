# Lanterna A1 — nova geração facial

63 poses com rosto foram regeneradas no PixelLab Pro por edição com referência real `concept/lantern/pixellab-preview/bald-1.png`. As 21 poses únicas de costas foram reaproveitadas. A folha mantém o mapa de 108 células em 18 linhas, 9 colunas e quadros RGBA de 132 × 164 pixels.

Os pedidos fixam sobrancelhas finas inclinadas, pálpebras estreitas, esclera branca, pequenas íris verdes, pupilas pretas e o mesmo bigode/cavanhaque. Nenhum pedido inclui efeitos. A geração ainda pode variar entre poses; esta folha é candidata para revisão visual, sem substituir a versão atual do jogo.

`jobs.json` registra as 63 gerações; `repairs.json` registra novas tentativas dos quadros com alteração indevida de escala. `results/` e `repair-results/` guardam os PNGs do serviço. `generated/` reúne os resultados selecionados e as costas reutilizadas, sem retoque facial ou harmonização de paleta por script. `selection.json` registra qual arquivo foi usado em cada pose.

O empacotador existente apenas posiciona os PNGs inteiros na grade, sem escala ou síntese de membros/rosto:

```powershell
python -B apps/client/scripts/pack-lantern-pixellab.py --pose-map concept/lantern/redraw/face-regeneration/pose-map.json
```

`candidate.png` é a folha completa. `walk-preview.gif` e `face-preview.png` permitem avaliar movimento e identidade. A versão anterior de produção permanece preservada.
