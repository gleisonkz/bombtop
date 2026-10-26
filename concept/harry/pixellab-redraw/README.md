# Harry — modelo 1 aprovado

Base aprovada: `../pixellab-preview-v2/option-1.png`, gerada no PixelLab Pro a partir do personagem e do acabamento do Capitão América. O Harry antigo não foi usado como referência de aparência. Suas linhas de animação orientam apenas o contrato das poses.

Personagem PixelLab: `b221a997-bdcf-4894-a052-7ee1a1c41985`. A frente conserva a imagem aprovada; as outras direções foram rotacionadas a partir desses pixels. Não houve redução de resolução nem ampliação artificial do personagem.

## Arquivos ativos

- `apps/client/public/sprites/harry.png`: 100 quadros de jogo, 9 colunas × 17 linhas, células 224×224, RGBA, âncora (111,5;211).
- `harry-lobby-pixellab.png`: 8 poses novas de apresentação, células 224×224.
- `harry-victory-pixellab.png`: 16 poses novas de vitória, células 224×224.

As linhas 0–16 mantêm: parado 4×3; caminhada 6×3; dano 6; derrota 7; varinha 9×3; transporte parado 4×3; transporte andando 6×3. A esquerda espelha a direita. A apresentação e a vitória substituem os overrides antigos em todos os consumidores do cadastro Harry.

Os 124 quadros têm somente o personagem, com a varinha quando a pose a exige. O transporte usa mãos vazias acima da cabeça. O Patronus do jogo continua sendo um efeito independente. O novo menu não utiliza a apresentação antiga com cervo incorporado.

## Fontes e reprodução

`frames/` conserva as saídas brutas da API. `jobs.json` registra os jobs. A primeira tentativa de transporte com braços baixos não faz parte do manifesto final. `clean-carry.py` remove somente componentes azuis soltos que o gerador acrescentou fora do personagem; os pixels do componente principal ficam intactos. Os resultados limpos ficam em `cleaned/`, sem sobrescrever as fontes.

`manifest.json` mapeia explicitamente os quadros escolhidos. `report.json`, `palms.json` e `runtime-metadata.json` registram translações fixas por linha, 50 palmas, retrato e escala. Não há normalização de tamanho por frame.

```powershell
python concept/harry/pixellab-redraw/collect.py
python concept/harry/pixellab-redraw/clean-carry.py
python concept/harry/pixellab-redraw/integrate.py
python apps/client/scripts/pack-harry-pixellab.py
python concept/harry/pixellab-redraw/integrate.py --promote
python apps/client/scripts/build-carry-anchors.py --character harry
```

`collect.py` somente consulta jobs existentes. `submit-carry.py` pula jobs já registrados; os outros pedidos originais estão documentados nos recibos. A chave está no ambiente Windows, fora do projeto. Não usar os antigos geradores/compositores de Harry para esta versão.

A folha `harry-complete-review.png` reúne as 100 poses de jogo, 8 de apresentação e 16 de vitória para a revisão visual do usuário. A aprovação estética final é dele, conforme solicitado; as checagens locais cobrem estrutura, recortes, encaixes e integração.
